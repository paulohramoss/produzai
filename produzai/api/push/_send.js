// Envio de Web Push com limpeza de inscrições mortas.

import webpush from 'web-push'

let configured = false

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

function ensureVapid() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:contato@therisepln.com.br',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || '',
  )
  configured = true
}

/**
 * Envia uma notificação para um usuário.
 * @returns 'sent' | 'expired' (inscrição morta, já removida) | 'error' | 'skipped'
 */
export async function sendToUser(db, uid, payload) {
  if (!isPushConfigured()) return 'skipped'
  ensureVapid()

  const ref = db.doc(`users/${uid}/data/pushSubscription`)
  const snap = await ref.get()
  if (!snap.exists) return 'skipped'

  const subscription = snap.data()
  if (!subscription?.endpoint) return 'skipped'

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return 'sent'
  } catch (err) {
    // 404/410 = o navegador descartou a inscrição; guardar não adianta mais.
    if (err.statusCode === 410 || err.statusCode === 404) {
      await ref.delete().catch(() => {})
      return 'expired'
    }
    return 'error'
  }
}
