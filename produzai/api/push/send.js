// POST /api/push/send
// Sends a Web Push notification to the authenticated user's saved subscription.
//
// Required env vars (set in .env and Vercel dashboard):
//   VAPID_PUBLIC_KEY   — same value as VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY  — secret, never expose to client
//   VAPID_EMAIL        — e.g. mailto:contato@therisepln.com.br
//
// Generate keys once: npx web-push generate-vapid-keys

import webpush from 'web-push'
import { verifyToken } from '../ai/_auth.js'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:contato@therisepln.com.br',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let uid
  try {
    const user = await verifyToken(req)
    uid = user.localId
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { subscription, title, body } = req.body ?? {}
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' })
  }

  if (!process.env.VAPID_PRIVATE_KEY) {
    return res.status(501).json({ error: 'VAPID not configured' })
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: title || '⚡ Rise Plan',
        body:  body  || 'Hora de verificar seus hábitos!',
        url:   '/',
      }),
    )
    res.json({ ok: true, uid })
  } catch (err) {
    const status = err.statusCode ?? 500
    res.status(status).json({ error: err.body ?? err.message })
  }
}
