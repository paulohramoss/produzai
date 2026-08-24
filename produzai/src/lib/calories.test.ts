import { describe, it, expect } from 'vitest'
import {
  estimateCalories, resolveWeightKg, EFFORT_LEVELS,
  REFERENCE_WEIGHT_KG, MIN_WEIGHT_KG, MAX_WEIGHT_KG,
  type EffortLevel,
} from './calories'

describe('resolveWeightKg', () => {
  it('devolve o peso do usuário quando é utilizável', () => {
    expect(resolveWeightKg(82)).toBe(82)
    expect(resolveWeightKg(65.4)).toBe(65.4)
  })

  it('cai na referência quando não há peso informado', () => {
    expect(resolveWeightKg()).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(null)).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(undefined)).toBe(REFERENCE_WEIGHT_KG)
  })

  it('cai na referência para valores que não são número finito', () => {
    expect(resolveWeightKg(NaN)).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(Infinity)).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(-Infinity)).toBe(REFERENCE_WEIGHT_KG)
  })

  it('aceita exatamente os limites da faixa', () => {
    expect(resolveWeightKg(MIN_WEIGHT_KG)).toBe(30)
    expect(resolveWeightKg(MAX_WEIGHT_KG)).toBe(300)
  })

  it('cai na referência fora da faixa — inclusive no erro de digitação clássico', () => {
    expect(resolveWeightKg(MIN_WEIGHT_KG - 1)).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(MAX_WEIGHT_KG + 1)).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(700)).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(0)).toBe(REFERENCE_WEIGHT_KG)
    expect(resolveWeightKg(-80)).toBe(REFERENCE_WEIGHT_KG)
  })
})

describe('estimateCalories', () => {
  it('aplica kcal = MET × kg × horas e arredonda', () => {
    expect(estimateCalories('Corrida', 60, 3, 70)).toBe(770)      // 11 × 70 × 1
    expect(estimateCalories('Caminhada', 45, 2, 100)).toBe(285)   // 3.8 × 100 × 0.75
    expect(estimateCalories('Academia', 30, 5, 80)).toBe(360)     // 9 × 80 × 0.5
  })

  it('sobe o gasto com o esforço, dentro do mesmo tipo', () => {
    const porEsforco = ([1, 2, 3, 4, 5] as EffortLevel[])
      .map(e => estimateCalories('Ciclismo', 60, e, 70))
    expect(porEsforco).toEqual([280, 420, 560, 700, 840])
  })

  it('usa a tabela de "Outro" para tipo desconhecido', () => {
    expect(estimateCalories('Parkour', 60, 1, 80))
      .toBe(estimateCalories('Outro', 60, 1, 80))
    expect(estimateCalories('Parkour', 60, 1, 80)).toBe(240)      // 3 × 80 × 1
  })

  it('cai no peso de referência quando o peso não veio', () => {
    expect(estimateCalories('Corrida', 60, 3))
      .toBe(estimateCalories('Corrida', 60, 3, REFERENCE_WEIGHT_KG))
  })

  it('devolve 0 para duração zero', () => {
    expect(estimateCalories('Corrida', 0, 5, 70)).toBe(0)
  })

  it('escala linearmente com a duração', () => {
    expect(estimateCalories('Natação', 120, 3, 70))
      .toBe(estimateCalories('Natação', 60, 3, 70) * 2)
  })

  it('tem uma linha de MET para cada tipo oferecido no app', () => {
    for (const tipo of ['Corrida', 'Caminhada', 'Academia', 'Ciclismo', 'Natação', 'Futebol', 'Outro']) {
      expect(estimateCalories(tipo, 60, 3, 70)).toBeGreaterThan(0)
    }
  })

  it('EFFORT_LEVELS cobre a escala de 1 a 5 com rótulo', () => {
    expect(EFFORT_LEVELS.map(e => e.value)).toEqual([1, 2, 3, 4, 5])
    expect(EFFORT_LEVELS.every(e => e.label.length > 0)).toBe(true)
  })

  // SUSPEITO: o esforço indexa a tabela direto (`mets[effort - 1]`), sem
  // nenhuma guarda. O tipo EffortLevel protege em tempo de compilação, mas o
  // dado vem do Firestore: um esforço 0 ou 6 gravado por versão antiga vira
  // `undefined` e a função devolve NaN, que segue para o campo de calorias.
  it('devolve NaN para esforço fora da escala 1–5', () => {
    expect(estimateCalories('Corrida', 60, 0 as EffortLevel, 70)).toBeNaN()
    expect(estimateCalories('Corrida', 60, 6 as EffortLevel, 70)).toBeNaN()
  })

  // SUSPEITO: duração negativa produz caloria negativa em vez de 0.
  it('devolve caloria negativa para duração negativa', () => {
    expect(estimateCalories('Corrida', -60, 3, 70)).toBe(-770)
  })
})
