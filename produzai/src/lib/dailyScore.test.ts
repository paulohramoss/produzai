import { describe, it, expect } from 'vitest'
import { computeScore, type Habit, type FocusItem } from './dailyScore'

const habito = (id: string, done: boolean): Habit =>
  ({ id, icon: '💧', label: id, done })

const foco = (id: string, text: string, done: boolean): FocusItem =>
  ({ id, text, done })

describe('computeScore', () => {
  it('devolve 0 sem hábitos e sem foco', () => {
    expect(computeScore([], [])).toBe(0)
  })

  it('devolve 0 quando nada foi cumprido', () => {
    expect(computeScore([habito('a', false), habito('b', false)], [foco('f', 'Ler', false)]))
      .toBe(0)
  })

  it('dá 100 com tudo cumprido dos dois lados', () => {
    expect(computeScore([habito('a', true)], [foco('f', 'Ler', true)])).toBe(100)
  })

  it('divide 60% para hábitos e 40% para foco', () => {
    expect(computeScore([habito('a', true)], [foco('f', 'Ler', false)])).toBe(60)
    expect(computeScore([habito('a', false)], [foco('f', 'Ler', true)])).toBe(40)
  })

  it('pontua a fração de hábitos cumpridos', () => {
    const quatro = [
      habito('a', true), habito('b', true), habito('c', false), habito('d', false),
    ]
    expect(computeScore(quatro, [])).toBe(30)   // metade de 60
  })

  it('arredonda frações que não fecham', () => {
    const tres = [habito('a', true), habito('b', false), habito('c', false)]
    expect(computeScore(tres, [])).toBe(20)
    expect(computeScore([habito('a', true), habito('b', true), habito('c', false)], [])).toBe(40)
  })

  it('soma as duas partes', () => {
    const habitos = [habito('a', true), habito('b', false)]
    const focos = [foco('f1', 'Ler', true), foco('f2', 'Estudar', false)]
    expect(computeScore(habitos, focos)).toBe(50)   // 30 + 20
  })

  it('ignora itens de foco sem texto, no total e no cumprido', () => {
    const focos = [foco('f1', 'Ler', true), foco('f2', '', false), foco('f3', '', true)]
    expect(computeScore([], focos)).toBe(40)
  })

  it('não pontua foco quando todos os itens estão em branco', () => {
    expect(computeScore([habito('a', true)], [foco('f1', '', true)])).toBe(60)
  })

  // SUSPEITO: as duas partes não são normalizadas. Um dia sem nenhum item de
  // foco registrado tem teto de 60/100, mesmo com todos os hábitos cumpridos —
  // e o mesmo vale para o lado dos hábitos, com teto de 40.
  it('sem foco registrado o dia perfeito vale 60, não 100', () => {
    expect(computeScore([habito('a', true), habito('b', true)], [])).toBe(60)
    expect(computeScore([], [foco('f', 'Ler', true)])).toBe(40)
  })
})

describe('computeScore — hábitos cobrados no dia (pendingIds)', () => {
  const habitos = [habito('seg', true), habito('ter', false), habito('qua', false)]

  it('conta só os hábitos cobrados hoje', () => {
    expect(computeScore(habitos, [], new Set(['seg']))).toBe(60)
  })

  it('hábito em descanso cumprido mesmo assim continua somando', () => {
    // 'ter' é o único cobrado e está pendente; 'seg' está de folga mas foi feito.
    expect(computeScore(habitos, [], new Set(['ter']))).toBe(30)   // 1 de 2
  })

  it('hábito em descanso e não cumprido não entra na conta', () => {
    expect(computeScore(habitos, [], new Set(['seg', 'ter']))).toBe(30)
  })

  it('com pendingIds vazio, só o que foi cumprido conta — e fecha 100%', () => {
    expect(computeScore(habitos, [], new Set())).toBe(60)
  })

  it('com pendingIds vazio e nada cumprido, a parte dos hábitos é 0', () => {
    expect(computeScore([habito('a', false)], [], new Set())).toBe(0)
  })

  it('pendingIds com id inexistente não inventa hábito', () => {
    expect(computeScore([habito('a', true)], [], new Set(['fantasma']))).toBe(60)
  })

  it('sem pendingIds todos os hábitos são cobrados', () => {
    expect(computeScore(habitos, [])).toBe(20)   // 1 de 3
  })
})
