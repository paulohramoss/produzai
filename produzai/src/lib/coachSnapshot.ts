// Snapshot do atleta para o coaching proativo.
//
// O cron roda em Node e não consegue importar os motores em TypeScript daqui.
// Em vez de duplicar TRIMP, CTL/ATL e VDOT do lado do servidor — o caminho
// certo para os dois lados divergirem —, o cliente publica um resumo numérico
// compacto sempre que o app abre, e o servidor só aplica limiares em cima dele.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { AthleteProfile } from './athleteProfile'
import type { MentalEntry } from './db'
import type { TrainingPlan } from './plan'
import { buildLoadSeries, computeAcwr, computeMonotony, computeReadiness } from './trainingLoad'
import { estimateFitness } from './fitness'
import { recoveryDeviation } from './recovery'
import { planProgress, todayKey } from './plan'
import { saveCoachSnapshot } from './db'

const DAY_MS = 24 * 60 * 60 * 1000

export interface SnapshotSession {
  date: string
  kind: string
  title: string
  targetMin: number
}

export interface CoachSnapshot {
  updatedAt: number
  /** Fuso do dispositivo — o cron precisa dele para não notificar de madrugada. */
  timeZone: string
  displayName: string | null

  form: number | null
  fitness: number | null
  fatigue: number | null
  acwr: number | null
  acwrStatus: string | null
  monotony: number | null

  readiness: number | null
  readinessLabel: string | null
  readinessTip: string | null

  vdot: number | null

  lastWorkoutDate: string | null
  daysSinceWorkout: number | null
  weeklyWorkouts: number
  previousWeeklyWorkouts: number

  hrvDeviationPct: number | null
  restingHrDelta: number | null

  nextSession: SnapshotSession | null
  todaySession: SnapshotSession | null
  planAdherencePct: number | null
}

export interface SnapshotInput {
  workouts: ManualWorkout[]
  profile: AthleteProfile
  plan: TrainingPlan | null
  mentalHistory: Record<string, MentalEntry>
  displayName?: string | null
}

function countWorkoutsBetween(workouts: ManualWorkout[], fromDaysAgo: number, toDaysAgo: number): number {
  const now = Date.now()
  return workouts.filter(w => {
    const [y, m, d] = w.rawDate.split('-').map(Number)
    const age = (now - new Date(y, m - 1, d).getTime()) / DAY_MS
    return age > toDaysAgo && age <= fromDaysAgo
  }).length
}

function toSnapshotSession(s: TrainingPlan['sessions'][number]): SnapshotSession {
  return { date: s.date, kind: s.kind, title: s.title, targetMin: s.targetMin }
}

function daysSince(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const then = new Date(y, m - 1, d).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - then) / DAY_MS))
}

export function buildCoachSnapshot(input: SnapshotInput): CoachSnapshot {
  const { workouts, profile, plan, mentalHistory } = input
  const today = todayKey()

  const series = buildLoadSeries(workouts, profile, 90)
  const last = series.length >= 14 ? series[series.length - 1] : null
  const acwr = computeAcwr(workouts, profile)
  const monotony = computeMonotony(workouts, profile)
  const fitness = estimateFitness(workouts)
  const deviation = recoveryDeviation(mentalHistory, today)
  const todayMental = mentalHistory[today]

  const readiness = computeReadiness({
    form: last?.form ?? null,
    acwr,
    sleepHours: todayMental?.sleepHours ?? null,
    mood: todayMental?.mood ?? null,
    energy: todayMental?.energy ?? null,
    hrvDeviationPct: deviation.hrvDeviationPct,
    restingHrDelta: deviation.restingHrDelta,
  })

  const lastWorkoutDate = workouts.length > 0
    ? workouts.reduce((max, w) => (w.rawDate > max ? w.rawDate : max), workouts[0].rawDate)
    : null

  const upcoming = plan?.sessions
    .filter(s => s.date >= today && s.status !== 'done' && s.kind !== 'rest')
    .sort((a, b) => a.date.localeCompare(b.date)) ?? []

  const todaySession = plan?.sessions.find(s => s.date === today && s.kind !== 'rest') ?? null
  const progress = plan ? planProgress(plan) : null

  return {
    updatedAt: Date.now(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    displayName: input.displayName ?? null,

    form: last?.form ?? null,
    fitness: last?.fitness ?? null,
    fatigue: last?.fatigue ?? null,
    acwr: acwr?.ratio ?? null,
    acwrStatus: acwr?.status ?? null,
    monotony: monotony?.monotony ?? null,

    readiness: readiness.confidence >= 2 ? readiness.score : null,
    readinessLabel: readiness.confidence >= 2 ? readiness.label : null,
    readinessTip: readiness.confidence >= 2 ? readiness.recommendation : null,

    vdot: fitness?.vdot ?? null,

    lastWorkoutDate,
    daysSinceWorkout: lastWorkoutDate ? daysSince(lastWorkoutDate) : null,
    weeklyWorkouts: countWorkoutsBetween(workouts, 7, 0),
    previousWeeklyWorkouts: countWorkoutsBetween(workouts, 14, 7),

    hrvDeviationPct: deviation.hrvDeviationPct,
    restingHrDelta: deviation.restingHrDelta,

    nextSession: upcoming[0] ? toSnapshotSession(upcoming[0]) : null,
    todaySession: todaySession ? toSnapshotSession(todaySession) : null,
    planAdherencePct: progress && progress.done + progress.missed > 0 ? progress.adherencePct : null,
  }
}

/** Publica o snapshot. Falha silenciosa: é telemetria de coaching, não fluxo crítico. */
export async function publishCoachSnapshot(input: SnapshotInput): Promise<void> {
  try {
    await saveCoachSnapshot(buildCoachSnapshot(input))
  } catch { /* noop */ }
}
