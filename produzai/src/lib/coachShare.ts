// Link read-only para o treinador.
//
// O treinador não tem conta no app, então nada de login: o atleta gera um link
// com um token secreto e manda pelo WhatsApp. O que vai para o link é um RESUMO
// congelado (últimos dias de treino, prontidão, hidratação e dieta) gravado num
// documento público em `coachShares/{token}` — as coleções de `users/{uid}`
// continuam fechadas pelas regras. Quem tem o link lê o resumo e nada além dele.
//
// Consequência que a interface precisa deixar clara: qualquer pessoa com o link
// vê esses dados. Revogar apaga o documento e o link morre na hora.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { DietCompliance } from '../store/useWebDietStore'
import type { CoachShareDay, CoachShareSnapshot, CoachShareWorkout, DailyData } from './db'
import { computeReadiness } from './readiness'
import { parseDurationToMinutes } from './performance'
import { workoutVolume, hasStrengthData } from './strength'

/** Janela do resumo — duas semanas é o que um treinador olha antes de ajustar. */
export const SHARE_WINDOW_DAYS = 14

const DIET_LABELS: Record<string, string> = {
  perfect: 'Dieta perfeita',
  good:    'Seguiu ~90%',
  alcohol: 'Bebeu álcool',
  skipped: 'Não seguiu',
}

export function dietLabel(status: string): string {
  return DIET_LABELS[status] ?? status
}

/**
 * Token de 160 bits em base36. É o segredo inteiro do link, então vem do
 * gerador criptográfico do navegador — nunca de `Math.random`.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function shareUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}?coach=${token}`
}

interface BuildInput {
  uid: string
  athleteName: string
  dates: string[]
  workouts: ManualWorkout[]
  dailyHistory: Record<string, DailyData>
  compliance: DietCompliance[]
}

export function buildCoachSnapshot(input: BuildInput): CoachShareSnapshot {
  const { uid, athleteName, dates, workouts, dailyHistory, compliance } = input
  const window = new Set(dates)
  const complianceByDate = new Map(compliance.map(c => [c.date, c.status]))

  const readinessHistory = Object.values(dailyHistory)
    .map(d => d.readiness)
    .filter((r): r is NonNullable<typeof r> => Boolean(r))

  const shareWorkouts: CoachShareWorkout[] = workouts
    .filter(w => window.has(w.rawDate))
    .sort((a, b) => b.rawDate.localeCompare(a.rawDate))
    .map(w => ({
      date: w.rawDate,
      name: w.name,
      type: w.type,
      time: w.time,
      dist: w.dist,
      cal: w.cal,
      ...(hasStrengthData(w) ? { volumeKg: Math.round(workoutVolume(w)) } : {}),
      ...(w.notes ? { notes: w.notes } : {}),
      ...(w.painLevel ? { painLevel: w.painLevel } : {}),
      ...(w.painLevel && w.painArea ? { painArea: w.painArea } : {}),
    }))

  const days: CoachShareDay[] = dates
    .map(date => {
      const d = dailyHistory[date]
      const readiness = d?.readiness
      const dietStatus = complianceByDate.get(date)
      const entry: CoachShareDay = {
        date,
        ...(readiness ? {
          readinessScore: computeReadiness(readiness, readinessHistory).score,
          sleepHours: readiness.sleepHours,
          soreness: readiness.soreness,
        } : {}),
        ...(d?.waterMl ? { waterMl: d.waterMl } : {}),
        ...(dietStatus ? { dietStatus } : {}),
      }
      return entry
    })
    // Dia sem nenhum registro é ruído na tela do treinador.
    .filter(d => Object.keys(d).length > 1)
    .reverse()

  const readinessScores = days
    .map(d => d.readinessScore)
    .filter((s): s is number => typeof s === 'number')

  return {
    uid,
    athleteName,
    updatedAt: Date.now(),
    from: dates[0],
    to: dates[dates.length - 1],
    workouts: shareWorkouts,
    days,
    weekSummary: {
      workouts: shareWorkouts.length,
      km: Math.round(shareWorkouts.reduce((s, w) => s + w.dist, 0) * 10) / 10,
      minutes: shareWorkouts.reduce((s, w) => s + (parseDurationToMinutes(w.time) ?? 0), 0),
      avgReadiness: readinessScores.length
        ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length)
        : null,
      painFlags: shareWorkouts.filter(w => (w.painLevel ?? 0) >= 3).length,
    },
  }
}
