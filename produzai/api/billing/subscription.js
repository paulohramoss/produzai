// /api/billing/subscription — a assinatura mensal, do ponto de vista do app.
//
//   GET     → "estou em dia?"            (o app pergunta a cada abertura)
//   POST    → criar assinatura           (devolve o link da fatura do Asaas)
//   DELETE  → cancelar                   (o período já pago continua valendo)
//
// Precisa de ASAAS_API_KEY, FIREBASE_API_KEY (validação do token) e
// FIREBASE_SERVICE_ACCOUNT_B64 (escrita em `billing/`, que o cliente não pode
// fazer). Sem elas o endpoint responde 503 e o app mostra o paywall com um
// aviso de indisponibilidade — nunca libera o acesso.

import { verifyToken } from '../ai/_auth.js'
import { rateLimit } from '../ai/_rateLimit.js'
import { getAdminDb } from '../_admin.js'
import {
  asaasConfigured, findOrCreateCustomer, createSubscription,
  firstOpenInvoiceUrl, subscriptionPayments, cancelSubscription,
  PLAN_VALUE_BRL,
} from '../_asaas.js'
import {
  getEntitlement, publicBilling, billingRef, ensureFreeAccessDoc,
  paidUntil, PAID_STATUSES,
} from '../_entitlement.js'

/**
 * Validação de CPF/CNPJ pelos dígitos verificadores.
 *
 * O Asaas recusa documento inválido com um erro genérico; conferir aqui troca
 * uma ida à API por uma mensagem que diz o que está errado. Não é checagem de
 * existência — só de formato.
 */
export function validDocument(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false
    for (const len of [9, 10]) {
      let sum = 0
      for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
      const check = (sum * 10) % 11 % 10
      if (check !== Number(d[len])) return false
    }
    return true
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false
    const calc = (len) => {
      const weights = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]
      let sum = 0
      for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]
      const rest = sum % 11
      return rest < 2 ? 0 : 11 - rest
    }
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
  }
  return false
}

function serviceUnavailable(res, what) {
  console.error(`[billing] ${what} — assinatura desligada`)
  return res.status(503).json({ error: 'Cobrança indisponível no momento.', reason: 'not-configured' })
}

/**
 * Confere no Asaas o que o webhook talvez ainda não tenha contado.
 *
 * O webhook é o caminho normal, mas ele pode atrasar, cair, ou simplesmente
 * ainda não estar configurado no primeiro dia. Sem esta reconciliação, quem
 * acabou de pagar o PIX voltaria para o app e continuaria vendo o paywall — o
 * pior momento possível para o produto parecer quebrado.
 *
 * Só roda quando NÃO há acesso: para quem já está em dia é uma chamada de rede
 * a troco de nada.
 */
async function reconcile(db, uid, doc) {
  if (!doc?.asaasSubscriptionId) return null

  const payments = await subscriptionPayments(doc.asaasSubscriptionId)
  const paid = payments
    .filter(p => PAID_STATUSES.has(p.status))
    .sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)))[0]
  if (!paid) return null

  const until = paidUntil(paid)
  if (until <= Number(doc.activeUntil || 0)) return null

  const patch = {
    status:        'active',
    activeUntil:   until,
    lastPaymentId: paid.id,
    lastEvent:     'RECONCILED',
    updatedAt:     Date.now(),
  }
  await billingRef(db, uid).set(patch, { merge: true })
  return { ...doc, ...patch }
}

// ── GET: situação da assinatura ──────────────────────────────────────────────

async function handleGet(req, res, user) {
  // Mantém `billing/{uid}` coerente com a allowlist: as REGRAS do Firestore
  // leem o documento, não as variáveis de ambiente.
  await ensureFreeAccessDoc(user)

  const ent = await getEntitlement(user)
  if (ent.active) {
    return res.json({ ...publicBilling(ent.doc, ent), priceBRL: PLAN_VALUE_BRL })
  }

  if (ent.reason === 'unavailable') return serviceUnavailable(res, 'firebase-admin indisponível')

  // Sem acesso: vale a pena perguntar ao Asaas antes de mostrar o paywall.
  if (asaasConfigured() && ent.doc?.asaasSubscriptionId) {
    const db = await getAdminDb('billing')
    const fixed = db ? await reconcile(db, user.localId, ent.doc).catch(e => {
      console.error('[billing] reconciliação falhou:', e.message)
      return null
    }) : null
    if (fixed) {
      return res.json({
        ...publicBilling(fixed, { active: true, reason: 'paid' }),
        priceBRL: PLAN_VALUE_BRL,
      })
    }
  }

  return res.json({ ...publicBilling(ent.doc, ent), priceBRL: PLAN_VALUE_BRL })
}

// ── POST: criar (ou recuperar) a assinatura ──────────────────────────────────

