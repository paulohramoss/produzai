import { describe, it, expect } from 'vitest'
import type { ManualWorkout } from '../store/useWorkoutStore'
import {
  getWeekKey, getMonthKey, getMonthWorkouts, getWeekWorkouts,
  computeXP, computeStreak, computeBadges,
} from './xp'
import { toLocalISO } from './date'

/** Date local a partir de "YYYY-MM-DD", sem passar pelo parser UTC do Date. */
function localDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

let seq = 0
function workout(rawDate: string, extra: Partial<ManualWorkout> = {}): ManualWorkout {
  return {
    id: `w${seq++}`, type: 'Academia', name: 'Treino', rawDate, date: rawDate,
    dist: 0, pace: '', time: '60min', cal: 0, hr: 0, elev: 0,
    ...extra,
  }
}

describe('getWeekKey', () => {
  it('usa a semana ISO, que começa na segunda', () => {
    expect(getWeekKey(localDate('2026-03-22'))).toBe('2026-W12')  // domingo
    expect(getWeekKey(localDate('2026-03-23'))).toBe('2026-W13')  // segunda
    expect(getWeekKey(localDate('2026-03-29'))).toBe('2026-W13')  // domingo seguinte
  })

  it('preenche o número da semana com zero à esquerda', () => {
    expect(getWeekKey(localDate('2026-01-04'))).toBe('2026-W01')
  })

  it('atribui a virada de ano à semana ISO, não ao ano do calendário', () => {
    expect(getWeekKey(localDate('2025-12-29'))).toBe('2026-W01')
    expect(getWeekKey(localDate('2025-12-31'))).toBe('2026-W01')
    expect(getWeekKey(localDate('2026-01-01'))).toBe('2026-W01')
    expect(getWeekKey(localDate('2027-01-03'))).toBe('2026-W53')
  })

  it('ignora a hora do dia', () => {
    expect(getWeekKey(new Date(2026, 2, 22, 0, 0, 0)))
      .toBe(getWeekKey(new Date(2026, 2, 22, 23, 59, 59)))
  })
})

describe('getMonthKey', () => {
  it('formata ano-mês com zero à esquerda, no fuso local', () => {
    expect(getMonthKey(localDate('2026-01-05'))).toBe('2026-01')
    expect(getMonthKey(localDate('2026-09-01'))).toBe('2026-09')
    expect(getMonthKey(localDate('2026-12-31'))).toBe('2026-12')
  })

  it('não pula para o mês seguinte no último dia à noite', () => {
    expect(getMonthKey(new Date(2026, 2, 31, 23, 0, 0))).toBe('2026-03')
  })
})

describe('getMonthWorkouts', () => {
  const treinos = [
    workout('2026-02-28'), workout('2026-03-01'), workout('2026-03-31'), workout('2026-04-01'),
  ]

  it('filtra só os treinos do mês da data dada', () => {
    expect(getMonthWorkouts(treinos, localDate('2026-03-15')).map(w => w.rawDate))
      .toEqual(['2026-03-01', '2026-03-31'])
  })

  it('devolve lista vazia quando o mês não tem treino', () => {
    expect(getMonthWorkouts(treinos, localDate('2026-05-10'))).toEqual([])
    expect(getMonthWorkouts([], localDate('2026-03-15'))).toEqual([])
  })
})

