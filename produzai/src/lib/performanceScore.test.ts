import { describe, it, expect } from 'vitest'
import type { ManualWorkout } from '../store/useWorkoutStore'
import type { DailyData, MentalEntry, ReadinessEntry } from './db'
import type { DietCompliance } from '../store/useWebDietStore'
import type { CycleData } from './cycle'
import {
  computeDayScore, buildWeekPerformance, diagnoseWeek, findStrongestFactor,
  type DayFactors, type DayPerformance,
} from './performanceScore'

const factors = (o: Partial<DayFactors> = {}): DayFactors => ({
  sleepHours: null, dietStatus: null, trainingMinutes: 0,
  moodEnergyAvg: null, readinessScore: null, cyclePhase: null,
  ...o,
})

const day = (date: string, score: number | null, f: DayFactors = factors()): DayPerformance =>
  ({ date, weekday: 'Segunda', score, factors: f })

const readiness = (sleepHours: number): ReadinessEntry =>
  ({ sleepHours, sleepQuality: 4, soreness: 2, drive: 4, loggedAt: 0 })

describe('computeDayScore — quando existe pontuação', () => {
  it('devolve null para um dia sem nenhum dado', () => {
    expect(computeDayScore(factors())).toBeNull()
  })

  it('devolve null quando o único dado é treino de 0 minuto', () => {
    expect(computeDayScore(factors({ trainingMinutes: 0 }))).toBeNull()
  })

  // SUSPEITO: a fase do ciclo entra no cálculo (`parts.push(PHASE_SCORE[...])`)
  // mas não conta como "tem dado". Um dia em que só o ciclo está registrado
  // devolve null, e o mesmo dia com qualquer outro dado passa a somar o ciclo.
  it('a fase do ciclo sozinha não faz o dia ter pontuação', () => {
    expect(computeDayScore(factors({ cyclePhase: 'ovulatoria' }))).toBeNull()
  })

  it('qualquer um dos outros fatores já basta', () => {
    expect(computeDayScore(factors({ sleepHours: 8 }))).not.toBeNull()
    expect(computeDayScore(factors({ dietStatus: 'skipped' }))).not.toBeNull()
    expect(computeDayScore(factors({ moodEnergyAvg: 1 }))).not.toBeNull()
    expect(computeDayScore(factors({ readinessScore: 0 }))).not.toBeNull()
    expect(computeDayScore(factors({ trainingMinutes: 1 }))).not.toBeNull()
  })
})

describe('computeDayScore — média dos fatores presentes', () => {
  // O treino SEMPRE entra na média, mesmo em dia sem treino: sem treino vale 30.
  it('o treino entra na média mesmo quando não houve treino', () => {
    expect(computeDayScore(factors({ sleepHours: 8 }))).toBe(65)   // (100 + 30) / 2
  })

  it('treino de 60 min vale 100 e mais que isso não sobe', () => {
    expect(computeDayScore(factors({ trainingMinutes: 60 }))).toBe(100)
    expect(computeDayScore(factors({ trainingMinutes: 120 }))).toBe(100)
    expect(computeDayScore(factors({ trainingMinutes: 30 }))).toBe(65)  // 30 + 35
  })

  it('pontua a dieta pela tabela de status', () => {
    const dieta = (status: DietCompliance['status']) =>
      computeDayScore(factors({ dietStatus: status, trainingMinutes: 60 }))
    expect(dieta('perfect')).toBe(100)
    expect(dieta('good')).toBe(88)      // (75 + 100) / 2
    expect(dieta('alcohol')).toBe(70)   // (40 + 100) / 2
    expect(dieta('skipped')).toBe(60)   // (20 + 100) / 2
  })

  it('usa a mesma faixa de sono da prontidão: 7 a 9 horas é cheio', () => {
    const sono = (h: number) => computeDayScore(factors({ sleepHours: h, trainingMinutes: 60 }))
    expect(sono(7)).toBe(100)
    expect(sono(9)).toBe(100)
    expect(sono(6)).toBe(90)   // (80 + 100) / 2
    expect(sono(0)).toBe(50)   // (0 + 100) / 2 — não fica negativo
  })

  it('converte humor/energia de 1–5 em 0–100', () => {
    const humor = (v: number) => computeDayScore(factors({ moodEnergyAvg: v, trainingMinutes: 60 }))
    expect(humor(1)).toBe(50)   // (0 + 100) / 2
    expect(humor(3)).toBe(75)   // (50 + 100) / 2
    expect(humor(5)).toBe(100)
  })

  it('usa a prontidão como está, sem reescalar', () => {
    expect(computeDayScore(factors({ readinessScore: 40, trainingMinutes: 60 }))).toBe(70)
  })

  it('soma a fase do ciclo quando há outro dado no dia', () => {
    expect(computeDayScore(factors({ sleepHours: 8, cyclePhase: 'menstrual' }))).toBe(63)
    expect(computeDayScore(factors({ sleepHours: 8, cyclePhase: 'ovulatoria' }))).toBe(77)
  })

  it('dia completo e perfeito fecha em 100', () => {
    expect(computeDayScore(factors({
      sleepHours: 8, dietStatus: 'perfect', trainingMinutes: 60,
      moodEnergyAvg: 5, readinessScore: 100, cyclePhase: 'ovulatoria',
    }))).toBe(100)
  })
})

