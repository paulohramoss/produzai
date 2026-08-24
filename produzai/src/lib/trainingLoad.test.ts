import { describe, it, expect } from 'vitest'
import type { ManualWorkout } from '../store/useWorkoutStore'
import type { EffortLevel } from './calories'
import {
  effortToRpe, sessionLoad, computeTrainingLoad, weeklyLoadTrend,
  MIN_DAYS_FOR_ACWR, ZONE_EMOJI,
} from './trainingLoad'

// Data fixa em todos os testes: `computeTrainingLoad` e `weeklyLoadTrend` aceitam
// `today` por parâmetro justamente para não depender do relógio.
const TODAY = '2026-03-29'

let seq = 0
function workout(rawDate: string, time: string, effort?: number): ManualWorkout {
  return {
    id: `w${seq++}`, type: 'Academia', name: 'Treino', rawDate, date: rawDate,
    dist: 0, pace: '', time, cal: 0, hr: 0, elev: 0,
    ...(effort === undefined ? {} : { effort: effort as EffortLevel }),
  }
}

/**
 * Treino com carga exata: esforço 5 (RPE 10) × N minutos = 10N UA.
 * Deixa os cenários de ACWR legíveis — o número que importa é a carga, não a
 * combinação de duração e esforço que a produziu.
 */
function carga(rawDate: string, load: number): ManualWorkout {
  return workout(rawDate, `${load / 10}min`, 5)
}

describe('effortToRpe', () => {
  it('converte a escala 1–5 do app para a Borg CR10, mantendo a proporção', () => {
    expect([1, 2, 3, 4, 5].map(effortToRpe)).toEqual([2, 4, 6, 8, 10])
  })

  it('assume moderado (6) quando não há esforço registrado', () => {
    expect(effortToRpe(undefined)).toBe(6)
    expect(effortToRpe(NaN)).toBe(6)
  })

  it('assume moderado (6) para valores abaixo de 1', () => {
    expect(effortToRpe(0)).toBe(6)
    expect(effortToRpe(-3)).toBe(6)
    expect(effortToRpe(0.5)).toBe(6)
  })

  // Consequência da regra acima: "Leve" (RPE 2) pesa MENOS que um treino sem
  // esforço informado (RPE 6). É deliberado — está no comentário da função.
  it('um treino leve pesa menos que um treino sem esforço informado', () => {
    expect(effortToRpe(1)).toBeLessThan(effortToRpe(undefined))
  })

  it('trunca esforço acima de 5 no teto da escala', () => {
    expect(effortToRpe(9)).toBe(10)
    expect(effortToRpe(100)).toBe(10)
  })

  it('arredonda esforço fracionário antes de dobrar', () => {
    expect(effortToRpe(2.4)).toBe(4)
    expect(effortToRpe(2.5)).toBe(6)
  })
})

describe('sessionLoad', () => {
  it('multiplica RPE por minutos e arredonda', () => {
    expect(sessionLoad(workout(TODAY, '60min', 3))).toBe(360)
    expect(sessionLoad(workout(TODAY, '1h30', 5))).toBe(900)
  })

  it('usa RPE 6 quando o treino não tem esforço', () => {
    expect(sessionLoad(workout(TODAY, '30min'))).toBe(180)
  })

  it('devolve 0 para duração zero', () => {
    expect(sessionLoad(workout(TODAY, '0min', 5))).toBe(0)
  })

  // SUSPEITO: duração fora dos formatos "NNmin" e "NhNN" (ex.: "uma hora",
  // "45 min" com espaço, "1h") não parseia, e o treino entra com carga 0 — some
  // do ACWR e do histórico sem nenhum aviso.
  it('devolve 0 quando a duração não está num formato reconhecido', () => {
    expect(sessionLoad(workout(TODAY, 'uma hora', 5))).toBe(0)
    expect(sessionLoad(workout(TODAY, '45 min', 5))).toBe(0)
    expect(sessionLoad(workout(TODAY, '1h', 5))).toBe(0)
    expect(sessionLoad(workout(TODAY, '', 5))).toBe(0)
  })
})

