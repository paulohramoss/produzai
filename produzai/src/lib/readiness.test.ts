import { describe, it, expect } from 'vitest'
import type { ReadinessEntry } from './db'
import {
  computeReadiness, restingHrBaseline, defaultReadinessDraft,
  VERDICT_LABEL, VERDICT_EMOJI,
} from './readiness'

function entry(
  sleepHours: number, sleepQuality: number, soreness: number, drive: number, restingHr?: number,
): ReadinessEntry {
  return {
    sleepHours, sleepQuality, soreness, drive, loggedAt: 1_772_000_000_000,
    ...(restingHr === undefined ? {} : { restingHr }),
  }
}

/** Histórico com FC de repouso constante — base de comparação previsível em 50 bpm. */
const HIST_50 = [entry(8, 3, 3, 3, 50), entry(8, 3, 3, 3, 50), entry(8, 3, 3, 3, 50)]

describe('restingHrBaseline', () => {
  it('devolve null sem histórico', () => {
    expect(restingHrBaseline([])).toBeNull()
  })

  it('devolve null com menos de 3 medidas', () => {
    expect(restingHrBaseline([entry(8, 3, 3, 3, 50), entry(8, 3, 3, 3, 52)])).toBeNull()
  })

  it('devolve a média arredondada a partir de 3 medidas', () => {
    expect(restingHrBaseline([
      entry(8, 3, 3, 3, 50), entry(8, 3, 3, 3, 52), entry(8, 3, 3, 3, 54),
    ])).toBe(52)
  })

  it('conta só as entradas que têm FC — as demais nem entram na contagem mínima', () => {
    expect(restingHrBaseline([
      entry(8, 3, 3, 3, 50), entry(8, 3, 3, 3), entry(8, 3, 3, 3, 54),
    ])).toBeNull()
  })

  it('descarta FC zero ou negativa', () => {
    expect(restingHrBaseline([
      entry(8, 3, 3, 3, 0), entry(8, 3, 3, 3, -60),
      entry(8, 3, 3, 3, 50), entry(8, 3, 3, 3, 52), entry(8, 3, 3, 3, 54),
    ])).toBe(52)
  })
})

describe('computeReadiness — score', () => {
  it('dá 100 no cenário perfeito', () => {
    const r = computeReadiness(entry(8, 5, 1, 5))
    expect(r.score).toBe(100)
    expect(r.factors.map(f => f.score)).toEqual([100, 100, 100, 100])
  })

  it('dá 0 no cenário pior', () => {
    expect(computeReadiness(entry(0, 1, 5, 1)).score).toBe(0)
  })

  it('trata 7 a 9 horas como faixa cheia e tira 20 pontos por hora fora dela', () => {
    const sono = (h: number) => computeReadiness(entry(h, 3, 3, 3)).factors[0].score
    expect([7, 8, 9].map(sono)).toEqual([100, 100, 100])
    expect(sono(6)).toBe(80)
    expect(sono(10)).toBe(80)
    expect(sono(5)).toBe(60)
    expect(sono(11)).toBe(60)
  })

  it('não deixa o fator sono ficar negativo', () => {
    expect(computeReadiness(entry(0, 3, 3, 3)).factors[0].score).toBe(0)
    expect(computeReadiness(entry(24, 3, 3, 3)).factors[0].score).toBe(0)
  })

  it('converte as escalas de 1–5 em 0–100', () => {
    const q = (v: number) => computeReadiness(entry(8, v, 3, 3)).factors[1].score
    expect([1, 2, 3, 4, 5].map(q)).toEqual([0, 25, 50, 75, 100])
  })

  it('inverte a dor muscular — 1 é o melhor cenário', () => {
    const dor = (v: number) => computeReadiness(entry(8, 3, v, 3)).factors[2].score
    expect([1, 2, 3, 4, 5].map(dor)).toEqual([100, 75, 50, 25, 0])
  })

  it('clampeia escalas fora do intervalo 1–5', () => {
    expect(computeReadiness(entry(8, 0, 1, 6)).factors[1].score).toBe(0)
    expect(computeReadiness(entry(8, 0, 1, 6)).factors[3].score).toBe(100)
    expect(computeReadiness(entry(8, 3, 9, 3)).factors[2].score).toBe(0)
  })

  it('pesa sono 30%, qualidade 20%, dor 25% e disposição 25%', () => {
    // Só o sono no máximo: 0.3 × 100 = 30.
    expect(computeReadiness(entry(8, 1, 5, 1)).score).toBe(30)
    // Só a qualidade no máximo: 0.2 × 100 = 20.
    expect(computeReadiness(entry(0, 5, 5, 1)).score).toBe(20)
    // Só a dor no melhor caso: 0.25 × 100 = 25.
    expect(computeReadiness(entry(0, 1, 1, 1)).score).toBe(25)
    // Só a disposição no máximo: 0.25 × 100 = 25.
    expect(computeReadiness(entry(0, 1, 5, 5)).score).toBe(25)
  })
})

