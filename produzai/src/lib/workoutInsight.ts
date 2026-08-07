// Orquestra o insight de um treino: busca os streams (quando o treino veio do
// Strava), calcula a análise localmente, monta o briefing e só então chama a IA.
// A análise é gratuita e sempre roda; a leitura da IA é sob demanda e fica em
// cache no Firestore para não ser paga duas vezes pelo mesmo treino.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { AthleteProfile } from './athleteProfile'
import { getWorkoutInsight, saveWorkoutInsight, type WorkoutInsight } from './db'
import { fetchStravaActivityDetail } from './strava'
import { generateWorkoutSummary } from './anthropic'
import { parseDurationToMinutes } from './performance'
import {
  analyzeStreams, analyzeFromSummary, compareWithSimilar, describeForAI,
  type WorkoutAnalysis,
} from './workoutAnalysis'

function fallbackOf(w: ManualWorkout) {
  return {
    durationMin: parseDurationToMinutes(w.time) ?? 0,
    distKm: w.dist,
    avgHr: w.hr,
  }
}

/**
 * Análise do treino, sem IA. Usa os streams do Strava quando existem; cai para o
 * resumo quando o treino foi registrado à mão ou não tem série temporal.
 */
export async function buildAnalysis(
  w: ManualWorkout,
  profile: AthleteProfile | null,
): Promise<WorkoutAnalysis> {
  if (w.source === 'strava' && w.stravaId) {
    const detail = await fetchStravaActivityDetail(w.stravaId)
    if (detail) return analyzeStreams(detail.streams, profile, fallbackOf(w))
  }
  return analyzeFromSummary(fallbackOf(w), profile)
}

/** Resumo em uma linha da semana em que o treino aconteceu — contexto para a IA. */
function weekContextOf(target: ManualWorkout, all: ManualWorkout[]): string {
  const [y, m, d] = target.rawDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() || 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - day + 1)

  const inWeek = all.filter(w => {
    const [wy, wm, wd] = w.rawDate.split('-').map(Number)
    const dt = new Date(wy, wm - 1, wd)
    return dt >= monday && dt <= date
  })

  const km = Math.round(inWeek.reduce((s, w) => s + w.dist, 0) * 10) / 10
  const minutes = inWeek.reduce((s, w) => s + (parseDurationToMinutes(w.time) ?? 0), 0)

  return [
    `Treinos na semana até aqui: ${inWeek.length}`,
    km > 0 ? `Volume acumulado: ${km} km` : null,
    minutes > 0 ? `Tempo acumulado: ${minutes} min` : null,
    inWeek.length > 1 ? `Sessões: ${inWeek.map(w => `${w.name} (${w.type}, ${w.time})`).join(' · ')}` : null,
  ].filter(Boolean).join('\n')
}

export interface EnsureOptions {
  /** Gera (ou regenera) a leitura da IA. Sem isso só a análise local é feita. */
  withAI?: boolean
  /** Ignora o cache e recalcula tudo. */
  force?: boolean
  userName?: string
}

/**
 * Devolve o insight do treino, reaproveitando o que já estiver salvo.
 * Retorna null apenas se a análise falhar por completo.
 */
export async function ensureWorkoutInsight(
  workout: ManualWorkout,
  allWorkouts: ManualWorkout[],
  profile: AthleteProfile | null,
  opts: EnsureOptions = {},
): Promise<WorkoutInsight | null> {
  const cached = opts.force ? null : await getWorkoutInsight(workout.id)

  // Já tem tudo que foi pedido: nada a fazer.
  if (cached && (!opts.withAI || cached.summary)) return cached

  const analysis = cached?.analysis ?? await buildAnalysis(workout, profile)

  let summary = cached?.summary
  if (opts.withAI) {
    const comparison = compareWithSimilar(workout, allWorkouts)
    const briefing = describeForAI(workout, analysis, comparison, profile)
    const result = await generateWorkoutSummary(
      briefing,
      weekContextOf(workout, allWorkouts),
      opts.userName,
    )
    if (result) summary = result
  }

  const insight: WorkoutInsight = {
    workoutId: workout.id,
    analysis,
    generatedAt: Date.now(),
    // O Firestore rejeita `undefined` — o campo só entra quando existe de fato.
    ...(summary ? { summary } : {}),
  }

  await saveWorkoutInsight(insight)
  return insight
}
