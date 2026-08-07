// GET /api/push/cron
//
// Dispara os lembretes de quem está com o app fechado. O cliente agenda os
// mesmos lembretes enquanto a aba está aberta (src/lib/reminders.ts); este cron
// é o caminho para o resto do tempo.
//
// ── Dois modos ───────────────────────────────────────────────────────────────
//
// DIÁRIO (padrão): o plano Hobby da Vercel só permite uma execução por dia.
// Com um único disparo, casar horário exato deixaria quase todo mundo sem nada
// — quem pediu lembrete às 7h nunca coincidiria com a hora do cron. Então o
// modo diário olha o PERÍODO do dia na hora local de cada usuário e manda o
// aviso que faz sentido naquele momento: de manhã, o de abrir o dia; à noite,
// o de fechar ou o de sequência em risco. Lembrete por hábito não cabe aqui
// (precisaria acertar um horário arbitrário) e fica só com o app aberto.
//
// HORÁRIO: com plano Pro, mude o schedule em vercel.json para "0 * * * *" e
// defina PUSH_CRON_HOURLY=1. Aí o casamento passa a ser por horário exato e
// todos os quatro tipos de lembrete funcionam com o app fechado.
//
// Para ativar são necessárias três coisas:
//   1. npm install firebase-admin
//   2. Firebase Console → Configurações → Contas de serviço → gerar chave privada
//      base64: node -e "console.log(Buffer.from(require('fs').readFileSync('key.json')).toString('base64'))"
//      e guardar em FIREBASE_SERVICE_ACCOUNT_B64
//   3. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys)
//
// Sem isso o endpoint responde "not configured" e não envia nada.

import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:contato@therisepln.com.br',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
)

/** Com PUSH_CRON_HOURLY=1 o casamento é por horário exato (exige plano Pro). */
const HOURLY = process.env.PUSH_CRON_HOURLY === '1'

/** Tolerância em minutos no modo horário: o cron não roda no segundo exato. */
const WINDOW_MIN = 30

/** Faixas do dia usadas no modo diário, em hora local do usuário. */
const MORNING_FROM = 5, MORNING_TO = 12    // 05:00–11:59 → abrir o dia
const EVENING_FROM = 17, EVENING_TO = 24   // 17:00–23:59 → fechar o dia

/** "HH:MM" → minutos desde a meia-noite. Null se inválido. */
function parseTime(value) {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) return null
  const [h, m] = value.split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/**
 * Hora local do usuário, em minutos desde a meia-noite.
 * `timeZoneOffsetMin` é o que `Date.getTimezoneOffset()` devolve no navegador:
 * minutos que faltam para chegar ao UTC (Brasília = 180).
 */
function localMinutesNow(offsetMin) {
  const nowUtcMin = Math.floor(Date.now() / 60000) % 1440
  const local = nowUtcMin - (Number(offsetMin) || 0)
  return ((local % 1440) + 1440) % 1440
}

/** Data local do usuário no formato "YYYY-MM-DD". */
function localDateKey(offsetMin) {
  const shifted = new Date(Date.now() - (Number(offsetMin) || 0) * 60000)
  return shifted.toISOString().slice(0, 10)
}

function isDue(time, offsetMin) {
  const at = parseTime(time)
  if (at === null) return false
  const diff = localMinutesNow(offsetMin) - at
  return diff >= 0 && diff < WINDOW_MIN
}

/** Se houve qualquer registro no dia — decide o nudge da noite. */
function anythingLogged(daily) {
  if (!daily) return false
  if (daily.readiness) return true
  if (Array.isArray(daily.habits) && daily.habits.some(h => h.done)) return true
  if (Array.isArray(daily.focus) && daily.focus.some(f => f.done && (f.text || '').trim())) return true
  return Boolean(daily.waterMl)
}

function pendingHabitIds(daily) {
  if (!daily || !Array.isArray(daily.habits)) return []
  return daily.habits.filter(h => !h.done).map(h => h.id)
}

const MORNING = { title: '⚡ Bom dia', body: 'Marque sua prontidão e veja o treino de hoje.', url: '/' }
const NUDGE   = { title: '🌙 Fecha o dia?', body: 'Você ainda não registrou nada hoje. Um minuto resolve.', url: '/' }

function streakNotification(pendingCount) {
  return {
    title: '🔥 Sua sequência está em risco',
    body: `Faltam ${pendingCount} ${pendingCount === 1 ? 'hábito' : 'hábitos'} para fechar o dia.`,
    url: '/',
  }
}

/**
 * Modo horário: casa o horário exato pedido pelo usuário. Ordem de prioridade,
 * um push por execução para não empilhar avisos.
 */
