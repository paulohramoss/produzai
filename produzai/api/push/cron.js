// GET /api/push/cron
// Coaching proativo: percorre os usuários com inscrição de push ativa, avalia
// os gatilhos em cima do snapshot que o app publicou e envia NO MÁXIMO uma
// notificação relevante por usuário por dia.
//
// A diferença para a versão anterior é o conteúdo: em vez da mesma frase para
// todo mundo, cada envio tem um motivo tirado dos dados daquele atleta.
//
// Acionado pelo Vercel Cron (ver vercel.json) e protegido por CRON_SECRET.
// Sem FIREBASE_SERVICE_ACCOUNT_B64 e VAPID_PRIVATE_KEY o cron é no-op — ver
// `_firebase.js` para a configuração.

import { getAdminDb, isAdminConfigured } from './_firebase.js'
import { isPushConfigured, sendToUser } from './_send.js'
import { pickNotification, localHour } from './_triggers.js'

// Fora dessa faixa (hora local do usuário) ninguém quer ser notificado.
// A janela é larga porque o cron roda uma vez por dia (12:00 UTC = 9h em
// Brasília): apertá-la deixaria usuários em outros fusos sem notificação alguma.
const EARLIEST_HOUR = 6
const LATEST_HOUR = 22

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!isAdminConfigured() || !isPushConfigured()) {
    console.log('[push/cron] Not configured — skipping')
    return res.json({ sent: 0, reason: 'not configured' })
  }

  const db = await getAdminDb()

  // Um doc `pushSubscription` por usuário; o path dá o uid.
  const subs = await db.collectionGroup('data').where('endpoint', '!=', null).get()

  const stats = { candidates: 0, sent: 0, quiet: 0, noTrigger: 0, expired: 0, errors: 0 }
  const now = Date.now()

  await Promise.allSettled(subs.docs.map(async doc => {
    if (doc.id !== 'pushSubscription') return
    // users/{uid}/data/pushSubscription
    const uid = doc.ref.parent.parent?.id
    if (!uid) return

    stats.candidates++

    try {
      const [snapshotSnap, stateSnap] = await Promise.all([
        db.doc(`users/${uid}/data/coachSnapshot`).get(),
        db.doc(`users/${uid}/data/pushState`).get(),
      ])

      const snapshot = snapshotSnap.exists ? snapshotSnap.data() : null
      if (!snapshot) { stats.noTrigger++; return }

      const hour = localHour(snapshot.timeZone, new Date(now))
      if (hour < EARLIEST_HOUR || hour > LATEST_HOUR) { stats.quiet++; return }

      const state = stateSnap.exists ? stateSnap.data() : {}

      // Teto absoluto: um envio por dia, aconteça o que acontecer.
      if (state.lastSentAt && now - state.lastSentAt < 20 * 60 * 60 * 1000) {
        stats.noTrigger++
        return
      }

      const notification = pickNotification(snapshot, state.history ?? {}, now)
      if (!notification) { stats.noTrigger++; return }

      const result = await sendToUser(db, uid, {
        title: notification.title,
        body: notification.body,
        url: notification.url || '/',
      })

      if (result === 'sent') {
        stats.sent++
        await db.doc(`users/${uid}/data/pushState`).set({
          lastSentAt: now,
          lastKey: notification.key,
          history: { ...(state.history ?? {}), [notification.key]: now },
        }, { merge: true })
      } else if (result === 'expired') {
        stats.expired++
      }
    } catch (err) {
      stats.errors++
      console.error(`[push/cron] uid=${uid}:`, err.message)
    }
  }))

  console.log('[push/cron]', JSON.stringify(stats))
  res.json(stats)
}
