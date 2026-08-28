// Quem pode usar o app — a resposta canônica, do lado do servidor.
//
// O documento `billing/{uid}` é a fonte da verdade e é ESCRITO SÓ POR AQUI
// (via firebase-admin, que passa por cima das regras). O navegador lê e nada
// mais — ver firestore.rules. Se o cliente pudesse escrever, o paywall seria
// decoração: bastaria um `setDoc` no console do navegador.
//
// Três camadas usam este módulo, e é de propósito:
//   1. /api/billing/*      — responde ao app "você está em dia?";
//   2. /api/ai/*           — recusa gastar token de LLM de quem não pagou;
//   3. firestore.rules     — lê o mesmo documento e nega escrita de dados.
// O paywall da tela é a quarta camada, e a única que não vale nada sozinha.

import { getAdminDb } from './_admin.js'
import { GRACE_DAYS } from './_asaas.js'

const DAY_MS = 86400000

/** Contas internas — testes e time. Ver FREE_ACCESS_* no .env.example. */
function allowlist(varName) {
  return String(process.env[varName] || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Acesso liberado sem pagar?
 *
 * O uid é a checagem forte (imutável, nunca reaproveitado). O e-mail existe
 * porque é o que se tem à mão ao configurar, e aqui é seguro: o Firebase Auth
 * não deixa duas contas com o mesmo e-mail, e as contas da lista já existem —
 * ninguém consegue se cadastrar com um desses endereços para herdar o acesso.
 *
 * @param {{ localId: string, email?: string }} user  Usuário do token verificado.
 */
export function isFreeAccess(user) {
  const uid = String(user?.localId || '').toLowerCase()
  const email = String(user?.email || '').toLowerCase()
  // O `!!` não é enfeite: sem ele a função devolve a string vazia em vez de
  // `false`, e um `=== false` em qualquer chamador passaria batido.
  return !!(uid && allowlist('FREE_ACCESS_UIDS').includes(uid))
      || !!(email && allowlist('FREE_ACCESS_EMAILS').includes(email))
}

/**
 * Até quando uma cobrança paga garante acesso.
 *
 * Conta a partir do VENCIMENTO, não da data do pagamento: quem paga adiantado
 * não perde dias, e quem paga com atraso não ganha um mês extra por isso. Mais
 * a tolerância, que cobre a defasagem de confirmação bancária.
 */
export function paidUntil(payment) {
  const base = payment?.dueDate || payment?.paymentDate || payment?.confirmedDate
  const ms = base ? Date.parse(`${String(base).slice(0, 10)}T00:00:00Z`) : Date.now()
  const start = Number.isNaN(ms) ? Date.now() : ms
  const d = new Date(start)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.getTime() + GRACE_DAYS * DAY_MS
}

/** Estados do Asaas que significam "dinheiro entrou". */
export const PAID_STATUSES = new Set([
  'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH',
])

/**
 * Forma pública do documento de cobrança — o que o app pode ver.
 * Nada de id de cliente do Asaas nem de dado fiscal: o app não precisa.
 */
export function publicBilling(doc, { active, reason }) {
  return {
    active,
    reason,
    status:        doc?.status ?? 'none',
    plan:          doc?.plan ?? 'monthly',
    value:         doc?.value ?? null,
    activeUntil:   doc?.activeUntil ?? null,
    freeAccess:    !!doc?.freeAccess,
    hasSubscription: !!doc?.asaasSubscriptionId,
    canceledAt:    doc?.canceledAt ?? null,
  }
}

/** Referência do documento de cobrança do usuário. */
export function billingRef(db, uid) {
  return db.doc(`billing/${uid}`)
}

/**
 * Lê o direito de uso deste usuário.
 *
 * Falha FECHADA: sem Firestore admin configurado, ninguém que não esteja na
 * allowlist entra. É o inverso do rateLimit (que falha aberto) porque aqui o
 * erro barato é o usuário legítimo ver "tente de novo" — e o erro caro é o app
 * inteiro virar gratuito por uma variável de ambiente faltando.
 *
 * @returns {Promise<{ active: boolean, reason: string, doc: object|null }>}
 */
export async function getEntitlement(user) {
  const uid = user?.localId
  if (!uid) return { active: false, reason: 'unauthenticated', doc: null }

  if (isFreeAccess(user)) {
    return { active: true, reason: 'free-access', doc: { status: 'free', freeAccess: true } }
  }

  let db
  try {
    db = await getAdminDb('billing')
  } catch (e) {
    console.error('[entitlement] admin indisponível:', e.message)
    return { active: false, reason: 'unavailable', doc: null }
  }
  if (!db) return { active: false, reason: 'unavailable', doc: null }

  const snap = await billingRef(db, uid).get()
  const doc = snap.exists ? snap.data() : null

  if (!doc) return { active: false, reason: 'no-subscription', doc: null }
  if (doc.freeAccess) return { active: true, reason: 'free-access', doc }

  const until = Number(doc.activeUntil || 0)
  if (until > Date.now()) return { active: true, reason: 'paid', doc }

  return { active: false, reason: doc.status === 'pending' ? 'awaiting-payment' : 'expired', doc }
}

/**
 * Grava a marca de conta interna, se for o caso.
 *
 * Existe para que as REGRAS do Firestore — que não enxergam variáveis de
 * ambiente — vejam a mesma verdade que este módulo. Sem isto, a conta de teste
 * passaria pelos endpoints e apanharia na escrita direta do SDK.
 */
export async function ensureFreeAccessDoc(user) {
  if (!isFreeAccess(user)) return
  let db
  try { db = await getAdminDb('billing') } catch { return }
  if (!db) return
  await billingRef(db, user.localId).set({
    uid:        user.localId,
    email:      user.email ?? null,
    status:     'free',
    plan:       'internal',
    freeAccess: true,
    updatedAt:  Date.now(),
  }, { merge: true }).catch(e => console.error('[entitlement] free access não gravado:', e.message))
}

/**
 * Porteiro para os endpoints caros (/api/ai/*).
 * Responde e devolve `true` quando BARROU — quem chama só precisa dar `return`.
 */
export async function blockIfUnpaid(req, res, user) {
  const ent = await getEntitlement(user)
  if (ent.active) return false
  res.status(402).json({
    error: 'Assinatura necessária para usar este recurso.',
    reason: ent.reason,
  })
  return true
}