function buildHourly(prefs, daily, habitDefs) {
  const tz = prefs.timeZoneOffsetMin
  const pending = pendingHabitIds(daily)

  if (isDue(prefs.morning, tz)) return MORNING

  // Lembrete de hábito: só se aquele hábito ainda estiver pendente hoje.
  for (const [habitId, time] of Object.entries(prefs.habitTimes || {})) {
    if (!isDue(time, tz)) continue
    if (!pending.includes(habitId)) continue
    const def = (habitDefs || []).find(h => h.id === habitId)
    return {
      title: def ? `${def.icon} ${def.label}` : '⚡ Rise Plan',
      body: 'Hora do seu hábito — leva um toque para marcar.',
      url: '/',
    }
  }

  if (isDue(prefs.eveningNudge, tz) && !anythingLogged(daily)) return NUDGE
  if (isDue(prefs.streakAlert, tz) && pending.length > 0) return streakNotification(pending.length)

  return null
}

/**
 * Modo diário: uma única execução por dia atinge cada usuário num período
 * diferente do dia dele, conforme o fuso. Mandamos o aviso adequado àquele
 * período — e só se o usuário tiver pedido aquele tipo de lembrete.
 */
function buildDaily(prefs, daily) {
  const localHour = Math.floor(localMinutesNow(prefs.timeZoneOffsetMin) / 60)
  const pending = pendingHabitIds(daily)

  if (localHour >= MORNING_FROM && localHour < MORNING_TO) {
    // De manhã não há o que cobrar ainda: o aviso é de abertura do dia.
    return prefs.morning ? MORNING : null
  }

  if (localHour >= EVENING_FROM && localHour < EVENING_TO) {
    // À noite, o silêncio total pesa mais que a sequência em risco.
    if (prefs.eveningNudge && !anythingLogged(daily)) return NUDGE
    if (prefs.streakAlert && pending.length > 0) return streakNotification(pending.length)
    return null
  }

  // Madrugada ou meio da tarde: nada a dizer que valha uma notificação.
  return null
}

/** Monta a notificação devida agora para um usuário — ou null se nenhuma. */
function buildNotification(prefs, daily, habitDefs) {
  if (!prefs || prefs.enabled === false) return null
  return HOURLY ? buildHourly(prefs, daily, habitDefs) : buildDaily(prefs, daily)
}

export default async function handler(req, res) {
  // Sem segredo configurado, NEGA tudo. Comparar contra `Bearer undefined`
  // deixaria a porta aberta para quem mandasse exatamente essa string.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[push/cron] CRON_SECRET não configurado — endpoint bloqueado')
    return res.status(503).json({ error: 'Cron secret not configured' })
  }
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64 || !process.env.VAPID_PRIVATE_KEY) {
    console.log('[push/cron] Not configured — skipping')
    return res.json({ sent: 0, reason: 'not configured' })
  }

  let adminDb
  try {
    const { initializeApp, cert, getApp } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')

    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString(),
    )

    let adminApp
    try {
      adminApp = getApp('cron')
    } catch {
      adminApp = initializeApp({ credential: cert(serviceAccount) }, 'cron')
    }
    adminDb = getFirestore(adminApp)
  } catch (err) {
    console.error('[push/cron] firebase-admin indisponível:', err.message)
    return res.json({ sent: 0, reason: 'firebase-admin missing' })
  }

  // Um documento por usuário em users/{uid}/data/pushSubscription.
  const subs = await adminDb.collectionGroup('data')
    .where('endpoint', '!=', null)
    .get()

  const targets = subs.docs.filter(d => d.id === 'pushSubscription' && d.data().endpoint)

  let sent = 0
  let skipped = 0

  await Promise.allSettled(targets.map(async subDoc => {
    // users/{uid}/data/pushSubscription → users/{uid}/data
    const dataRef = subDoc.ref.parent
    const [prefsSnap, habitsSnap] = await Promise.all([
      dataRef.doc('reminderPrefs').get(),
      dataRef.doc('habitDefs').get(),
    ])
    if (!prefsSnap.exists) { skipped++; return }

    const prefs = prefsSnap.data()
    const dateKey = localDateKey(prefs.timeZoneOffsetMin)
    const uidRef = dataRef.parent   // users/{uid}
    const dailySnap = await uidRef.collection('daily').doc(dateKey).get()
    const daily = dailySnap.exists ? dailySnap.data() : null

    const notification = buildNotification(
      prefs,
      daily,
      habitsSnap.exists ? habitsSnap.data().items : [],
    )
    if (!notification) { skipped++; return }

    try {
      await webpush.sendNotification(subDoc.data(), JSON.stringify(notification))
      sent++
    } catch (err) {
      // 410/404 = inscrição expirada ou revogada: limpa para não tentar de novo.
      if (err.statusCode === 410 || err.statusCode === 404) {
        await subDoc.ref.delete().catch(() => {})
      }
    }
  }))

  const mode = HOURLY ? 'hourly' : 'daily'
  console.log(`[push/cron] mode=${mode} sent=${sent} skipped=${skipped} of ${targets.length}`)
  res.json({ mode, sent, skipped, total: targets.length })
}
