// POST /api/push/send
// Envia uma notificação Web Push para o usuário autenticado.
//
// O DESTINO NÃO VEM DO CORPO DA REQUISIÇÃO. A inscrição é lida do Firestore
// (`users/{uid}/data/pushSubscription`) usando o uid do token verificado — do
// contrário qualquer usuário logado poderia fazer este servidor assinar, com as
// nossas chaves VAPID, um push para um endpoint arbitrário que ele escolhesse.
// O corpo só carrega o texto da mensagem, e mesmo esse é limitado.
//
// Required env vars (set in .env and Vercel dashboard):
//   VAPID_PUBLIC_KEY   — same value as VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY  — secret, never expose to client
//   VAPID_EMAIL        — e.g. mailto:contato@therisepln.com.br
//   FIREBASE_SERVICE_ACCOUNT_B64 — mesma variável do cron de push
//
// Generate keys once: npx web-push generate-vapid-keys

import webpush from 'web-push'
import { verifyToken } from '../ai/_auth.js'
import { rateLimit } from '../ai/_rateLimit.js'
import { getAdminDb } from '../_admin.js'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:contato@therisepln.com.br',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
)

/** Texto vindo do cliente: recortado para caber num balão de notificação. */
function clamp(value, max, fallback) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : fallback
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await verifyToken(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Push custa envio e é gatilho fácil de abuso: um punhado por minuto basta
  // para os usos legítimos (testar o aviso, disparo manual do próprio app).
  const rl = await rateLimit(`push:${user.localId}`, { limit: 10, windowMs: 60_000 })
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' })
  }

  if (!process.env.VAPID_PRIVATE_KEY) {
    return res.status(501).json({ error: 'VAPID not configured' })
  }

  const adminDb = await getAdminDb()
  if (!adminDb) return res.status(501).json({ error: 'Admin credentials not configured' })

  const subRef = adminDb
    .collection('users').doc(user.localId)
    .collection('data').doc('pushSubscription')

  const snap = await subRef.get()
  if (!snap.exists || !snap.data()?.endpoint) {
    return res.status(404).json({ error: 'Nenhuma inscrição de push para este usuário' })
  }

  const { title, body } = req.body ?? {}

  try {
    await webpush.sendNotification(
      snap.data(),
      JSON.stringify({
        title: clamp(title, 80, '⚡ Rise Plan'),
        body:  clamp(body, 200, 'Hora de verificar seus hábitos!'),
        url:   '/',
      }),
    )
    res.json({ ok: true })
  } catch (err) {
    // 410/404 = inscrição expirada ou revogada pelo navegador: limpa o
    // documento para o cron não insistir num destino morto.
    if (err.statusCode === 410 || err.statusCode === 404) {
      await subRef.delete().catch(() => {})
      return res.status(410).json({ error: 'Inscrição expirada — refaça a inscrição no app' })
    }
    const status = err.statusCode ?? 500
    res.status(status).json({ error: err.body ?? err.message })
  }
}
