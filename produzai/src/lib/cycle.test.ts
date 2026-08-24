import { describe, it, expect } from 'vitest'
import {
  cycleStateFor, normalizeCycle, observedCycleLength, daysBetween,
  DEFAULT_CYCLE, CYCLE_LENGTH_RANGE, PERIOD_LENGTH_RANGE,
  PHASE_LABEL, PHASE_EMOJI, PHASE_SCORE, PHASE_ADVICE, PHASE_COLOR,
} from './cycle'

/** Ciclo padrão da literatura, ancorado numa data fixa. */
const PADRAO = { starts: ['2026-03-01'], avgLength: 28, periodLength: 5 }

/** "2026-03-07" para o 7º dia de março — os testes vivem quase todos nesse mês. */
const marco = (d: number) => `2026-03-${String(d).padStart(2, '0')}`

describe('daysBetween', () => {
  it('conta 0 para o mesmo dia', () => {
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0)
  })

  it('conta dias inteiros para frente e para trás', () => {
    expect(daysBetween('2026-03-01', '2026-03-02')).toBe(1)
    expect(daysBetween('2026-03-02', '2026-03-01')).toBe(-1)
  })

  it('atravessa mês e ano', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })

  it('respeita ano bissexto', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })
})

describe('cycleStateFor — sem resposta possível', () => {
  it('devolve null quando não há nenhum início registrado', () => {
    expect(cycleStateFor(marco(10), { ...PADRAO, starts: [] })).toBeNull()
  })

  it('devolve null para data anterior ao primeiro início', () => {
    expect(cycleStateFor('2026-02-28', PADRAO)).toBeNull()
  })

  it('devolve null quando passaram mais de dois ciclos sem registro', () => {
    expect(cycleStateFor('2026-04-25', PADRAO)?.day).toBe(56)   // 2 × avgLength
    expect(cycleStateFor('2026-04-26', PADRAO)).toBeNull()      // 57º dia
  })
})

describe('cycleStateFor — fases', () => {
  const faseNoDia = (d: number) => cycleStateFor(marco(d), PADRAO)?.phase

  it('conta o primeiro dia de menstruação como dia 1', () => {
    expect(cycleStateFor(marco(1), PADRAO)?.day).toBe(1)
    expect(cycleStateFor(marco(7), PADRAO)?.day).toBe(7)
  })

  it('menstrual vai até o último dia de fluxo', () => {
    expect([1, 2, 3, 4, 5].map(faseNoDia)).toEqual(Array(5).fill('menstrual'))
    expect(faseNoDia(6)).toBe('folicular')
  })

  it('folicular ocupa o meio, até a véspera da janela ovulatória', () => {
    expect([6, 7, 8, 9, 10, 11, 12].map(faseNoDia)).toEqual(Array(7).fill('folicular'))
  })

  it('a janela ovulatória tem três dias, centrada em avgLength − 14', () => {
    expect([13, 14, 15].map(faseNoDia)).toEqual(['ovulatoria', 'ovulatoria', 'ovulatoria'])
  })

  it('lútea vai da ovulação ao fim do ciclo, e continua no atraso', () => {
    expect([16, 17, 28, 29, 30].map(faseNoDia)).toEqual(Array(5).fill('lutea'))
    expect(cycleStateFor('2026-04-20', PADRAO)?.phase).toBe('lutea')
  })

  it('conta a ovulação de trás para frente num ciclo longo', () => {
    const longo = { starts: ['2026-03-01'], avgLength: 40, periodLength: 2 }
    const fase = (d: number) => cycleStateFor(marco(d), longo)?.phase
    expect([1, 2].map(fase)).toEqual(['menstrual', 'menstrual'])
    expect(fase(3)).toBe('folicular')
    expect([25, 26, 27].map(fase)).toEqual(['ovulatoria', 'ovulatoria', 'ovulatoria'])
    expect(fase(28)).toBe('lutea')
  })

  // SUSPEITO: com ciclo curto e fluxo longo (21/10), a ovulação calculada é o
  // dia 12 (piso `periodLength + 2`) e a janela ovulatória começa no dia 11 —
  // logo depois do fluxo. A fase folicular simplesmente não existe nesse ajuste.
  it('num ciclo 21/10 a fase folicular desaparece', () => {
    const curto = { starts: ['2026-03-01'], avgLength: 21, periodLength: 10 }
    const fases = Array.from({ length: 14 }, (_, i) => cycleStateFor(marco(i + 1), curto)?.phase)
    expect(fases).toEqual([
      ...Array(10).fill('menstrual'),
      'ovulatoria', 'ovulatoria', 'ovulatoria',
      'lutea',
    ])
    expect(fases).not.toContain('folicular')
  })
})