describe('computeTrainingLoad — sem dados suficientes', () => {
  it('devolve tudo zerado e zona "sem-base" para lista vazia', () => {
    const r = computeTrainingLoad([], TODAY)
    expect(r).toMatchObject({
      acute: 0, chronic: 0, acwr: null, zone: 'sem-base', historyDays: 0, previousWeek: 0,
    })
    expect(r.headline).toBe('Ainda montando sua base')
  })

  it(`fica sem ACWR com menos de ${MIN_DAYS_FOR_ACWR} dias de histórico`, () => {
    const r = computeTrainingLoad([carga('2026-03-10', 4000), carga('2026-03-25', 1000)], TODAY)
    expect(r.historyDays).toBe(20)
    expect(r.acwr).toBeNull()
    expect(r.zone).toBe('sem-base')
  })

  it(`libera o ACWR ao completar ${MIN_DAYS_FOR_ACWR} dias de histórico`, () => {
    const r = computeTrainingLoad([carga('2026-03-09', 4000), carga('2026-03-25', 1000)], TODAY)
    expect(r.historyDays).toBe(MIN_DAYS_FOR_ACWR)
    expect(r.acwr).toBe(0.8)
    expect(r.zone).toBe('ideal')
  })

  it('mantém acute e chronic calculados mesmo sem ACWR', () => {
    const r = computeTrainingLoad([carga('2026-03-25', 1000)], TODAY)
    expect(r.acute).toBe(1000)
    expect(r.chronic).toBe(250)
    expect(r.acwr).toBeNull()
  })

  it('cai em "sem-base" quando há histórico longo mas nenhuma carga na janela crônica', () => {
    // Treino antigo demais para entrar nos 28 dias, mas define o início do histórico.
    const r = computeTrainingLoad([carga('2026-01-01', 5000)], TODAY)
    expect(r.historyDays).toBe(88)
    expect(r.chronic).toBe(0)
    expect(r.acwr).toBeNull()
    expect(r.zone).toBe('sem-base')
  })
})

describe('computeTrainingLoad — janelas', () => {
  it('a janela aguda cobre 7 dias terminando em today, inclusive', () => {
    const dentro = computeTrainingLoad([carga('2026-03-23', 100)], TODAY)
    const fora = computeTrainingLoad([carga('2026-03-22', 100)], TODAY)
    expect(dentro.acute).toBe(100)
    expect(fora.acute).toBe(0)
    expect(computeTrainingLoad([carga(TODAY, 100)], TODAY).acute).toBe(100)
  })

  it('a janela crônica cobre 28 dias e divide por 4 para virar média semanal', () => {
    const r = computeTrainingLoad([carga('2026-03-02', 8000)], TODAY)
    expect(r.chronic).toBe(2000)
    expect(computeTrainingLoad([carga('2026-03-01', 8000)], TODAY).chronic).toBe(0)
  })

  // A janela crônica CONTÉM a aguda (ACWR "acoplado"): o mesmo treino da semana
  // entra nos dois lados da razão.
  it('a carga da semana também conta na média crônica', () => {
    const r = computeTrainingLoad([carga('2026-03-25', 4000)], TODAY)
    expect(r.acute).toBe(4000)
    expect(r.chronic).toBe(1000)
  })

  it('previousWeek é a semana anterior à aguda, sem sobreposição', () => {
    const r = computeTrainingLoad([carga('2026-03-22', 700), carga('2026-03-23', 900)], TODAY)
    expect(r.previousWeek).toBe(700)
    expect(r.acute).toBe(900)
  })

  it('soma várias sessões do mesmo dia', () => {
    const r = computeTrainingLoad([carga('2026-03-25', 300), carga('2026-03-25', 200)], TODAY)
    expect(r.acute).toBe(500)
  })

  it('historyDays conta do primeiro dia com carga até today, inclusive', () => {
    expect(computeTrainingLoad([carga('2026-03-29', 100)], TODAY).historyDays).toBe(1)
    expect(computeTrainingLoad([carga('2026-03-28', 100)], TODAY).historyDays).toBe(2)
  })

  // SUSPEITO: historyDays parte do primeiro dia COM CARGA, não do primeiro
  // treino. Um treino antigo com duração não parseável (carga 0) não conta no
  // histórico, e o atleta espera mais tempo pelo ACWR do que deveria.
  it('treino com duração ilegível não conta para historyDays', () => {
    const r = computeTrainingLoad([
      workout('2026-01-01', 'uma hora', 5),
      carga('2026-03-25', 1000),
    ], TODAY)
    expect(r.historyDays).toBe(5)
  })

  // SUSPEITO: treino datado no futuro vira historyDays negativo — nada trunca
  // em 0. Aparece como "-63 dias de histórico" na leitura de carga.
  it('treino datado no futuro produz historyDays negativo', () => {
    const r = computeTrainingLoad([carga('2026-06-01', 1000)], TODAY)
    expect(r.historyDays).toBe(-63)
    expect(r.acute).toBe(0)
  })
})

