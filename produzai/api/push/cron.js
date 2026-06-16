// GET /api/push/cron
// Daily cron that sends push notifications to all subscribed users.
// Triggered by Vercel Cron (see vercel.json). Protected by CRON_SECRET.
//
// To activate this cron you need firebase-admin to read Firestore server-side:
//   1. npm install firebase-admin
//   2. Go to Firebase Console → Project Settings → Service Accounts
//   3. Click "Generate new private key" → download JSON
//   4. base64 encode: node -e "console.log(Buffer.from(require('fs').readFileSync('key.json')).toString('base64'))"
//   5. Add FIREBASE_SERVICE_ACCOUNT_B64 to .env and Vercel env vars
//
// Until then the cron is a no-op.

import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:contato@therisepln.com.br',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
)

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64 || !process.env.VAPID_PRIVATE_KEY) {
    console.log('[push/cron] Not configured — skipping')
    return res.json({ sent: 0, reason: 'not configured' })
  }

  // ── Read all push subscriptions from Firestore ────────────────────────────
  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore }        = await import('firebase-admin/firestore')

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString(),
  )

  let adminApp
  try {
    const { getApp } = await import('firebase-admin/app')
    adminApp = getApp('cron')
  } catch {
    adminApp = initializeApp({ credential: cert(serviceAccount) }, 'cron')
  }

  const adminDb = getFirestore(adminApp)
  // Each user stores their subscription at: users/{uid}/data/pushSubscription
  // We need a collection-group query across all users:
  const snap = await adminDb.collectionGroup('data')
    .where('endpoint', '!=', null)   // only docs that look like push subscriptions
    .get()

  const payload = JSON.stringify({
    title: '⚡ Rise Plan',
    body:  'Hora de verificar seus hábitos e treino do dia!',
    url:   '/',
  })

  let sent = 0
  await Promise.allSettled(
    snap.docs
      .filter(d => d.id === 'pushSubscription' && d.data().endpoint)
      .map(async d => {
        try {
          await webpush.sendNotification(d.data(), payload)
          sent++
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired — clean up
            await d.ref.delete()
          }
        }
      }),
  )

  console.log(`[push/cron] sent=${sent}`)
  res.json({ sent })
}
