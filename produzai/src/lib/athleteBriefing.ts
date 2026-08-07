// Briefing do atleta para o Coach: junta em um bloco de texto tudo que os
// motores locais calcularam (carga, condicionamento, plano, recuperação).
//
// A IA nunca recalcula nada disso — ela lê estes números prontos. Isso mantém
// as respostas consistentes com o que o usuário vê nas telas e evita que o
// Coach invente um VO₂máx diferente do que o app mostra.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { AthleteProfile } from './athleteProfile'
import type { MentalEntry } from './db'
import type { TrainingPlan } from './plan'
import { maxHrOf, restingHrOf, ageOf } from './athleteProfile'
import { buildLoadSeries, computeAcwr, computeMonotony, computeReadiness, describeLoadForAI } from './trainingLoad'
import { estimateFitness, describeFitnessForAI } from './fitness'
import { describePlanForAI, todayKey } from './plan'
import { recoveryDeviation, describeRecovery } from './recovery'

export interface BriefingInput {
  workouts: ManualWorkout[]
  profile: AthleteProfile
  plan: TrainingPlan | null
  mentalHistory: Record<string, MentalEntry>
}

export function buildAthleteBriefing(input: BriefingInput): string {
  const { workouts, profile, plan, mentalHistory } = input
  const today = todayKey()

  const series = buildLoadSeries(workouts, profile, 90)
  const last = series[series.length - 1]
  const acwr = computeAcwr(workouts, profile)
  const monotony = computeMonotony(workouts, profile)
  const fitness = estimateFitness(workouts)
  const deviation = recoveryDeviation(mentalHistory, today)
  const todayMental = mentalHistory[today]

  const readiness = computeReadiness({
    form: series.length >= 14 && last ? last.form : null,
    acwr,
    sleepHours: todayMental?.sleepHours ?? null,
    mood: todayMental?.mood ?? null,
    energy: todayMental?.energy ?? null,
    hrvDeviationPct: deviation.hrvDeviationPct,
    restingHrDelta: deviation.restingHrDelta,
  })

  const sections: string[] = []

  sections.push(
    `### Fisiologia
- Idade ${ageOf(profile)} anos · FCmáx ${maxHrOf(profile)} bpm${profile.maxHr ? ' (medida)' : ' (estimada)'} · FC repouso ${restingHrOf(profile)} bpm`,
  )

  if (series.length >= 7) {
    sections.push(`### Carga de treino\n${describeLoadForAI(series, acwr, monotony)}`)
  }

  if (fitness) {
    sections.push(`### Condicionamento estimado\n${describeFitnessForAI(fitness)}`)
  }

  if (readiness.confidence >= 2) {
    const drivers = readiness.drivers.map(d => `${d.impact === 'up' ? '↑' : '↓'} ${d.text}`).join(' · ')
    sections.push(
      `### Prontidão de hoje\n${readiness.score}/100 — ${readiness.label}${drivers ? `\nFatores: ${drivers}` : ''}\nRecomendação do motor: ${readiness.recommendation}`,
    )
  }

  const recovery = describeRecovery(deviation)
  if (recovery) sections.push(`### Recuperação\n${recovery}`)

  if (plan) sections.push(`### Plano de treino\n${describePlanForAI(plan, today)}`)

  return sections.join('\n\n')
}
