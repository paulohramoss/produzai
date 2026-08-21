// Acesso administrativo ao Firestore para as funções serverless.
//
// A credencial vem de FIREBASE_SERVICE_ACCOUNT_B64 (a mesma do cron de push).
// Sem ela, devolvemos null: cada endpoint decide se isso é 503 ou apenas
// "não configurado", em vez de derrubar a função na importação.
//
// O app admin é nomeado e reaproveitado — instâncias quentes da Vercel chamam
// isto várias vezes, e `initializeApp` sem nome estoura no segundo uso.

let cached = null

export async function getAdminDb(appName = 'default') {
  if (cached) return cached
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) return null

  const { initializeApp, cert, getApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString(),
  )

  let app
  try {
    app = getApp(appName)
  } catch {
    app = initializeApp({ credential: cert(serviceAccount) }, appName)
  }

  cached = getFirestore(app)
  return cached
}
