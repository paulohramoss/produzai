import type { ManualWorkout } from '../store/useWorkoutStore'
import type { MentalEntry } from './db'
import type { ComplianceStatus, DietCompliance } from '../store/useWebDietStore'
import { parseDurationToMinutes } from './performance'
import { pearson } from './patterns'

export interface DayFactors {
  sleepHours: number | null
  dietStatus: ComplianceStatus | null
  trainingMinutes: number
  moodEnergyAvg: number | null
}

export interface DayPerformance {
  date: string
  weekday: string
  score: number | null
  factors: DayFactors
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const DIET_LABELS: Record<ComplianceStatus, string> = {
  perfect: 'dieta em dia',
  good: 'dieta ok',
  alcohol: 'bebeu álcool',
  skipped: 'pulou refeições',
}

function sleepScore(hours: number): number {
  if (hours >= 7 && hours <= 9) return 100
  const diff = hours < 7 ? 7 - hours : hours - 9
  return Math.max(0, 100 - diff * 20)
}

function dietScore(status: ComplianceStatus): number {
  const table: Record<ComplianceStatus, number> = { perfect: 100, good: 75, alcohol: 40, skipped: 20 }
  return table[status]
}

function trainingScore(minutes: number): number {
  if (minutes <= 0) return 30
  return Math.min(100, 30 + (minutes / 60) * 70)
}

function moodEnergyScore(avg: number): number {
  return Math.round(((avg - 1) / 4) * 100)
}

export function computeDayScore(f: DayFactors): number | null {
  const hasData = f.sleepHours != null || f.dietStatus != null || f.moodEnergyAvg != null || f.trainingMinutes > 0
  if (!hasData) return null
  const parts: number[] = []
  if (f.sleepHours != null) parts.push(sleepScore(f.sleepHours))
  if (f.dietStatus != null) parts.push(dietScore(f.dietStatus))
  if (f.moodEnergyAvg != null) parts.push(moodEnergyScore(f.moodEnergyAvg))
  parts.push(trainingScore(f.trainingMinutes))
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
}

function weekdayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

/** Monta o espelho de performance dos últimos `dates` dias, cruzando sono, dieta e treino. */
export function buildWeekPerformance(
  dates: string[],
  mentalHistory: Record<string, MentalEntry>,
  compliance: DietCompliance[],
  workouts: ManualWorkout[],
): DayPerformance[] {
  const complianceByDate = new Map(compliance.map(c => [c.date, c.status]))
  const minutesByDate = new Map<string, number>()
  for (const w of workouts) {
    const minutes = parseDurationToMinutes(w.time) ?? 0
    minutesByDate.set(w.rawDate, (minutesByDate.get(w.rawDate) ?? 0) + minutes)
  }

  return dates.map(date => {
    const mental = mentalHistory[date]
    const moods: number[] = []
    if (mental?.mood > 0) moods.push(mental.mood)
    if (mental?.energy > 0) moods.push(mental.energy)

    const factors: DayFactors = {
      sleepHours: mental?.sleepHours ?? null,
      dietStatus: complianceByDate.get(date) ?? null,
      trainingMinutes: minutesByDate.get(date) ?? 0,
      moodEnergyAvg: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
    }

    return { date, weekday: weekdayOf(date), score: computeDayScore(factors), factors }
  })
}

function describeDay(day: DayPerformance): string {
  const { factors } = day
  const parts: string[] = []
  parts.push(factors.sleepHours != null ? `dormiu ${factors.sleepHours}h` : 'sono não registrado')
  parts.push(factors.trainingMinutes > 0 ? `treinou ${factors.trainingMinutes}min` : 'não treinou')
  parts.push(factors.dietStatus != null ? DIET_LABELS[factors.dietStatus] : 'dieta não registrada')
  return parts.join(', ')
}

export interface WeekDiagnosis {
  best: DayPerformance | null
  worst: DayPerformance | null
  bestText: string
  worstText: string
}

export function diagnoseWeek(days: DayPerformance[]): WeekDiagnosis {
  const scored = days.filter((d): d is DayPerformance & { score: number } => d.score !== null)
  if (scored.length < 2) return { best: null, worst: null, bestText: '', worstText: '' }

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a))
  const worst = scored.reduce((a, b) => (b.score < a.score ? b : a))

  if (best.date === worst.date) return { best, worst: null, bestText: '', worstText: '' }

  return {
    best,
    worst,
    bestText: `Seu melhor dia foi ${best.weekday} (${best.score}/100) — ${describeDay(best)}.`,
    worstText: `Seu dia mais fraco foi ${worst.weekday} (${worst.score}/100) — ${describeDay(worst)}.`,
  }
}

export interface FactorCorrelation {
  factor: 'sono' | 'treino' | 'dieta'
  corr: number
  text: string
}

/** Qual fator (sono, treino, dieta) mais acompanha a variação da pontuação de performance na semana. */
export function findStrongestFactor(days: DayPerformance[]): FactorCorrelation | null {
  const withScore = days.filter((d): d is DayPerformance & { score: number } => d.score !== null)
  if (withScore.length < 4) return null

  const candidates: FactorCorrelation[] = []

  const sleepPairs = withScore.filter(d => d.factors.sleepHours != null)
  const sleepCorr = pearson(sleepPairs.map(d => d.factors.sleepHours!), sleepPairs.map(d => d.score))
  if (sleepCorr !== null) candidates.push({ factor: 'sono', corr: sleepCorr, text: 'horas de sono' })

  const trainingCorr = pearson(withScore.map(d => d.factors.trainingMinutes), withScore.map(d => d.score))
  if (trainingCorr !== null) candidates.push({ factor: 'treino', corr: trainingCorr, text: 'minutos de treino' })

  const dietPairs = withScore.filter(d => d.factors.dietStatus != null)
  const dietCorr = pearson(dietPairs.map(d => dietScore(d.factors.dietStatus!)), dietPairs.map(d => d.score))
  if (dietCorr !== null) candidates.push({ factor: 'dieta', corr: dietCorr, text: 'consistência da dieta' })

  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (Math.abs(b.corr) > Math.abs(a.corr) ? b : a))
}
