// POST /api/challenge/sync
//
// O placar do desafio, conferido pelo servidor.
//
// ── Por que mover a conta para cá não bastava ────────────────────────────────
//
// Recalcular `daysDone` no servidor a partir de `users/{uid}/data/workouts` não
// resolve nada sozinho: aquele documento é do usuário, ele tem permissão de
// escrever nele, e nada impede que grave 21 treinos de uma vez. O servidor
// contaria 21 dias — corretamente — a partir de dados falsos.
//
// O que de fato trava a fraude é o RELÓGIO DO SERVIDOR. Um dia do desafio só
// entra no placar se o servidor viu aquele treino ENQUANTO o dia ainda era
// atual. Backfill não conta: quem chega no dia 10 e grava os dias 1 a 9 recebe
// zero por eles, para sempre. Para forjar 21 dias é preciso voltar aqui em 21
// dias diferentes de calendário — que é aproximadamente o mesmo compromisso de
// simplesmente treinar, e é o teto natural de um app de registro manual.
//
// O cliente NÃO escreve em `challenges/` (veja firestore.rules): a única porta
// é este endpoint, e o que ele grava é decidido aqui.
//
// Precisa de FIREBASE_SERVICE_ACCOUNT_B64 (mesma variável do cron de push) e
// FIREBASE_API_KEY (validação do token). Sem elas o endpoint responde 503 e o
// app cai no modo "estimativa local, ainda não confirmada".

import { createRequire } from 'node:module'
import { verifyToken } from '../ai/_auth.js'
import { rateLimit } from '../ai/_rateLimit.js'

// `require` de caminho literal para o rastreador de dependências da Vercel
// enxergar o JSON e empacotá-lo junto com a função.
const require = createRequire(import.meta.url)
/** @type {{id:string,name:string,startDate:string,endDate:string,goalDays:number}} */
const DEF = require('../../challenge.json')

/**
 * Folga de fuso, em dias.
 *
 * `rawDate` é a data LOCAL de quem treinou; o servidor só tem UTC. Entre
 * UTC-12 e UTC+14 a diferença nunca passa de um dia, então aceitar D a um dia
 * de distância do "hoje" do servidor cobre o planeta inteiro sem precisar
 * confiar num fuso informado pelo cliente (que seria só mais um campo forjável).
 */
const TZ_SLACK_DAYS = 1

/** "YYYY-MM-DD" de um Date, em UTC. */
function utcDayKey(date) {
  return date.toISOString().slice(0, 10)
}

/** Distância em dias entre duas chaves "YYYY-MM-DD". */
function dayDistance(a, b) {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)
  return Math.abs(Math.round(ms / 86400000))
}

function isValidDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** upcoming | running | ended, com a folga de fuso aplicada nas duas pontas. */
function windowState(nowKey) {
  const start = Date.parse(`${DEF.startDate}T00:00:00Z`) - TZ_SLACK_DAYS * 86400000
  const end = Date.parse(`${DEF.endDate}T00:00:00Z`) + TZ_SLACK_DAYS * 86400000
  const now = Date.parse(`${nowKey}T00:00:00Z`)
  if (now < start) return 'upcoming'
  if (now > end) return 'ended'
  return 'running'
}

async function getAdminDb() {
  const { initializeApp, cert, getApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString(),
  )
  let app
  try {
    app = getApp('challenge')
  } catch {
    app = initializeApp({ credential: cert(serviceAccount) }, 'challenge')
  }
  return getFirestore(app)
}

/**
 * A REGRA, isolada para poder ser testada sem Firestore nem rede.
 *
 * Duas travas, e as duas são necessárias:
 *
 *   1. JANELA — um dia só é confirmado se estiver a no máximo um dia do "hoje"
 *      do servidor. Mata o backfill: registrar agora um treino de cinco dias
 *      atrás não pontua, nunca.
 *
 *   2. UM POR DIA DE SERVIDOR — em cada data do relógio do servidor entra no
 *      máximo UM dia de desafio. Sem isso a folga de fuso viraria brecha: o
 *      trapaceiro reivindicaria hoje E amanhã na mesma visita e fecharia 21
 *      dias em 11. Para o usuário honesto a trava é invisível — sua data local
 *      é uma só a cada momento, e ele nunca tem dois dias para confirmar.
 *
 * @param {object} args
 * @param {string[]} args.loggedDays        Dias que o app registrou (forjáveis).
 * @param {string[]} args.alreadyConfirmed  O que o servidor já havia confirmado.
 * @param {string} [args.lastConfirmedOn]   Data DO SERVIDOR da última confirmação.
 * @param {string} args.nowKey              "YYYY-MM-DD" de hoje, em UTC.
 * @returns {{ confirmedDays: string[], pending: string[], lastConfirmedOn: string }}
 */