describe('cycleStateFor — previsão e atraso', () => {
  it('prevê o próximo início pela duração média', () => {
    const s = cycleStateFor(marco(1), PADRAO)
    expect(s).toMatchObject({
      cycleStart: '2026-03-01', nextPeriod: '2026-03-29', daysToNextPeriod: 28, late: false,
    })
  })

  it('zera a contagem no dia previsto e fica negativa depois', () => {
    expect(cycleStateFor('2026-03-29', PADRAO)?.daysToNextPeriod).toBe(0)
    expect(cycleStateFor('2026-04-01', PADRAO)?.daysToNextPeriod).toBe(-3)
  })

  it('só marca atraso passados 3 dias da previsão', () => {
    expect(cycleStateFor('2026-03-31', PADRAO)?.day).toBe(31)
    expect(cycleStateFor('2026-03-31', PADRAO)?.late).toBe(false)
    expect(cycleStateFor('2026-04-01', PADRAO)?.day).toBe(32)
    expect(cycleStateFor('2026-04-01', PADRAO)?.late).toBe(true)
  })

  it('ancora no início mais recente que não seja futuro', () => {
    const dados = { ...PADRAO, starts: ['2026-03-01', '2026-03-29'] }
    expect(cycleStateFor('2026-04-05', dados)).toMatchObject({ cycleStart: '2026-03-29', day: 8 })
    expect(cycleStateFor('2026-03-15', dados)).toMatchObject({ cycleStart: '2026-03-01', day: 15 })
  })
})