describe('computeXP', () => {
  it('devolve 0 sem treinos', () => {
    expect(computeXP([])).toBe(0)
  })

  it('vale 100 por treino sem caloria nem distância', () => {
    expect(computeXP([workout('2026-03-01')])).toBe(100)
  })

  it('escalona o bônus de caloria em 150, 300 e 500', () => {
    const xp = (cal: number) => computeXP([workout('2026-03-01', { cal })])
    expect(xp(149)).toBe(100)
    expect(xp(150)).toBe(125)
    expect(xp(299)).toBe(125)
    expect(xp(300)).toBe(150)
    expect(xp(499)).toBe(150)
    expect(xp(500)).toBe(175)
    expect(xp(5000)).toBe(175)
  })

  it('escalona o bônus de distância em 5 e 10 km', () => {
    const xp = (dist: number) => computeXP([workout('2026-03-01', { dist })])
    expect(xp(4.9)).toBe(100)
    expect(xp(5)).toBe(130)
    expect(xp(9.9)).toBe(130)
    expect(xp(10)).toBe(150)
    expect(xp(42)).toBe(150)
  })

  it('soma os dois bônus no mesmo treino', () => {
    expect(computeXP([workout('2026-03-01', { cal: 600, dist: 12 })])).toBe(225)
  })

  it('conta no máximo 2 treinos por dia', () => {
    const tres = [
      workout('2026-03-01'), workout('2026-03-01'), workout('2026-03-01'),
    ]
    expect(computeXP(tres)).toBe(200)
  })

  it('o teto é por dia de calendário, não por total', () => {
    expect(computeXP([
      workout('2026-03-01'), workout('2026-03-01'), workout('2026-03-01'),
      workout('2026-03-02'), workout('2026-03-02'),
    ])).toBe(400)
  })

  // SUSPEITO: o corte é `day.slice(0, 2)` na ORDEM EM QUE OS TREINOS APARECEM na
  // lista — não os dois melhores do dia. Um treino fraco registrado antes de
  // dois fortes rouba a vaga, e o mesmo conjunto de treinos rende XP diferente
  // conforme a ordem do array.
  it('o teto diário corta pela ordem da lista, não pelos melhores treinos', () => {
    const fraco = workout('2026-03-01')
    const forte = workout('2026-03-01', { cal: 600, dist: 12 })
    expect(computeXP([fraco, fraco, forte])).toBe(200)
    expect(computeXP([forte, fraco, fraco])).toBe(325)
  })
})

// `computeStreak` e `getWeekWorkouts` leem o relógio por dentro e não aceitam
// data por parâmetro. Para não quebrar na virada do dia nem precisar de mock, os
// treinos abaixo são datados RELATIVOS a hoje — o teste anda junto do calendário.
function diasAtras(n: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return toLocalISO(d)
}

describe('computeStreak', () => {
  it('devolve 0 sem treinos', () => {
    expect(computeStreak([])).toBe(0)
  })

  it('conta 1 com treino só de hoje', () => {
    expect(computeStreak([workout(diasAtras(0))])).toBe(1)
  })

  it('conta dias seguidos terminando em hoje', () => {
    expect(computeStreak([0, 1, 2].map(n => workout(diasAtras(n))))).toBe(3)
  })

  it('ainda conta quando o treino de hoje não veio, contando de ontem', () => {
    expect(computeStreak([1, 2, 3].map(n => workout(diasAtras(n))))).toBe(3)
  })

  it('quebra no primeiro dia sem treino', () => {
    expect(computeStreak([0, 1, 3, 4].map(n => workout(diasAtras(n))))).toBe(2)
  })

  it('devolve 0 quando o treino mais recente é de anteontem', () => {
    expect(computeStreak([workout(diasAtras(2))])).toBe(0)
  })

  it('não conta o mesmo dia duas vezes', () => {
    expect(computeStreak([workout(diasAtras(0)), workout(diasAtras(0))])).toBe(1)
  })

  // SUSPEITO: `computeStreak` não aceita "hoje" por parâmetro (ao contrário de
  // computeTrainingLoad e cycleStateFor), então não dá para calcular a sequência
  // de uma data passada nem testar a virada do dia sem congelar o relógio.
  it('não tem como receber a data de referência', () => {
    expect(computeStreak.length).toBe(1)
  })

  it('ignora treinos datados no futuro', () => {
    const futuro = new Date()
    futuro.setDate(futuro.getDate() + 3)
    expect(computeStreak([workout(toLocalISO(futuro))])).toBe(0)
  })
})

