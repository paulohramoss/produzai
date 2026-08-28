// A lógica de cobrança que dá para testar sem Asaas, sem Firestore e sem rede.
//
// O que está coberto aqui é exatamente o que erra caro: o mapeamento de evento
// para acesso (um `PAYMENT_OVERDUE` que zerasse `activeUntil` cortaria quem
// está em dia), a conta de até quando o mês pago vale, e a validação de
// documento que decide se a cobrança chega a ser emitida.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { patchForEvent } from './webhook.js'
import { validDocument } from './subscription.js'
import { paidUntil, isFreeAccess, PAID_STATUSES } from '../_entitlement.js'

const DAY = 86400000

// ── patchForEvent ────────────────────────────────────────────────────────────

test('pagamento confirmado libera acesso até um mês após o vencimento', () => {
  const patch = patchForEvent('PAYMENT_CONFIRMED', {
    payment: { id: 'pay_1', dueDate: '2026-03-10', value: 20 },
  })
  assert.equal(patch.status, 'active')
  assert.equal(patch.lastPaymentId, 'pay_1')
  // 10/03 + 1 mês + 3 dias de tolerância (padrão)
  const expected = Date.parse('2026-04-10T00:00:00Z') + 3 * DAY
  assert.equal(patch.activeUntil, expected)
})

test('PIX recebido vale o mesmo que confirmado', () => {
  const a = patchForEvent('PAYMENT_RECEIVED', { payment: { id: 'p', dueDate: '2026-03-10' } })
  const b = patchForEvent('PAYMENT_CONFIRMED', { payment: { id: 'p', dueDate: '2026-03-10' } })
  assert.deepEqual(a, b)
})

test('cobrança gerada NÃO mexe no acesso do ciclo anterior', () => {
  const patch = patchForEvent('PAYMENT_CREATED', { payment: { id: 'pay_2', dueDate: '2026-04-10' } })
  assert.equal('activeUntil' in patch, false)
  assert.equal('status' in patch, false)
})

test('atraso muda o status mas não corta o acesso na marra', () => {
  const patch = patchForEvent('PAYMENT_OVERDUE', { payment: { id: 'pay_3' } })
  assert.equal(patch.status, 'overdue')
  // `activeUntil` vence sozinho; zerá-lo aqui tiraria os dias de tolerância.
  assert.equal('activeUntil' in patch, false)
})

test('estorno e chargeback derrubam o acesso na hora', () => {
  for (const event of ['PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED']) {
    const patch = patchForEvent(event, { payment: { id: 'x' } })
    assert.equal(patch.status, 'canceled', event)
    assert.equal(patch.activeUntil, 0, event)
  }
})

test('assinatura encerrada honra o período já pago', () => {
  const patch = patchForEvent('SUBSCRIPTION_DELETED', {})
  assert.equal(patch.status, 'canceled')
  assert.equal(patch.asaasSubscriptionId, null)
  // Sem `activeUntil`: quem pagou o mês fica com o mês.
  assert.equal('activeUntil' in patch, false)
})

test('evento desconhecido é ignorado, não interpretado', () => {
  assert.equal(patchForEvent('PAYMENT_ANTICIPATED', { payment: {} }), null)
  assert.equal(patchForEvent('', {}), null)
})

// ── paidUntil ────────────────────────────────────────────────────────────────

test('pagar adiantado não perde dias; pagar atrasado não ganha mês', () => {
  const adiantado = paidUntil({ dueDate: '2026-03-10', paymentDate: '2026-03-01' })
  const atrasado  = paidUntil({ dueDate: '2026-03-10', paymentDate: '2026-03-20' })
  assert.equal(adiantado, atrasado)
})

test('cobrança sem data não quebra a conta', () => {
  const until = paidUntil({})
  assert.ok(until > Date.now())
})

test('vencimento em 31 de janeiro não vira data inválida', () => {
  const until = paidUntil({ dueDate: '2026-01-31' })
  assert.ok(Number.isFinite(until))
  assert.ok(until > Date.parse('2026-02-28T00:00:00Z'))
})

// ── PAID_STATUSES ────────────────────────────────────────────────────────────

test('só estados de dinheiro recebido contam como pago', () => {
  assert.ok(PAID_STATUSES.has('CONFIRMED'))
  assert.ok(PAID_STATUSES.has('RECEIVED'))
  assert.equal(PAID_STATUSES.has('PENDING'), false)
  assert.equal(PAID_STATUSES.has('OVERDUE'), false)
  assert.equal(PAID_STATUSES.has('REFUNDED'), false)
})

// ── validDocument ────────────────────────────────────────────────────────────

test('CPF e CNPJ válidos passam, com ou sem máscara', () => {
  assert.ok(validDocument('529.982.247-25'))
  assert.ok(validDocument('52998224725'))
  assert.ok(validDocument('11.222.333/0001-81'))
})

test('documento inválido é recusado antes de virar chamada ao Asaas', () => {
  assert.equal(validDocument('529.982.247-26'), false)  // dígito errado
  assert.equal(validDocument('111.111.111-11'), false)  // repetido
  assert.equal(validDocument('123'), false)
  assert.equal(validDocument(''), false)
  assert.equal(validDocument(null), false)
  assert.equal(validDocument('11.222.333/0001-82'), false)
})

// ── allowlist ────────────────────────────────────────────────────────────────

test('a allowlist reconhece uid e e-mail, sem se importar com caixa', () => {
  const before = { uids: process.env.FREE_ACCESS_UIDS, emails: process.env.FREE_ACCESS_EMAILS }
  process.env.FREE_ACCESS_UIDS = 'ABC123, def456'
  process.env.FREE_ACCESS_EMAILS = 'Teste@Exemplo.com'

  assert.ok(isFreeAccess({ localId: 'abc123' }))
  assert.ok(isFreeAccess({ localId: 'DEF456' }))
  assert.ok(isFreeAccess({ localId: 'outro', email: 'teste@exemplo.com' }))
  assert.equal(isFreeAccess({ localId: 'outro', email: 'alguem@exemplo.com' }), false)
  assert.equal(isFreeAccess({}), false)

  process.env.FREE_ACCESS_UIDS = before.uids ?? ''
  process.env.FREE_ACCESS_EMAILS = before.emails ?? ''
})

test('allowlist vazia não libera ninguém', () => {
  const before = { uids: process.env.FREE_ACCESS_UIDS, emails: process.env.FREE_ACCESS_EMAILS }
  process.env.FREE_ACCESS_UIDS = ''
  process.env.FREE_ACCESS_EMAILS = ''

  assert.equal(isFreeAccess({ localId: 'qualquer', email: 'a@b.com' }), false)
  // O caso que mais assusta: string vazia não pode casar com uid vazio.
  assert.equal(isFreeAccess({ localId: '', email: '' }), false)

  process.env.FREE_ACCESS_UIDS = before.uids ?? ''
  process.env.FREE_ACCESS_EMAILS = before.emails ?? ''
})