describe('normalizeCycle', () => {
  it('devolve o padrão para null e undefined', () => {
    expect(normalizeCycle(null)).toEqual(DEFAULT_CYCLE)
    expect(normalizeCycle(undefined)).toEqual(DEFAULT_CYCLE)
    expect(normalizeCycle({})).toEqual(DEFAULT_CYCLE)
  })

  // SUSPEITO: o caminho de null/undefined faz `{ ...DEFAULT_CYCLE }`, cópia
  // rasa — o array `starts` devolvido É o mesmo objeto de DEFAULT_CYCLE. Quem
  // der push nele corrompe o padrão do módulo inteiro para o resto da sessão.
  it('o starts devolvido para null é o próprio array do DEFAULT_CYCLE', () => {
    expect(normalizeCycle(null).starts).toBe(DEFAULT_CYCLE.starts)
  })

  it('desligado é o padrão, e qualquer valor verdadeiro liga', () => {
    expect(normalizeCycle({}).enabled).toBe(false)
    expect(normalizeCycle({ enabled: true }).enabled).toBe(true)
  })

  it('prende a duração do ciclo na faixa permitida', () => {
    expect(normalizeCycle({ avgLength: 10 }).avgLength).toBe(CYCLE_LENGTH_RANGE.min)
    expect(normalizeCycle({ avgLength: 50 }).avgLength).toBe(CYCLE_LENGTH_RANGE.max)
    expect(normalizeCycle({ avgLength: 30 }).avgLength).toBe(30)
  })

  it('prende a duração do fluxo na faixa permitida', () => {
    expect(normalizeCycle({ periodLength: 1 }).periodLength).toBe(PERIOD_LENGTH_RANGE.min)
    expect(normalizeCycle({ periodLength: 20 }).periodLength).toBe(PERIOD_LENGTH_RANGE.max)
  })

  it('arredonda duração fracionária', () => {
    expect(normalizeCycle({ avgLength: 28.6 }).avgLength).toBe(29)
    expect(normalizeCycle({ periodLength: 4.4 }).periodLength).toBe(4)
  })

  it('cai no padrão quando a duração não é número', () => {
    expect(normalizeCycle({ avgLength: NaN }).avgLength).toBe(28)
    expect(normalizeCycle({ avgLength: undefined }).avgLength).toBe(28)
    expect(normalizeCycle({ periodLength: NaN }).periodLength).toBe(5)
  })

  it('ordena, deduplica e descarta datas malformadas', () => {
    expect(normalizeCycle({
      starts: ['2026-03-29', '2026-03-01', '2026-03-01', 'lixo', '', '2026-3-1'],
    }).starts).toEqual(['2026-03-01', '2026-03-29'])
  })

  it('devolve starts vazio quando o campo não veio', () => {
    expect(normalizeCycle({ enabled: true }).starts).toEqual([])
  })

  // SUSPEITO: a validação de data é só de FORMATO (`\d{4}-\d{2}-\d{2}`). Um
  // "2026-13-45" passa e vira uma data real deslocada quando o Date interpreta
  // o mês 13 — a previsão sai errada sem nenhum aviso.
  it('aceita data com formato certo e valores impossíveis', () => {
    expect(normalizeCycle({ starts: ['2026-13-45'] }).starts).toEqual(['2026-13-45'])
  })
})

describe('observedCycleLength', () => {
  it('devolve null com menos de 3 registros', () => {
    expect(observedCycleLength([])).toBeNull()
    expect(observedCycleLength(['2026-01-01'])).toBeNull()
    expect(observedCycleLength(['2026-01-01', '2026-01-29'])).toBeNull()
  })

  it('tira a média dos intervalos a partir de 3 registros', () => {
    expect(observedCycleLength(['2026-01-01', '2026-01-29', '2026-02-26'])).toBe(28)
  })

  it('arredonda a média', () => {
    expect(observedCycleLength(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-30'])).toBe(29)
  })

  it('ordena antes de medir os intervalos', () => {
    expect(observedCycleLength(['2026-02-26', '2026-01-01', '2026-01-29'])).toBe(28)
  })

  it('descarta intervalos fora da faixa plausível', () => {
    // 4 dias (registro duplicado/errado) e 28 dias — sobra um intervalo só.
    expect(observedCycleLength(['2026-01-01', '2026-01-05', '2026-02-02'])).toBeNull()
  })

  it('devolve a média dos que sobraram quando ao menos dois são plausíveis', () => {
    expect(observedCycleLength([
      '2026-01-01', '2026-01-03', '2026-01-31', '2026-02-28',
    ])).toBe(28)
  })
})

describe('tabelas de fase', () => {
  it('toda fase tem rótulo, emoji, cor, pontuação e conselho', () => {
    const fases = ['menstrual', 'folicular', 'ovulatoria', 'lutea'] as const
    for (const fase of fases) {
      expect(PHASE_LABEL[fase]).toBeTruthy()
      expect(PHASE_EMOJI[fase]).toBeTruthy()
      expect(PHASE_COLOR[fase]).toBeTruthy()
      expect(PHASE_ADVICE[fase]).toBeTruthy()
      expect(PHASE_SCORE[fase]).toBeGreaterThan(0)
    }
  })

  it('a ovulatória é a fase de maior pontuação e a menstrual a menor', () => {
    expect(PHASE_SCORE).toEqual({ menstrual: 60, folicular: 95, ovulatoria: 100, lutea: 75 })
  })
})
