// Marca as contas internas em `billing/{uid}` — as que nunca veem o paywall.
//
//   node scripts/free-access.mjs            lista e grava
//   node scripts/free-access.mjs --dry-run  só mostra o que faria
//
// Por que existe, se `api/billing/subscription.js` já faz isso sozinho na
// primeira consulta: as REGRAS do Firestore não enxergam variáveis de ambiente,
// só o documento. Rodar isto no deploy garante que a conta de teste já esteja
// marcada ANTES da primeira escrita dela — sem depender de ela abrir o app.
//
// Lê as mesmas variáveis do servidor: FIREBASE_SERVICE_ACCOUNT_B64,
// FREE_ACCESS_UIDS e FREE_ACCESS_EMAILS. Um `.env.local` na raiz é carregado se
// existir (é o que `vercel env pull` produz).

import { readFileSync, existsSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// ── .env.local, se houver ────────────────────────────────────────────────────
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const dryRun = process.argv.includes('--dry-run')

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64
if (!b64) {
  console.error('FIREBASE_SERVICE_ACCOUNT_B64 não definida.')
  process.exit(1)
}

const app = initializeApp({
  credential: cert(JSON.parse(Buffer.from(b64, 'base64').toString())),
})
const db = getFirestore(app)
const auth = getAuth(app)

const list = (name) =>
  String(process.env[name] || '').split(',').map(s => s.trim()).filter(Boolean)

const uids = new Set(list('FREE_ACCESS_UIDS'))
const emails = list('FREE_ACCESS_EMAILS')

// E-mail → uid. Um e-mail que não existe no Auth é aviso, não erro: pode ser
// uma conta que ainda vai ser criada.
for (const email of emails) {
  try {
    const rec = await auth.getUserByEmail(email)
    uids.add(rec.uid)
    console.log(`  ${email} → ${rec.uid}`)
  } catch {
    console.warn(`  ${email} → conta não encontrada no Firebase Auth (ignorado)`)
  }
}

if (uids.size === 0) {
  console.log('Nenhuma conta interna configurada. Nada a fazer.')
  process.exit(0)
}

console.log(`\n${dryRun ? '[dry-run] ' : ''}Marcando ${uids.size} conta(s) como acesso interno:`)
for (const uid of uids) {
  console.log(`  billing/${uid}  ← { freeAccess: true }`)
  if (dryRun) continue
  await db.doc(`billing/${uid}`).set({
    uid,
    status:     'free',
    plan:       'internal',
    freeAccess: true,
    updatedAt:  Date.now(),
  }, { merge: true })
}

console.log(dryRun ? '\nNada foi gravado.' : '\nPronto.')
process.exit(0)