async function handlePost(req, res, user) {
  if (!asaasConfigured()) return serviceUnavailable(res, 'ASAAS_API_KEY ausente')

  const db = await getAdminDb('billing')
  if (!db) return serviceUnavailable(res, 'FIREBASE_SERVICE_ACCOUNT_B64 ausente')

  const ent = await getEntitlement(user)
  if (ent.active) {
    return res.json({ alreadyActive: true, ...publicBilling(ent.doc, ent) })
  }

  const uid = user.localId
  const existing = ent.doc

  // Assinatura já criada e ainda esperando pagamento: devolve o MESMO link, não
  // um segundo boleto. Duas assinaturas para a mesma pessoa é cobrança em
  // duplicidade — o tipo de erro que o cliente descobre no extrato.
  if (existing?.asaasSubscriptionId) {
    const { invoiceUrl } = await firstOpenInvoiceUrl(existing.asaasSubscriptionId, { attempts: 2 })
    if (invoiceUrl) {
      return res.json({ invoiceUrl, subscriptionId: existing.asaasSubscriptionId, reused: true })
    }
  }

  const name = String(req.body?.name || user.displayName || user.email?.split('@')[0] || '').trim().slice(0, 100)
  const cpfCnpj = String(req.body?.cpfCnpj || '').replace(/\D/g, '')
  const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(0, 13)

  if (!name) return res.status(400).json({ error: 'Informe seu nome completo.' })
  if (!validDocument(cpfCnpj)) return res.status(400).json({ error: 'CPF ou CNPJ inválido.' })
  if (!user.email) return res.status(400).json({ error: 'Conta sem e-mail — não é possível cobrar.' })

  const cust = await findOrCreateCustomer({ uid, name, email: user.email, cpfCnpj, phone })
  if (!cust.ok) return res.status(400).json({ error: cust.error })

  const sub = await createSubscription({ customerId: cust.customer.id, uid })
  if (!sub.ok) return res.status(400).json({ error: sub.error })

  const { invoiceUrl } = await firstOpenInvoiceUrl(sub.subscription.id)

  await billingRef(db, uid).set({
    uid,
    email:               user.email,
    status:              'pending',
    plan:                'monthly',
    value:               PLAN_VALUE_BRL,
    asaasCustomerId:     cust.customer.id,
    asaasSubscriptionId: sub.subscription.id,
    canceledAt:          null,
    createdAt:           existing?.createdAt ?? Date.now(),
    updatedAt:           Date.now(),
  }, { merge: true })

  // O mapa cliente→uid é o plano B do webhook: se um dia chegar uma cobrança
  // sem `externalReference` (cobrança avulsa criada no painel, por exemplo),
  // ainda dá para saber de quem é.
  await db.doc(`billingCustomers/${cust.customer.id}`)
    .set({ uid, updatedAt: Date.now() }, { merge: true })
    .catch(e => console.error('[billing] mapa de cliente não gravado:', e.message))

  if (!invoiceUrl) {
    // A assinatura existe; só a fatura ainda não apareceu. O app manda o
    // usuário tentar de novo em instantes, e o POST seguinte reaproveita.
    return res.status(202).json({
      pending: true,
      subscriptionId: sub.subscription.id,
      error: 'Assinatura criada — a fatura está sendo gerada. Tente abrir em instantes.',
    })
  }

  return res.json({ invoiceUrl, subscriptionId: sub.subscription.id })
}

// ── DELETE: cancelar ─────────────────────────────────────────────────────────

async function handleDelete(req, res, user) {
  const db = await getAdminDb('billing')
  if (!db) return serviceUnavailable(res, 'FIREBASE_SERVICE_ACCOUNT_B64 ausente')

  const snap = await billingRef(db, user.localId).get()
  const doc = snap.exists ? snap.data() : null
  if (!doc?.asaasSubscriptionId) return res.json({ ok: true, canceled: false })

  if (asaasConfigured()) await cancelSubscription(doc.asaasSubscriptionId)

  // `activeUntil` NÃO é zerado: quem pagou o mês tem direito ao mês. O que o
  // cancelamento faz é impedir a próxima cobrança.
  await billingRef(db, user.localId).set({
    status:              'canceled',
    canceledAt:          Date.now(),
    asaasSubscriptionId: null,
    updatedAt:           Date.now(),
  }, { merge: true })

  return res.json({ ok: true, canceled: true })
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const user = await verifyToken(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Teto generoso para a consulta (o app pergunta ao abrir e enquanto espera o
  // pagamento) e apertado o bastante para não virar torneira de chamadas ao
  // Asaas.
  const rl = await rateLimit(`billing:${user.localId}`, { limit: 40, windowMs: 60_000 })
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' })
  }

  try {
    if (req.method === 'GET')    return await handleGet(req, res, user)
    if (req.method === 'POST')   return await handlePost(req, res, user)
    if (req.method === 'DELETE') return await handleDelete(req, res, user)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('[billing] erro inesperado:', e)
    return res.status(500).json({ error: 'Erro ao consultar a assinatura.' })
  }
}
