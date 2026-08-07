// Acesso ao Firestore pelo lado do servidor (funções de push e webhook).
//
// Configuração necessária:
//   1. npm install firebase-admin
//   2. Firebase Console → Project Settings → Service Accounts → gerar chave
//   3. base64: node -e "console.log(Buffer.from(require('fs').readFileSync('key.json')).toString('base64'))"
//   4. FIREBASE_SERVICE_ACCOUNT_B64 no .env e nas variáveis da Vercel
//
// Sem a variável, `getAdminDb()` devolve null e quem chama vira no-op.

let cachedDb = null

export function isAdminConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_B64)
}

export async function getAdminDb() {
  if (cachedDb) return cachedDb
  if (!isAdminConfigured()) return null

  const { initializeApp, cert, getApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString(),
  )

  let app
  try {
    app = getApp('rise-server')
  } catch {
    app = initializeApp({ credential: cert(serviceAccount) }, 'rise-server')
  }

  cachedDb = getFirestore(app)
  return cachedDb
}

/** Documento `users/{uid}/data/{name}`, ou null se não existir. */
export async function readUserDoc(db, uid, name) {
  const snap = await db.doc(`users/${uid}/data/${name}`).get()
  return snap.exists ? snap.data() : null
}

export async function writeUserDoc(db, uid, name, data) {
  await db.doc(`users/${uid}/data/${name}`).set(data, { merge: true })
}