describe('computeTrainingLoad — zonas', () => {
  // Em todos os casos abaixo a crônica fecha em 2000 UA: só a carga da semana
  // muda, então o ACWR sai exato e a fronteira fica explícita.
  const cenario = (base: number, acute: number) =>
    computeTrainingLoad([carga('2026-03-02', base), carga('2026-03-25', acute)], TODAY)

  it('abaixo de 0,8 é destreino', () => {
    const r = cenario(6420, 1580)
    expect(r.acwr).toBe(0.79)
    expect(r.zone).toBe('destreino')
    expect(r.headline).toBe('Carga bem abaixo do seu normal')
  })

  it('exatamente 0,8 já é ideal', () => {
    const r = cenario(6400, 1600)
    expect(r.acwr).toBe(0.8)
    expect(r.zone).toBe('ideal')
  })

  it('exatamente 1,3 ainda é ideal', () => {
    const r = cenario(5400, 2600)
    expect(r.acwr).toBe(1.3)
    expect(r.zone).toBe('ideal')
    expect(r.headline).toBe('Carga na faixa saudável')
  })

  it('acima de 1,3 vira atenção', () => {
    const r = cenario(5380, 2620)
    expect(r.acwr).toBe(1.31)
    expect(r.zone).toBe('atencao')
    expect(r.headline).toBe('Carga subindo rápido')
  })

  it('exatamente 1,5 ainda é atenção', () => {
    const r = cenario(5000, 3000)
    expect(r.acwr).toBe(1.5)
    expect(r.zone).toBe('atencao')
  })

  it('acima de 1,5 é risco', () => {
    const r = cenario(4980, 3020)
    expect(r.acwr).toBe(1.51)
    expect(r.zone).toBe('risco')
    expect(r.headline).toBe('Pico de carga')
  })

  it('o ACWR é arredondado em duas casas', () => {
    expect(cenario(5380, 2620).acwr).toBe(1.31)
  })

  it('o conselho de destreino usa a diferença em módulo', () => {
    expect(cenario(6420, 1580).advice).toContain('420 UA a menos')
  })

  it('o conselho de atenção e o de risco citam a diferença acima da média', () => {
    expect(cenario(5380, 2620).advice).toContain('620 UA acima')
    expect(cenario(4980, 3020).advice).toContain('1020 UA acima')
  })

  it('toda zona tem emoji', () => {
    expect(Object.keys(ZONE_EMOJI).sort())
      .toEqual(['atencao', 'destreino', 'ideal', 'risco', 'sem-base'])
  })
})

describe('weeklyLoadTrend', () => {
  it('devolve lista vazia quando weeks é 0', () => {
    expect(weeklyLoadTrend([carga('2026-03-25', 100)], 0, TODAY)).toEqual([])
  })

  it('devolve pontos zerados, sem ACWR, quando não há treino nenhum', () => {
    expect(weeklyLoadTrend([], 2, TODAY)).toEqual([
      { label: '22/03', load: 0, acwr: null },
      { label: '29/03', load: 0, acwr: null },
    ])
  })

  it('vai da semana mais antiga para a mais recente, rotulando o fim de cada semana', () => {
    const pontos = weeklyLoadTrend([], 3, TODAY)
    expect(pontos.map(p => p.label)).toEqual(['15/03', '22/03', '29/03'])
  })

  it('usa o número de semanas pedido', () => {
    expect(weeklyLoadTrend([], 8, TODAY)).toHaveLength(8)
    expect(weeklyLoadTrend([], 1, TODAY)).toHaveLength(1)
  })

  it('atribui a carga à semana que termina no ponto', () => {
    const pontos = weeklyLoadTrend([carga('2026-03-16', 500), carga('2026-03-24', 700)], 2, TODAY)
    expect(pontos.map(p => p.load)).toEqual([500, 700])
  })

  it('só calcula ACWR nas semanas em que já havia base suficiente', () => {
    // Carga diária constante de 360 UA, de 01/03 a 29/03.
    const dias: ManualWorkout[] = []
    for (let d = 1; d <= 29; d++) {
      dias.push(workout(`2026-03-${String(d).padStart(2, '0')}`, '60min', 3))
    }
    const pontos = weeklyLoadTrend(dias, 3, TODAY)
    expect(pontos).toEqual([
      { label: '15/03', load: 2520, acwr: null },  // 15 dias de histórico
      { label: '22/03', load: 2520, acwr: 1.27 },  // 22 dias, base ainda incompleta
      { label: '29/03', load: 2520, acwr: 1 },     // 29 dias, base cheia
    ])
  })
})
