import type { ManualWorkout } from '../store/useWorkoutStore'
import type { DailyData, MentalEntry } from './db'

/** Pace só faz sentido comparar dentro do mesmo tipo de atividade — corrida é o caso canônico. */
const RUNNING_TYPE = 'Corrida'

export interface WeekBucket {
  start: Date
  end: Date
  label: string
}

function mondayOf(d: Date): Date {
  const day = d.getDay() || 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function shortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Últimas `weeks` semanas (seg-dom), da mais antiga para a mais recente. */
export function getWeekBuckets(weeks: number): WeekBucket[] {
  const currentMonday = mondayOf(new Date())
  const buckets: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentMonday)
    start.setDate(start.getDate() - i * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    buckets.push({ start, end, label: shortDate(start) })
  }
  return buckets
}

function dateStrToDate(raw: string): Date {
  const [y, m, d] = raw.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export interface WeeklyVolumePoint {
  label: string
  km: number
  count: number
  cal: number
}

export function aggregateWorkoutsByWeek(workouts: ManualWorkout[], buckets: WeekBucket[]): WeeklyVolumePoint[] {
  return buckets.map(b => {
    const inBucket = workouts.filter(w => {
      const dt = dateStrToDate(w.rawDate)
      return dt >= b.start && dt < b.end
    })
    return {
      label: b.label,
      km: Math.round(inBucket.reduce((s, w) => s + w.dist, 0) * 10) / 10,
      count: inBucket.length,
      cal: inBucket.reduce((s, w) => s + w.cal, 0),
    }
  })
}

export interface WeeklyWellbeingPoint {
  label: string
  workouts: number
  avgMood: number | null
  avgEnergy: number | null
}

export function aggregateWellbeingByWeek(
  dailyHistory: Record<string, DailyData>,
  mentalHistory: Record<string, MentalEntry>,
  workouts: ManualWorkout[],
  buckets: WeekBucket[],
): WeeklyWellbeingPoint[] {
  return buckets.map(b => {
    const moods: number[] = []
    const energies: number[] = []
    for (const key of Object.keys(mentalHistory)) {
      const dt = dateStrToDate(key)
      if (dt < b.start || dt >= b.end) continue
      const entry = mentalHistory[key]
      if (entry?.mood > 0) moods.push(entry.mood)
      if (entry?.energy > 0) energies.push(entry.energy)
    }
    void dailyHistory
    const workoutCount = workouts.filter(w => {
      const dt = dateStrToDate(w.rawDate)
      return dt >= b.start && dt < b.end
    }).length
    return {
      label: b.label,
      workouts: workoutCount,
      avgMood: moods.length ? Math.round((moods.reduce((a, c) => a + c, 0) / moods.length) * 10) / 10 : null,
      avgEnergy: energies.length ? Math.round((energies.reduce((a, c) => a + c, 0) / energies.length) * 10) / 10 : null,
    }
  })
}

/** "M'SS\"" -> minutos decimais (ex: "5'30\"" -> 5.5) */
export function parsePaceToMinutes(pace: string): number | null {
  const match = /^(\d+)'(\d+)"$/.exec(pace.trim())
  if (!match) return null
  const min = Number(match[1])
  const sec = Number(match[2])
  return Math.round((min + sec / 60) * 100) / 100
}

/** "1h30" ou "45min" -> minutos totais */
export function parseDurationToMinutes(time: string): number | null {
  const hourMatch = /^(\d+)h(\d+)$/.exec(time.trim())
  if (hourMatch) return Number(hourMatch[1]) * 60 + Number(hourMatch[2])
  const minMatch = /^(\d+)min$/.exec(time.trim())
  if (minMatch) return Number(minMatch[1])
  return null
}

export interface PaceTrendPoint {
  label: string
  pace: number
  name: string
}

/** Evolução do ritmo (min/km) nas últimas corridas com distância registrada. */
export function buildPaceTrend(workouts: ManualWorkout[], limit = 12): PaceTrendPoint[] {
  const withPace = workouts
    .filter(w => w.type === RUNNING_TYPE && w.dist >= 1)
    .map(w => ({ w, pace: parsePaceToMinutes(w.pace) }))
    .filter((x): x is { w: ManualWorkout; pace: number } => x.pace !== null)
    .sort((a, b) => a.w.rawDate.localeCompare(b.w.rawDate))
    .slice(-limit)

  return withPace.map(({ w, pace }) => ({
    label: shortDate(dateStrToDate(w.rawDate)),
    pace,
    name: w.name,
  }))
}

export interface PersonalRecords {
  bestPace: { value: number; workout: ManualWorkout } | null
  longestDist: { value: number; workout: ManualWorkout } | null
  longestDuration: { value: number; workout: ManualWorkout } | null
  mostCal: { value: number; workout: ManualWorkout } | null
}

export function computeRecords(workouts: ManualWorkout[]): PersonalRecords {
  let bestPace: PersonalRecords['bestPace'] = null
  let longestDist: PersonalRecords['longestDist'] = null
  let longestDuration: PersonalRecords['longestDuration'] = null
  let mostCal: PersonalRecords['mostCal'] = null

  for (const w of workouts) {
    if (w.type === RUNNING_TYPE && w.dist >= 1) {
      const pace = parsePaceToMinutes(w.pace)
      if (pace !== null && (bestPace === null || pace < bestPace.value)) {
        bestPace = { value: pace, workout: w }
      }
    }
    if (w.dist > 0 && (longestDist === null || w.dist > longestDist.value)) {
      longestDist = { value: w.dist, workout: w }
    }
    const durationMin = parseDurationToMinutes(w.time)
    if (durationMin !== null && (longestDuration === null || durationMin > longestDuration.value)) {
      longestDuration = { value: durationMin, workout: w }
    }
    if (w.cal > 0 && (mostCal === null || w.cal > mostCal.value)) {
      mostCal = { value: w.cal, workout: w }
    }
  }

  return { bestPace, longestDist, longestDuration, mostCal }
}

export interface TrainingDayComparison {
  trainMood: number | null
  restMood: number | null
  trainEnergy: number | null
  restEnergy: number | null
  trainDays: number
  restDays: number
}

/** Compara humor/energia médios em dias com treino registrado vs. dias sem treino. */
export function compareTrainingVsRestDays(
  mentalHistory: Record<string, MentalEntry>,
  workouts: ManualWorkout[],
): TrainingDayComparison {
  const workoutDates = new Set(workouts.map(w => w.rawDate))
  const trainMoods: number[] = [], restMoods: number[] = []
  const trainEnergies: number[] = [], restEnergies: number[] = []
  let trainDays = 0, restDays = 0

  for (const [date, entry] of Object.entries(mentalHistory)) {
    const hasMood = entry.mood > 0
    const hasEnergy = entry.energy > 0
    if (!hasMood && !hasEnergy) continue
    const isTrainDay = workoutDates.has(date)
    if (isTrainDay) trainDays++
    else restDays++
    if (hasMood) (isTrainDay ? trainMoods : restMoods).push(entry.mood)
    if (hasEnergy) (isTrainDay ? trainEnergies : restEnergies).push(entry.energy)
  }

  const avg = (xs: number[]) => xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null
  return {
    trainMood: avg(trainMoods),
    restMood: avg(restMoods),
    trainEnergy: avg(trainEnergies),
    restEnergy: avg(restEnergies),
    trainDays,
    restDays,
  }
}

export function formatPace(minutes: number): string {
  const m = Math.floor(minutes)
  const s = Math.round((minutes - m) * 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}