describe('computeReadiness — veredicto', () => {
  it('78 já é "puxa" e 77 ainda é "mantem"', () => {
    const puxa = computeReadiness(entry(5, 3, 1, 5))
    expect(puxa.score).toBe(78)
    expect(puxa.verdict).toBe('puxa')

    const mantem = computeReadiness(entry(5, 4, 1, 4))
    expect(mantem.score).toBe(77)
    expect(mantem.verdict).toBe('mantem')
  })

  it('58 já é "mantem" e 57 ainda é "segura"', () => {
    const mantem = computeReadiness(entry(4, 4, 1, 2))
    expect(mantem.score).toBe(58)
    expect(mantem.verdict).toBe('mantem')

    const segura = computeReadiness(entry(4, 5, 1, 1))
    expect(segura.score).toBe(57)
    expect(segura.verdict).toBe('segura')
  })

  it('a headline vem da tabela de veredictos', () => {
    expect(computeReadiness(entry(8, 5, 1, 5)).headline).toBe(VERDICT_LABEL.puxa)
    expect(computeReadiness(entry(0, 1, 5, 1)).headline).toBe(VERDICT_LABEL.segura)
    expect(Object.keys(VERDICT_EMOJI).sort()).toEqual(['mantem', 'puxa', 'segura'])
  })
})

describe('computeReadiness — FC de repouso', () => {
  it('não ajusta nada sem FC no check-in', () => {
    const r = computeReadiness(entry(8, 4, 2, 4), HIST_50)
    expect(r.hrAdjustment).toBe(0)
    expect(r.factors).toHaveLength(4)
  })

  it('não ajusta nada sem base de comparação', () => {
    const r = computeReadiness(entry(8, 4, 2, 4, 90), [entry(8, 3, 3, 3, 50)])
    expect(r.hrAdjustment).toBe(0)
    expect(r.factors).toHaveLength(4)
  })

  it('trata FC 0 como ausente', () => {
    expect(computeReadiness(entry(8, 4, 2, 4, 0), HIST_50).factors).toHaveLength(4)
  })

  it('tira 15 pontos a partir de +10 bpm sobre a base', () => {
    expect(computeReadiness(entry(8, 4, 2, 4, 60), HIST_50).hrAdjustment).toBe(-15)
    expect(computeReadiness(entry(8, 4, 2, 4, 65), HIST_50).hrAdjustment).toBe(-15)
  })

  it('tira 8 pontos entre +5 e +9 bpm', () => {
    expect(computeReadiness(entry(8, 4, 2, 4, 55), HIST_50).hrAdjustment).toBe(-8)
    expect(computeReadiness(entry(8, 4, 2, 4, 59), HIST_50).hrAdjustment).toBe(-8)
  })

  it('não mexe entre -4 e +4 bpm', () => {
    expect(computeReadiness(entry(8, 4, 2, 4, 46), HIST_50).hrAdjustment).toBe(0)
    expect(computeReadiness(entry(8, 4, 2, 4, 50), HIST_50).hrAdjustment).toBe(0)
    expect(computeReadiness(entry(8, 4, 2, 4, 54), HIST_50).hrAdjustment).toBe(0)
  })

  it('soma 5 pontos a partir de -5 bpm', () => {
    expect(computeReadiness(entry(8, 4, 2, 4, 45), HIST_50).hrAdjustment).toBe(5)
    expect(computeReadiness(entry(8, 4, 2, 4, 40), HIST_50).hrAdjustment).toBe(5)
  })

  it('o ajuste entra no score final', () => {
    const neutro = computeReadiness(entry(8, 4, 2, 4, 50), HIST_50)
    expect(neutro.score).toBe(83)
    expect(computeReadiness(entry(8, 4, 2, 4, 60), HIST_50).score).toBe(83 - 15)
    expect(computeReadiness(entry(8, 4, 2, 4, 45), HIST_50).score).toBe(83 + 5)
  })

  it('descreve a FC comparada à média, com sinal', () => {
    expect(computeReadiness(entry(8, 4, 2, 4, 50), HIST_50).factors[4].detail)
      .toBe('50 bpm, na sua média')
    expect(computeReadiness(entry(8, 4, 2, 4, 60), HIST_50).factors[4].detail)
      .toBe('60 bpm (+10 vs. sua média de 50)')
    expect(computeReadiness(entry(8, 4, 2, 4, 40), HIST_50).factors[4].detail)
      .toBe('40 bpm (-10 vs. sua média de 50)')
  })

  // SUSPEITO: o score do fator é `clamp(100 + ajuste × 4)`, então o bônus de +5
  // (FC abaixo da média) vira 120 e é cortado em 100 — a barra fica idêntica à
  // de quem está exatamente na média. Só as penalidades aparecem no gráfico.
  it('a barra da FC não distingue "abaixo da média" de "na média"', () => {
    expect(computeReadiness(entry(8, 4, 2, 4, 40), HIST_50).factors[4].score).toBe(100)
    expect(computeReadiness(entry(8, 4, 2, 4, 50), HIST_50).factors[4].score).toBe(100)
    expect(computeReadiness(entry(8, 4, 2, 4, 55), HIST_50).factors[4].score).toBe(68)
    expect(computeReadiness(entry(8, 4, 2, 4, 60), HIST_50).factors[4].score).toBe(40)
  })
})

