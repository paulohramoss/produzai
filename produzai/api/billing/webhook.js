// POST /api/billing/webhook — o Asaas avisando que algo mudou.
//
// É por aqui que o dinheiro vira acesso. O app NUNCA declara que pagou: ele
// pergunta a `/api/billing/subscription`, que lê o que este webhook gravou.
//
// ── Autenticação ─────────────────────────────────────────────────────────────
//
// O endpoint é público (o Asaas não tem como fazer login). O que separa o Asaas
// de qualquer um com a URL é o header `asaas-access-token`, cujo valor você
// define no painel e repete em ASAAS_WEBHOOK_TOKEN. Sem essa variável o
// endpoint recusa TUDO: um webhook aberto é um botão de "liberar acesso de
// graça" exposto na internet.
//
// ── Reentrega ────────────────────────────────────────────────────────────────
//
// O Asaas reenvia o que não recebeu 200 — e enfileira as entregas seguintes até
// a fila destravar. Por isso: qualquer evento autenticado e compreendido sai
// com 200, mesmo o que ignoramos. Só falha de infraestrutura devolve 500, que é
// exatamente o caso em que reenviar adianta.

import crypto from 'node:crypto'
import { getAdminDb } from '../_admin.js'
import { billingRef, paidUntil, PAID_STATUSES } from '../_entitlement.js'

/** Comparação de segredos em tempo constante. */
function tokenMatches(received, expected) {
  const a = Buffer.from(String(received || ''))
  const b = Buffer.from(String(expected || ''))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * De quem é este evento.
 *
 * `externalReference` é o caminho normal — nós o gravamos na assinatura e o
 * Asaas o copia para cada cobrança. O mapa `billingCustomers` cobre o resto:
 * cobrança criada à mão no painel, importação, assinatura antiga.
 */
async function resolveUid(db, body) {
  const ref = body?.payment?.externalReference || body?.subscription?.externalReference
  if (ref) return String(ref)

  const customerId = body?.payment?.customer || body?.subscription?.customer
  if (!customerId) return null

  const snap = await db.doc(`billingCustomers/${customerId}`).get()
  if (snap.exists) return snap.data()?.uid ?? null

  // Último recurso: procurar pelo id do cliente no próprio documento.
  const q = await db.collection('billing').where('asaasCustomerId', '==', customerId).limit(1).get()
  return q.empty ? null : q.docs[0].id
}

/**
 * O que cada evento faz com o acesso.
 *
 * @returns {object|null} Campos a mesclar em `billing/{uid}`, ou null p/ ignorar.
 */
export function patchForEvent(event, body) {
  const payment = body?.payment ?? null
  const now = Date.now()

  switch (event) {
    // ── Dinheiro entrou ──────────────────────────────────────────────────
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_RECEIVED_IN_CASH':
      return {
        status:        'active',
        activeUntil:   paidUntil(payment),
        lastPaymentId: payment?.id ?? null,
        value:         payment?.value ?? null,
      }

    // ── Cobrança gerada, ainda não paga ──────────────────────────────────
    // Não mexe em `activeUntil`: o ciclo anterior, se pago, continua valendo
    // até vencer. Rebaixar aqui cortaria o acesso de quem está em dia no dia
    // em que a próxima fatura nasce.
    case 'PAYMENT_CREATED':
    case 'PAYMENT_UPDATED':
    case 'PAYMENT_AWAITING_RISK_ANALYSIS':
      return { lastPaymentId: payment?.id ?? null, pendingSince: now }

    // ── Não pagou ────────────────────────────────────────────────────────
    // `activeUntil` também não é tocado: ele já vai vencer sozinho. O status
    // serve para a tela poder dizer "sua fatura está em atraso" em vez de um
    // paywall mudo.
    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
      return { status: 'overdue' }

    // ── Dinheiro voltou / cobrança morreu ────────────────────────────────
    // Aqui SIM o acesso cai na hora: estorno e chargeback significam que o
    // pagamento daquele ciclo deixou de existir.
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_PARTIALLY_REFUNDED':
    case 'PAYMENT_REVERSED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':
    case 'PAYMENT_DELETED':
      return { status: 'canceled', activeUntil: 0 }

    // ── Assinatura encerrada ─────────────────────────────────────────────
    // O período já pago é honrado — só não haverá o próximo.
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED':
      return { status: 'canceled', canceledAt: now, asaasSubscriptionId: null }

    default:
      return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expected) {
    console.error('[billing/webhook] ASAAS_WEBHOOK_TOKEN ausente — recusando tudo')
    return res.status(503).json({ error: 'Webhook not configured' })
  }
  const received = req.headers['asaas-access-token']
  if (!tokenMatches(received, expected)) {
    console.warn('[billing/webhook] token inválido')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = req.body ?? {}
  const event = String(body.event || '')
  if (!event) return res.status(400).json({ error: 'Evento ausente' })

  let db
  try {
    db = await getAdminDb('billing')
  } catch (e) {
    console.error('[billing/webhook] admin indisponível:', e.message)
    return res.status(500).json({ error: 'Storage unavailable' })
  }
  if (!db) return res.status(500).json({ error: 'Storage unavailable' })

  try {
    // Idempotência: o Asaas reentrega, e reentregar um estorno depois de uma
    // confirmação em ordem trocada bagunçaria o acesso. O id do evento é a
    // trava; sem id, seguimos em frente (nada pior que descartar o evento).
    const eventId = body.id ? String(body.id).replace(/\//g, '_') : null
    if (eventId) {
      const seen = db.doc(`billingEvents/${eventId}`)
      const already = await seen.get()
      if (already.exists) return res.json({ ok: true, duplicate: true })
      await seen.set({
        event, receivedAt: Date.now(),
        // TTL do Firestore no campo `expiresAt` limpa isto sozinho (90 dias).
        expiresAt: new Date(Date.now() + 90 * 86400000),
      })
    }

    const patch = patchForEvent(event, body)
    if (!patch) return res.json({ ok: true, ignored: event })

    const uid = await resolveUid(db, body)
    if (!uid) {
      // Não é erro nosso: cobrança que não pertence a nenhum usuário do app
      // (teste feito no painel, por exemplo). Reenviar não resolveria.
      console.warn('[billing/webhook] evento sem usuário:', event, body?.payment?.customer)
      return res.json({ ok: true, unmatched: true })
    }

    await billingRef(db, uid).set({
      ...patch,
      uid,
      lastEvent: event,
      updatedAt: Date.now(),
    }, { merge: true })

    return res.json({ ok: true })
  } catch (e) {
    console.error('[billing/webhook] falha ao processar:', e)
    return res.status(500).json({ error: 'Processing failed' })
  }
}
