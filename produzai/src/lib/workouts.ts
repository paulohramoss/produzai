// Ponte entre "dados soltos de treino" (voz, foto, ferramenta do Coach, formulário)
// e o registro completo que o app guarda. Pace, tempo formatado, calorias e nome
// são derivados aqui — quem chama só precisa do essencial.

import { estimateCalories, type EffortLevel } from './calories'
import { calcPace, formatDuration, friendlyDate } from './performance'
import type { ManualWorkout } from '../store/useWorkoutStore'

export const ACTIVITY_TYPES = ['Corrida', 'Caminhada', 'Academia', 'Ciclismo', 'Natação', 'Futebol', 'Outro']

export const DEFAULT_NAMES: Record<string, string> = {
  Corrida: 'Corrida matinal',
  Caminhada: 'Caminhada',
  Academia: 'Treino na academia',
  Ciclismo: 'Pedal',
  Natação: 'Natação',
  Futebol: 'Futebol',
  Outro: 'Atividade',
}

/** Duração típica por tipo — o palpite quando o usuário não informa nada. */
export const DEFAULT_DURATION: Record<string, number> = {
  Corrida: 40,
  Caminhada: 40,
  Academia: 60,
  Ciclismo: 60,
  Natação: 45,
  Futebol: 60,
  Outro: 45,
}

/** Só nesses tipos a distância vale a pena pedir — nos outros o campo é ruído. */
const DISTANCE_TYPES = new Set(['Corrida', 'Caminhada', 'Ciclismo', 'Natação'])

export function usesDistance(type: string): boolean {
  return DISTANCE_TYPES.has(type)
}

/** Esforço assumido quando ninguém escolhe: moderado. */
export const DEFAULT_EFFORT: EffortLevel = 2

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface WorkoutDraft {
  type?: string
  name?: string
  durationMin?: number | string
  dist?: number | string
  effort?: number | string
  hr?: number | string
  /** "YYYY-MM-DD". Ausente ou inválida vira hoje; futura é puxada para hoje. */
  date?: string
  /**
   * Peso do atleta, para o cálculo de calorias. Passado por quem chama em vez
   * de lido de um store aqui dentro: este módulo é puro de propósito, o que
   * mantém `buildWorkout` testável e utilizável fora de um componente React.
   */
  weightKg?: number | null
}

function normalizeDate(raw?: string): string {
  const today = todayISO()
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today
  const [y, m, d] = raw.split('-').map(Number)
  const parsed = new Date(y, m - 1, d)
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return today
  return raw > today ? today : raw
}

function toEffort(raw: unknown): EffortLevel {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < 1) return DEFAULT_EFFORT
  return Math.min(5, n) as EffortLevel
}

/** Monta um treino completo a partir do que se sabe, estimando o resto. */
export function buildWorkout(draft: WorkoutDraft): Omit<ManualWorkout, 'id'> {
  const type = ACTIVITY_TYPES.includes(draft.type ?? '') ? draft.type! : 'Outro'
  const effort = toEffort(draft.effort)

  const rawDuration = Math.round(Number(draft.durationMin))
  const durationMin = Number.isFinite(rawDuration) && rawDuration > 0
    ? Math.min(rawDuration, 600)
    : (DEFAULT_DURATION[type] ?? 45)

  const rawDist = Number(draft.dist)
  const dist = Number.isFinite(rawDist) && rawDist > 0 ? Math.round(rawDist * 100) / 100 : 0

  const rawHr = Math.round(Number(draft.hr))
  const hr = Number.isFinite(rawHr) && rawHr > 0 ? Math.min(rawHr, 250) : 0

  const rawDate = normalizeDate(draft.date)
  const name = draft.name?.trim() || DEFAULT_NAMES[type] || 'Atividade'

  return {
    type,
    name,
    rawDate,
    date: friendlyDate(rawDate),
    dist,
    pace: calcPace(durationMin, dist),
    time: formatDuration(durationMin),
    cal: estimateCalories(type, durationMin, effort, draft.weightKg),
    hr,
    elev: 0,
    effort,
    source: 'manual',
  }
}
