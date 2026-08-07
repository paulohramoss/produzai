// Ponte entre os motores locais (carga, fitness, recuperação) e a geração do
// plano pela IA. Todo número que a IA vê passa por aqui — ela nunca calcula
// condicionamento nem ritmo, só distribui as sessões.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { AthleteProfile } from './athleteProfile'
import { ageOf, maxHrOf, restingHrOf, weightOf } from './athleteProfile'
import { buildLoadSeries, computeAcwr, computeMonotony, describeLoadForAI } from './trainingLoad'
import { estimateFitness, describeFitnessForAI } from './fitness'
import { parseDurationToMinutes } from './performance'
import { callTrainingPlan } from './anthropic'
import { todayKey, type TrainingPlan } from './plan'

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const PLAN_DAYS = 14

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function weekdayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

/** Últimos 14 dias de treino, um por linha — o histórico imediato que importa. */
function recentTraining(workouts: ManualWorkout[], today: string): string {
  const from = addDays(today, -14)
  const recent = workouts
    .filter(w => w.rawDate >= from && w.rawDate <= today)
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))

  if (recent.length === 0) return 'Nenhum treino registrado nos últimos 14 dias.'

  const totalMin = recent.reduce((s, w) => s + (parseDurationToMinutes(w.time) ?? 0), 0)
  const totalKm = Math.round(recent.reduce((s, w) => s + w.dist, 0) * 10) / 10

  return [
    `${recent.length} sessões · ${totalKm} km · ${totalMin} min nos últimos 14 dias`,
    ...recent.map(w => `  • ${w.rawDate} (${weekdayName(w.rawDate)}): ${w.name} — ${w.type}, ${w.time}${w.dist > 0 ? `, ${w.dist}km @ ${w.pace}/km` : ''}${w.hr > 0 ? `, FC ${w.hr}` : ''}`),
  ].join('\n')
}

export interface PlanBriefingInput {
  workouts: ManualWorkout[]
  profile: AthleteProfile
  userName?: string
  /** Sobrescreve o objetivo salvo no perfil, quando o usuário digita outro. */
  goalOverride?: string
}

/** O texto completo que a IA recebe para montar o bloco. */
export function buildPlanBriefing(input: PlanBriefingInput): string {
  const { workouts, profile } = input
  const today = todayKey()
  const startDate = addDays(today, 1)

  const series = buildLoadSeries(workouts, profile, 90)
  const acwr = computeAcwr(workouts, profile)
  const monotony = computeMonotony(workouts, profile)
  const fitness = estimateFitness(workouts)

  const availableDays = profile.availableDays?.length
    ? profile.availableDays.map(d => WEEKDAYS[d]).join(', ')
    : 'não informados — assuma 4 a 5 dias por semana'

  const goal = input.goalOverride?.trim() || profile.goal?.trim() || 'melhorar condicionamento geral e manter consistência'

  const lines = [
    '## Atleta',
    `Idade: ${ageOf(profile)} anos · peso ${weightOf(profile)} kg`,
    `FC máxima: ${maxHrOf(profile)} bpm${profile.maxHr ? ' (medida)' : ' (estimada pela idade)'} · FC de repouso: ${restingHrOf(profile)} bpm`,
    `Objetivo: ${goal}`,
    profile.raceDate ? `Prova alvo: ${profile.raceDate}${profile.raceDistanceKm ? ` — ${profile.raceDistanceKm} km` : ''}` : 'Sem prova marcada',
    `Dias disponíveis para treinar: ${availableDays}`,
    '',
    '## Carga atual',
    series.length >= 7 ? describeLoadForAI(series, acwr, monotony) : 'Histórico ainda curto para o modelo de carga — comece conservador.',
    '',
    '## Condicionamento',
    describeFitnessForAI(fitness),
    '',
    '## Treinos recentes',
    recentTraining(workouts, today),
    '',
    '## Bloco a gerar',
    `${PLAN_DAYS} dias corridos, de ${startDate} (${weekdayName(startDate)}) até ${addDays(startDate, PLAN_DAYS - 1)} (${weekdayName(addDays(startDate, PLAN_DAYS - 1))}).`,
  ]

  return lines.filter(l => l !== null).join('\n')
}

/** Gera o plano e devolve já no formato persistido, com ids e status. */
export async function generatePlan(input: PlanBriefingInput): Promise<TrainingPlan | null> {
  const startDate = addDays(todayKey(), 1)
  const briefing = buildPlanBriefing(input)

  const result = await callTrainingPlan(briefing, startDate, PLAN_DAYS, input.userName)
  if (!result) return null

  const goal = input.goalOverride?.trim() || input.profile.goal?.trim() || 'Condicionamento geral'

  return {
    generatedAt: Date.now(),
    startDate,
    goal,
    focus: result.focus,
    ...(input.profile.raceDate ? { raceDate: input.profile.raceDate } : {}),
    ...(input.profile.raceDistanceKm ? { raceDistanceKm: input.profile.raceDistanceKm } : {}),
    adaptations: [],
    sessions: result.sessions.map((s, i) => ({
      ...s,
      id: `${s.date}-${i}`,
      status: 'planned' as const,
    })),
  }
}