describe('computeReadiness — detalhes dos fatores', () => {
  it('formata horas inteiras e quebradas', () => {
    expect(computeReadiness(entry(8, 3, 3, 3)).factors[0].detail).toBe('8h dormidas')
    expect(computeReadiness(entry(7.5, 3, 3, 3)).factors[0].detail).toBe('7h30 dormidas')
    expect(computeReadiness(entry(6.25, 3, 3, 3)).factors[0].detail).toBe('6h15 dormidas')
  })

  it('nomeia a dor muscular pela escala', () => {
    const rotulo = (v: number) => computeReadiness(entry(8, 3, v, 3)).factors[2].detail
    expect([1, 2, 3, 4, 5].map(rotulo))
      .toEqual(['sem dor', 'dor leve', 'dor moderada', 'dor forte', 'dor muito forte'])
  })

  it('cai para "N/5" quando a dor está fora da escala', () => {
    expect(computeReadiness(entry(8, 3, 9, 3)).factors[2].detail).toBe('9/5')
  })
})

describe('computeReadiness — conselho', () => {
  it('em "puxa" não aponta elo fraco nenhum', () => {
    expect(computeReadiness(entry(8, 5, 1, 5)).advice)
      .toBe('Corpo recuperado. Se tem treino puxado na semana, hoje é o dia dele.')
  })

  it('em "mantem" aponta o fator mais fraco', () => {
    expect(computeReadiness(entry(8, 1, 2, 4)).advice).toContain('o sono não foi dos melhores')
    expect(computeReadiness(entry(5, 4, 2, 4)).advice).toContain('você dormiu 5h')
    expect(computeReadiness(entry(8, 4, 5, 3)).advice).toContain('ainda tem dor da sessão anterior')
    expect(computeReadiness(entry(8, 4, 2, 1)).advice).toContain('a disposição está média')
  })

  it('em "segura" aponta o fator mais fraco com texto mais duro', () => {
    expect(computeReadiness(entry(4, 2, 4, 2)).advice).toContain('o sono foi ruim')
    expect(computeReadiness(entry(4, 3, 3, 3)).advice).toContain('dormiu só 4h')
    expect(computeReadiness(entry(6, 2, 5, 2)).advice).toContain('a dor muscular está alta')
    expect(computeReadiness(entry(6, 2, 4, 1)).advice).toContain('a disposição está no chão')
  })

  it('em "segura" a FC alta cala os demais fatores', () => {
    expect(computeReadiness(entry(6, 3, 3, 3, 65), HIST_50).advice)
      .toBe('FC de repouso bem acima da sua média, sinal clássico de recuperação incompleta. Treino leve ou descanso, e reavalie amanhã.')
  })

  // Desempate do elo mais fraco: `Object.entries` mantém a ordem de declaração
  // (sono, qualidade, dor, disposição) e o sort é estável, então em empate ganha
  // o primeiro dessa lista.
  it('em empate de fator mais fraco, vence a ordem de declaração', () => {
    // qualidade, dor e disposição empatam em 0 — sai o texto da qualidade.
    expect(computeReadiness(entry(7, 1, 5, 1)).advice).toContain('o sono foi ruim')
  })
})

describe('defaultReadinessDraft', () => {
  it('sem check-in anterior, começa no meio da escala com 7h de sono', () => {
    expect(defaultReadinessDraft(null))
      .toEqual({ sleepHours: 7, sleepQuality: 3, soreness: 2, drive: 3 })
  })

  it('repete o último check-in quando existe', () => {
    expect(defaultReadinessDraft(entry(6.5, 2, 4, 5, 58)))
      .toEqual({ sleepHours: 6.5, sleepQuality: 2, soreness: 4, drive: 5, restingHr: 58 })
  })

  it('não arrasta a FC quando o último check-in não tinha', () => {
    expect(defaultReadinessDraft(entry(6.5, 2, 4, 5))).not.toHaveProperty('restingHr')
  })

  // SUSPEITO: os defaults usam `??`, que só cai no padrão para null/undefined,
  // mas a FC usa `?` (falsy). Zeros gravados por engano em sleepQuality,
  // soreness ou drive são preservados; um restingHr 0 é descartado. Duas
  // políticas diferentes no mesmo objeto.
  it('preserva zeros das escalas mas descarta FC zero', () => {
    const draft = defaultReadinessDraft(entry(0, 0, 0, 0, 0))
    expect(draft).toEqual({ sleepHours: 0, sleepQuality: 0, soreness: 0, drive: 0 })
  })
})
