// A regra do placar do desafio, testada sem rede nem Firestore.
//
//   node --test api/
//
// Estes testes existem porque `confirmChallengeDays` é o que separa o prêmio
// de uma briga: se ela afrouxar, alguém leva o whey sem treinar e o desafio
// morre na primeira edição. Cada bloco abaixo é um ataque concreto.

import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmChallengeDays } from './sync.js'

/** Dia N de setembro de 2026 — a janela declarada em challenge.json. */
const dia = n => `2026-09-${String(n).padStart(2, '0')}`
const TODOS_21 = Array.from({ length: 21 }, (_, i) => dia(i + 1))

/** Uma visita ao servidor, encadeando o estado anterior. */
function visita(estado, { loggedDays, nowKey }) {
  return confirmChallengeDays({
    loggedDays,
    alreadyConfirmed: estado.confirmedDays,
    lastConfirmedOn: estado.lastConfirmedOn,
    nowKey,
  })
}

const ZERO = { confirmedDays: [], lastConfirmedOn: '' }

test('fraude: gravar os 21 dias de uma vez no dia 3 rende 1 dia', () => {
  const r = visita(ZERO, { loggedDays: TODOS_21, nowKey: dia(3) })
  assert.deepEqual(r.confirmedDays, [dia(3)])
  assert.equal(r.pending.length, 20)
})

test('fraude: reivindicar hoje e amanhã na mesma visita rende 1 dia', () => {
  // A folga de fuso aceita o dia vizinho; sem a cota diária isso deixaria
  // qualquer um fechar 21 dias em 11 visitas.
  const r = visita(ZERO, { loggedDays: [dia(3), dia(4)], nowKey: dia(3) })
  assert.deepEqual(r.confirmedDays, [dia(3)], 'entra o de hoje, não o de amanhã')
})

test('fraude: martelar o endpoint no mesmo dia não acumula', () => {
  let estado = ZERO
  for (let i = 0; i < 50; i++) {
    estado = visita(estado, { loggedDays: TODOS_21, nowKey: dia(5) })
  }
  assert.equal(estado.confirmedDays.length, 1)
})

test('fraude: backfill no fim do desafio não pontua', () => {
  const r = confirmChallengeDays({
    loggedDays: [dia(1), dia(2), dia(3), dia(4), dia(5)],
    alreadyConfirmed: [dia(1)],
    lastConfirmedOn: dia(1),
    nowKey: dia(20),
  })
  assert.deepEqual(r.confirmedDays, [dia(1)], 'só sobra o que já estava confirmado')
})

test('honesto: treinar e abrir o app todo dia fecha os 21', () => {
  let estado = ZERO
  for (let d = 1; d <= 21; d++) {
    const registrados = Array.from({ length: d }, (_, i) => dia(i + 1))
    estado = visita(estado, { loggedDays: registrados, nowKey: dia(d) })
  }
  assert.equal(estado.confirmedDays.length, 21)
})

test('honesto: data local deslocada do UTC continua valendo', () => {
  // O servidor só tem UTC; a data do treino é local. A folga de um dia cobre
  // de UTC-12 a UTC+14 sem precisar confiar num fuso enviado pelo cliente.
  assert.equal(visita(ZERO, { loggedDays: [dia(5)], nowKey: dia(4) }).confirmedDays.length, 1)
  assert.equal(visita(ZERO, { loggedDays: [dia(4)], nowKey: dia(5) }).confirmedDays.length, 1)
})

test('honesto: um dia sem sincronizar ainda é recuperável no dia seguinte', () => {
  let estado = visita(ZERO, { loggedDays: [dia(1)], nowKey: dia(1) })
  // Não abriu o app no dia 2. Volta no dia 3 com os treinos 2 e 3 registrados.
  estado = visita(estado, { loggedDays: [dia(1), dia(2), dia(3)], nowKey: dia(3) })
  assert.equal(estado.confirmedDays.length, 2, 'recupera um — o outro passou do prazo')
})

test('treino fora da janela é ignorado, não fica pendente', () => {
  const r = visita(ZERO, { loggedDays: ['2026-08-31', '2026-09-22'], nowKey: dia(1) })
  assert.deepEqual(r.confirmedDays, [])
  assert.deepEqual(r.pending, [])
})

test('lixo no documento de treinos não quebra nem pontua', () => {
  const r = visita(ZERO, {
    loggedDays: [null, 42, 'ontem', '2026-13-99', {}, dia(10)],
    nowKey: dia(10),
  })
  assert.deepEqual(r.confirmedDays, [dia(10)])
})

test('o placar nunca passa da meta', () => {
  const r = confirmChallengeDays({
    loggedDays: TODOS_21,
    alreadyConfirmed: TODOS_21,
    lastConfirmedOn: '',
    nowKey: dia(10),
  })
  assert.equal(r.confirmedDays.length, 21)
})

test('apagar o treino depois não tira o dia já confirmado', () => {
  const r = confirmChallengeDays({
    loggedDays: [],
    alreadyConfirmed: [dia(2)],
    lastConfirmedOn: dia(2),
    nowKey: dia(10),
  })
  assert.deepEqual(r.confirmedDays, [dia(2)])
})

test('entrada gravada antes da cota diária existir continua funcionando', () => {
  const r = confirmChallengeDays({
    loggedDays: [dia(9)],
    alreadyConfirmed: [dia(8)],
    lastConfirmedOn: undefined,
    nowKey: dia(9),
  })
  assert.deepEqual(r.confirmedDays, [dia(8), dia(9)])
})