describe('getWeekWorkouts', () => {
  it('devolve lista vazia sem treinos', () => {
    expect(getWeekWorkouts([])).toEqual([])
  })

  it('inclui o que é de hoje', () => {
    expect(getWeekWorkouts([workout(diasAtras(0))])).toHaveLength(1)
  })

  it('descarta o que é de duas semanas atrás', () => {
    expect(getWeekWorkouts([workout(diasAtras(14))])).toEqual([])
  })

  // SUSPEITO: o filtro só tem piso (`>= weekStart`). Treino datado semanas à
  // frente entra na contagem da semana atual — é o número que alimenta o
  // leaderboard (`weeklyWorkouts`).
  it('inclui treino datado no futuro', () => {
    const futuro = new Date()
    futuro.setDate(futuro.getDate() + 30)
    expect(getWeekWorkouts([workout(toLocalISO(futuro))])).toHaveLength(1)
  })
})

describe('computeBadges', () => {
  const ganhou = (badges: ReturnType<typeof computeBadges>, id: string) =>
    badges.find(b => b.id === id)?.earnedAt !== null

  it('devolve as 7 medalhas, todas não ganhas, sem treino nenhum', () => {
    const badges = computeBadges([], 0)
    expect(badges).toHaveLength(7)
    expect(badges.every(b => b.earnedAt === null)).toBe(true)
  })

  it('todas as medalhas têm id, ícone, nome e descrição', () => {
    for (const b of computeBadges([], 0)) {
      expect(b.id).toBeTruthy()
      expect(b.icon).toBeTruthy()
      expect(b.name).toBeTruthy()
      expect(b.desc).toBeTruthy()
    }
  })

  it('primeiro passo sai no primeiro treino', () => {
    expect(ganhou(computeBadges([workout('2026-03-01')], 0), 'first-blood')).toBe(true)
  })

  it('as medalhas de sequência saem em 7 e 30 dias', () => {
    expect(ganhou(computeBadges([], 6), 'week-warrior')).toBe(false)
    expect(ganhou(computeBadges([], 7), 'week-warrior')).toBe(true)
    expect(ganhou(computeBadges([], 29), 'iron-will')).toBe(false)
    expect(ganhou(computeBadges([], 30), 'iron-will')).toBe(true)
  })

  it('centurião sai no centésimo treino', () => {
    const noventa = Array.from({ length: 99 }, () => workout('2026-03-01'))
    expect(ganhou(computeBadges(noventa, 0), 'centurion')).toBe(false)
    expect(ganhou(computeBadges([...noventa, workout('2026-03-02')], 0), 'centurion')).toBe(true)
  })

  it('atleta completo pede 5 tipos distintos', () => {
    const tipos = ['Corrida', 'Academia', 'Ciclismo', 'Natação']
    const quatro = tipos.map(type => workout('2026-03-01', { type }))
    expect(ganhou(computeBadges(quatro, 0), 'variety-pack')).toBe(false)
    expect(ganhou(computeBadges([...quatro, workout('2026-03-01', { type: 'Futebol' })], 0), 'variety-pack'))
      .toBe(true)
  })

  it('incinerador soma as calorias de todos os treinos, sem teto diário', () => {
    expect(ganhou(computeBadges([workout('2026-03-01', { cal: 9999 })], 0), 'calorie-crusher'))
      .toBe(false)
    expect(ganhou(computeBadges([workout('2026-03-01', { cal: 10000 })], 0), 'calorie-crusher'))
      .toBe(true)
  })

  it('maratonista soma 100 km acumulados', () => {
    const noves = Array.from({ length: 10 }, () => workout('2026-03-01', { dist: 9.9 }))
    expect(ganhou(computeBadges(noves, 0), 'distance-king')).toBe(false)
    expect(ganhou(computeBadges([...noves, workout('2026-03-02', { dist: 1 })], 0), 'distance-king'))
      .toBe(true)
  })

  // SUSPEITO: `earnedAt` recebe `Date.now()` no momento do CÁLCULO, não a data
  // em que a medalha foi conquistada. Toda vez que a tela recalcula, a medalha
  // "muda de data" — e o campo não serve para ordenar conquistas nem para dizer
  // "você ganhou isso em março".
  it('earnedAt é a hora do cálculo, não a da conquista', () => {
    const antes = Date.now()
    const badge = computeBadges([workout('2020-01-01')], 0).find(b => b.id === 'first-blood')!
    expect(badge.earnedAt).toBeGreaterThanOrEqual(antes)
  })
})