describe('buildWeekPerformance', () => {
  const DATES = ['2026-03-22', '2026-03-23', '2026-03-24']

  it('devolve uma linha por data pedida, mesmo sem dado nenhum', () => {
    const semana = buildWeekPerformance(DATES, {}, [], [])
    expect(semana.map(d => d.date)).toEqual(DATES)
    expect(semana.every(d => d.score === null)).toBe(true)
  })

  it('devolve lista vazia para lista de datas vazia', () => {
    expect(buildWeekPerformance([], {}, [], [])).toEqual([])
  })

  it('nomeia o dia da semana em português', () => {
    const semana = buildWeekPerformance(['2026-03-22', '2026-03-23', '2026-03-28'], {}, [], [])
    expect(semana.map(d => d.weekday)).toEqual(['Domingo', 'Segunda', 'Sábado'])
  })

  it('soma os minutos de todos os treinos do mesmo dia', () => {
    const treino = (rawDate: string, time: string): ManualWorkout => ({
      id: `w-${rawDate}-${time}`, type: 'Academia', name: 'T', rawDate, date: rawDate,
      dist: 0, pace: '', time, cal: 0, hr: 0, elev: 0,
    })
    const semana = buildWeekPerformance(DATES, {}, [], [
      treino('2026-03-23', '45min'), treino('2026-03-23', '1h15'),
    ])
    expect(semana[1].factors.trainingMinutes).toBe(120)
  })

  it('conta 0 minuto para treino com duração ilegível', () => {
    const semana = buildWeekPerformance(DATES, {}, [], [{
      id: 'x', type: 'Academia', name: 'T', rawDate: '2026-03-23', date: '',
      dist: 0, pace: '', time: 'uma hora', cal: 0, hr: 0, elev: 0,
    }])
    expect(semana[1].factors.trainingMinutes).toBe(0)
  })

  it('prefere o sono do check-in de prontidão ao da página Mental', () => {
    const mental: Record<string, MentalEntry> = {
      '2026-03-23': { mood: 3, energy: 3, gratitude: '', note: '', sleepHours: 6 },
    }
    const daily: Record<string, DailyData> = { '2026-03-23': { readiness: readiness(8) } }
    expect(buildWeekPerformance(DATES, mental, [], [], daily)[1].factors.sleepHours).toBe(8)
    expect(buildWeekPerformance(DATES, mental, [], [], {})[1].factors.sleepHours).toBe(6)
  })

  it('tira a média de humor e energia, ignorando os zeros', () => {
    const mental: Record<string, MentalEntry> = {
      '2026-03-22': { mood: 4, energy: 2, gratitude: '', note: '' },
      '2026-03-23': { mood: 4, energy: 0, gratitude: '', note: '' },
      '2026-03-24': { mood: 0, energy: 0, gratitude: '', note: '' },
    }
    const semana = buildWeekPerformance(DATES, mental, [], [])
    expect(semana.map(d => d.factors.moodEnergyAvg)).toEqual([3, 4, null])
  })

  it('casa a dieta pela data', () => {
    const compliance: DietCompliance[] = [{ date: '2026-03-23', status: 'alcohol' }]
    const semana = buildWeekPerformance(DATES, {}, compliance, [])
    expect(semana.map(d => d.factors.dietStatus)).toEqual([null, 'alcohol', null])
  })

  it('calcula a prontidão do dia a partir do check-in gravado', () => {
    const daily: Record<string, DailyData> = { '2026-03-23': { readiness: readiness(8) } }
    expect(buildWeekPerformance(DATES, {}, [], [], daily)[1].factors.readinessScore).toBe(83)
  })

  it('só traz a fase do ciclo quando o acompanhamento está ligado', () => {
    const cycle: CycleData = { enabled: true, avgLength: 28, periodLength: 5, starts: ['2026-03-20'] }
    expect(buildWeekPerformance(['2026-03-22'], {}, [], [], {}, cycle)[0].factors.cyclePhase)
      .toBe('menstrual')
    expect(buildWeekPerformance(['2026-03-22'], {}, [], [], {}, { ...cycle, enabled: false })[0].factors.cyclePhase)
      .toBeNull()
    expect(buildWeekPerformance(['2026-03-22'], {}, [], [], {}, null)[0].factors.cyclePhase)
      .toBeNull()
  })
})