export function confirmChallengeDays({ loggedDays, alreadyConfirmed, lastConfirmedOn, nowKey }) {
  // Já confirmados ficam confirmados: apagar o treino depois não tira o dia
  // (nem devia — o dia aconteceu), e regravá-lo não adianta nada.
  const confirmed = new Set(
    (alreadyConfirmed ?? []).filter(isValidDayKey),
  )

  const logged = [...new Set(
    (loggedDays ?? []).filter(
      d => isValidDayKey(d) && d >= DEF.startDate && d <= DEF.endDate,
    ),
  )]

  let confirmedOn = isValidDayKey(lastConfirmedOn) ? lastConfirmedOn : ''

  // Trava 2: a cota do dia de hoje já foi usada.
  if (confirmedOn !== nowKey && confirmed.size < DEF.goalDays) {
    // Trava 1: candidatos são só os dias vizinhos de hoje ainda não contados.
    const candidates = logged
      .filter(d => !confirmed.has(d) && dayDistance(d, nowKey) <= TZ_SLACK_DAYS)
      // O mais próximo de hoje primeiro; empate vai para o mais antigo, para
      // ninguém queimar o dia de amanhã antes de ele chegar.
      .sort((a, b) => dayDistance(a, nowKey) - dayDistance(b, nowKey) || a.localeCompare(b))

    if (candidates.length > 0) {
      confirmed.add(candidates[0])
      confirmedOn = nowKey
    }
  }

  const confirmedDays = [...confirmed].sort().slice(0, DEF.goalDays)
  const kept = new Set(confirmedDays)
  return {
    confirmedDays,
    pending: logged.filter(d => !kept.has(d)).sort(),
    lastConfirmedOn: confirmedOn,
  }
}

/** Resposta pública de uma entrada — nunca devolve dado de outro usuário. */
function publicEntry(entry) {
  return {
    daysDone: entry?.daysDone ?? 0,
    confirmedDays: entry?.confirmedDays ?? [],
    lastDay: entry?.lastDay ?? '',
    updatedAt: entry?.updatedAt ?? 0,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await verifyToken(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const uid = user.localId

  // O placar muda no máximo uma vez por dia; 20 chamadas por minuto já é folga
  // enorme para o app abrir, sincronizar e o usuário registrar um treino.
  const rl = rateLimit(`challenge:${uid}`, { limit: 20, windowMs: 60_000 })
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return res.status(429).json({ error: 'Too many requests' })
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    console.error('[challenge/sync] FIREBASE_SERVICE_ACCOUNT_B64 ausente — placar desligado')
    return res.status(503).json({ error: 'Challenge scoring not configured' })
  }

  let db
  try {
    db = await getAdminDb()
  } catch (err) {
    console.error('[challenge/sync] firebase-admin indisponível:', err.message)
    return res.status(503).json({ error: 'Challenge scoring unavailable' })
  }

  const entryRef = db.doc(`challenges/${DEF.id}/entries/${uid}`)
  const action = req.body?.action === 'forget' ? 'forget' : 'sync'

  // LGPD: o cliente não pode mais apagar a própria entrada (não escreve em
  // `challenges/`), então a exclusão de conta pede a remoção por aqui.
  if (action === 'forget') {
    await entryRef.delete().catch(() => {})
    return res.json({ ok: true, forgotten: true })
  }

  const nowKey = utcDayKey(new Date())
  const state = windowState(nowKey)
  const existing = (await entryRef.get()).data() ?? null

  // Fora da janela nada é gravado. Depois do fim isso é o que SELA o resultado:
  // ninguém acrescenta dia nenhum ao placar de um desafio já encerrado.
  if (state !== 'running') {
    return res.json({ ok: true, state, entry: publicEntry(existing), def: { id: DEF.id } })
  }

  // Os treinos do próprio usuário. Forjáveis por ele — por isso a data de cada
  // um vale menos do que o momento em que ESTE servidor os viu.
  const workoutsSnap = await db.doc(`users/${uid}/data/workouts`).get()
  const items = workoutsSnap.data()?.items
  const loggedDays = Array.isArray(items) ? items.map(w => w?.rawDate) : []

  const { confirmedDays, pending, lastConfirmedOn } = confirmChallengeDays({
    loggedDays,
    alreadyConfirmed: existing?.confirmedDays,
    lastConfirmedOn: existing?.lastConfirmedOn,
    nowKey,
  })
  const daysDone = confirmedDays.length

  // O nome vem do token verificado, não do corpo da requisição: senão qualquer
  // um escreveria o nome que quisesse no placar público.
  const displayName = (user.displayName || user.email?.split('@')[0] || 'Atleta').slice(0, 80)

  const entry = {
    uid,
    displayName,
    daysDone,
    confirmedDays,
    // Guardado no documento do servidor, que o cliente não pode escrever —
    // é o que faz a cota de um dia por data do servidor valer alguma coisa.
    lastConfirmedOn,
    lastDay: confirmedDays[confirmedDays.length - 1] ?? '',
    updatedAt: Date.now(),
  }
  await entryRef.set(entry, { merge: true })

  // `pending` é o que o app registrou mas o servidor não pôde confirmar — quase
  // sempre backfill. A tela usa isso para explicar a diferença em vez de deixar
  // o número simplesmente não bater.
  return res.json({
    ok: true,
    state,
    entry: publicEntry(entry),
    pending,
    def: { id: DEF.id },
  })
}