describe('diagnoseWeek', () => {
  it('não diagnostica com menos de dois dias pontuados', () => {
    expect(diagnoseWeek([])).toEqual({ best: null, worst: null, bestText: '', worstText: '' })
    expect(diagnoseWeek([day('2026-03-22', 50)]))
      .toEqual({ best: null, worst: null, bestText: '', worstText: '' })
    expect(diagnoseWeek([day('2026-03-22', null), day('2026-03-23', null)]))
      .toEqual({ best: null, worst: null, bestText: '', worstText: '' })
  })

  // SUSPEITO: quando todos os dias empatam, o retorno fica meio preenchido —
  // `best` vem com o dia, `worst` vem null e os dois textos vêm vazios. Quem
  // consome precisa checar os textos, não `best`, para saber se há diagnóstico.
  it('com todos os dias empatados devolve best preenchido e worst null', () => {
    const r = diagnoseWeek([day('2026-03-22', 50), day('2026-03-23', 50)])
    expect(r.best?.date).toBe('2026-03-22')
    expect(r.worst).toBeNull()
    expect(r.bestText).toBe('')
    expect(r.worstText).toBe('')
  })

  it('elege melhor e pior dia e descreve os dois', () => {
    const r = diagnoseWeek([
      { date: '2026-03-22', weekday: 'Domingo', score: 80, factors: factors({
        sleepHours: 8, dietStatus: 'perfect', trainingMinutes: 60,
        readinessScore: 90, cyclePhase: 'lutea',
      }) },
      { date: '2026-03-23', weekday: 'Segunda', score: 40, factors: factors() },
    ])
    expect(r.best?.date).toBe('2026-03-22')
    expect(r.worst?.date).toBe('2026-03-23')
    expect(r.bestText)
      .toBe('Seu melhor dia foi Domingo (80/100) — dormiu 8h, prontidão 90/100, treinou 60min, dieta em dia, fase lútea.')
    expect(r.worstText)
      .toBe('Seu dia mais fraco foi Segunda (40/100) — sono não registrado, não treinou, dieta não registrada.')
  })

  it('ignora os dias sem pontuação ao eleger os extremos', () => {
    const r = diagnoseWeek([
      day('2026-03-22', null), day('2026-03-23', 90), day('2026-03-24', 10),
    ])
    expect(r.best?.date).toBe('2026-03-23')
    expect(r.worst?.date).toBe('2026-03-24')
  })

  it('em empate no topo mantém o primeiro dia da lista', () => {
    const r = diagnoseWeek([day('2026-03-22', 90), day('2026-03-23', 90), day('2026-03-24', 10)])
    expect(r.best?.date).toBe('2026-03-22')
  })

  // SUSPEITO: o texto do sono aqui sai como "dormiu 7.5h", enquanto readiness.ts
  // formata a mesma informação como "7h30". Dois formatos para o mesmo dado.
  it('descreve meia hora de sono em decimal', () => {
    const r = diagnoseWeek([
      day('2026-03-22', 80, factors({ sleepHours: 7.5 })), day('2026-03-23', 40),
    ])
    expect(r.bestText).toContain('dormiu 7.5h')
  })
})

describe('findStrongestFactor', () => {
  const serie = (n: number, comSono = true) =>
    Array.from({ length: n }, (_, i) => day(`d${i}`, 50 + i * 10, factors({
      sleepHours: comSono ? 5 + i : null,
      trainingMinutes: i * 10,
    })))

  it('devolve null com menos de 4 dias pontuados', () => {
    expect(findStrongestFactor(serie(3))).toBeNull()
  })

  // SUSPEITO: a guarda é `withScore.length < 4`, mas `pearson` exige 5 pontos
  // (`if (n < 5) return null`). Com exatamente 4 dias nenhuma correlação é
  // calculável e a função devolve null mesmo tendo passado da guarda — o 4 do
  // código nunca vale nada.
  it('ainda devolve null com exatamente 4 dias, apesar da guarda em 4', () => {
    expect(findStrongestFactor(serie(4))).toBeNull()
  })

  it('a partir de 5 dias aponta o fator mais correlacionado', () => {
    expect(findStrongestFactor(serie(5)))
      .toEqual({ factor: 'sono', corr: 1, text: 'horas de sono' })
  })

  it('devolve null quando nenhum fator varia', () => {
    const chapado = Array.from({ length: 5 }, (_, i) =>
      day(`d${i}`, 50, factors({ sleepHours: 8 })))
    expect(findStrongestFactor(chapado)).toBeNull()
  })

  it('cai para o treino quando o sono não foi registrado', () => {
    expect(findStrongestFactor(serie(5, false)))
      .toEqual({ factor: 'treino', corr: 1, text: 'minutos de treino' })
  })

  it('escolhe pelo módulo da correlação, não pelo sinal', () => {
    // Sono cai enquanto a pontuação sobe (corr -1); treino fica parado.
    const dias = Array.from({ length: 5 }, (_, i) =>
      day(`d${i}`, 50 + i * 10, factors({ sleepHours: 10 - i, trainingMinutes: 30 })))
    expect(findStrongestFactor(dias)).toEqual({ factor: 'sono', corr: -1, text: 'horas de sono' })
  })

  it('correlaciona a fase do ciclo quando ela está presente', () => {
    const fases = ['menstrual', 'lutea', 'folicular', 'ovulatoria', 'menstrual'] as const
    const dias = fases.map((fase, i) =>
      day(`d${i}`, [60, 75, 95, 100, 60][i], factors({ cyclePhase: fase, trainingMinutes: 30 })))
    const r = findStrongestFactor(dias)
    expect(r?.factor).toBe('ciclo')
    expect(r?.corr).toBe(1)
    expect(r?.text).toBe('fase do ciclo menstrual')
  })
})
