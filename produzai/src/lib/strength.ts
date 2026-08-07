// Registro de força: séries × repetições × carga.
//
// Distância e pace não medem nada num treino de academia. Aqui o treino guarda
// os exercícios de verdade, e disso saem os números que o atleta de musculação
// acompanha: volume load, 1RM estimado, recorde por exercício e progressão de
// carga ao longo das semanas.

import type { ManualWorkout } from '../store/useWorkoutStore'

export interface WorkoutSet {
  reps: number
  /** Carga em kg. 0 = peso do corpo. */
  weightKg: number
}

export interface Exercise {
  /** Nome livre, normalizado só na comparação (ver `exerciseKey`). */
  name: string
  sets: WorkoutSet[]
}

// ── Normalização ──────────────────────────────────────────────────────────────

/**
 * Chave de comparação: "Supino Reto" e "supino  reto" são o mesmo exercício.
 * Remove acentos para "agachamento" casar com "agachamento" digitado sem acento.
 */
export function exerciseKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // marcas de acento soltas pela normalização
    .replace(/\s+/g, ' ')
}

// ── Volume ────────────────────────────────────────────────────────────────────

/** Volume load de uma série: repetições × carga. Peso corporal não soma tonelagem. */
export function setVolume(s: WorkoutSet): number {
  return s.reps * s.weightKg
}

export function exerciseVolume(e: Exercise): number {
  return e.sets.reduce((sum, s) => sum + setVolume(s), 0)
}

/** Tonelagem total do treino, em kg. */
export function workoutVolume(w: Pick<ManualWorkout, 'exercises'>): number {
  return (w.exercises ?? []).reduce((sum, e) => sum + exerciseVolume(e), 0)
}

export function workoutSetCount(w: Pick<ManualWorkout, 'exercises'>): number {
  return (w.exercises ?? []).reduce((sum, e) => sum + e.sets.length, 0)
}

export function workoutRepCount(w: Pick<ManualWorkout, 'exercises'>): number {
  return (w.exercises ?? []).reduce(
    (sum, e) => sum + e.sets.reduce((r, s) => r + s.reps, 0), 0,
  )
}

export function hasStrengthData(w: Pick<ManualWorkout, 'exercises'>): boolean {
  return (w.exercises ?? []).some(e => e.sets.length > 0)
}

// ── 1RM estimado ──────────────────────────────────────────────────────────────

/**
 * Fórmula de Epley: 1RM ≈ carga × (1 + reps/30).
 *
 * Vale como comparação entre séries do MESMO exercício, não como número para
 * tentar na barra. Acima de ~12 repetições a estimativa perde o pé, então
 * ignoramos séries longas — nelas a fadiga pesa mais que a força máxima.
 */
export const MAX_REPS_FOR_1RM = 12

export function estimate1RM(set: WorkoutSet): number | null {
  if (set.weightKg <= 0 || set.reps <= 0 || set.reps > MAX_REPS_FOR_1RM) return null
  return Math.round(set.weightKg * (1 + set.reps / 30))
}

/** Melhor 1RM estimado entre as séries de um exercício. */
export function best1RM(e: Exercise): number | null {
  let best: number | null = null
  for (const s of e.sets) {
    const est = estimate1RM(s)
    if (est !== null && (best === null || est > best)) best = est
  }
  return best
}

// ── Recordes por exercício ────────────────────────────────────────────────────

export interface ExerciseRecord {
  name: string
  /** Maior carga já levantada, em qualquer número de repetições. */
  heaviest: { weightKg: number; reps: number; date: string }
  /** Melhor 1RM estimado — null quando só houve séries longas ou peso corporal. */
  best1RM: { value: number; weightKg: number; reps: number; date: string } | null
  /** Maior volume load numa única sessão. */
  bestVolume: { value: number; date: string }
  /** Quantas sessões registraram esse exercício. */
  sessions: number
  lastDate: string
}

/**
 * Recordes por exercício, do mais treinado para o menos. Empate de carga fica
 * com o registro mais ANTIGO — quem chegou primeiro é dono do recorde.
 */
export function computeExerciseRecords(workouts: ManualWorkout[]): ExerciseRecord[] {
  const byKey = new Map<string, ExerciseRecord>()

  // Do mais antigo para o mais novo, para o desempate por data sair de graça.
  const ordered = [...workouts].sort((a, b) => a.rawDate.localeCompare(b.rawDate))

  for (const w of ordered) {
    for (const e of w.exercises ?? []) {
      if (e.sets.length === 0) continue
      const key = exerciseKey(e.name)
      if (!key) continue

      const volume = exerciseVolume(e)
      const rec = byKey.get(key)

      if (!rec) {
        const heaviestSet = pickHeaviest(e.sets)
        byKey.set(key, {
          name: e.name.trim(),
          heaviest: { weightKg: heaviestSet.weightKg, reps: heaviestSet.reps, date: w.rawDate },
          best1RM: buildBest1RM(e, w.rawDate),
          bestVolume: { value: volume, date: w.rawDate },
          sessions: 1,
          lastDate: w.rawDate,
        })
        continue
      }

      rec.sessions += 1
      rec.lastDate = w.rawDate
      rec.name = e.name.trim()   // mantém a grafia mais recente

      const heaviestSet = pickHeaviest(e.sets)
      if (heaviestSet.weightKg > rec.heaviest.weightKg) {
        rec.heaviest = { weightKg: heaviestSet.weightKg, reps: heaviestSet.reps, date: w.rawDate }
      }

      const candidate = buildBest1RM(e, w.rawDate)
      if (candidate && (!rec.best1RM || candidate.value > rec.best1RM.value)) {
        rec.best1RM = candidate
      }

      if (volume > rec.bestVolume.value) {
        rec.bestVolume = { value: volume, date: w.rawDate }
      }
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.sessions - a.sessions || b.lastDate.localeCompare(a.lastDate),
  )
}

function pickHeaviest(sets: WorkoutSet[]): WorkoutSet {
  return sets.reduce((best, s) => (s.weightKg > best.weightKg ? s : best))
}

function buildBest1RM(e: Exercise, date: string): ExerciseRecord['best1RM'] {
  let best: ExerciseRecord['best1RM'] = null
  for (const s of e.sets) {
    const value = estimate1RM(s)
    if (value === null) continue
    if (!best || value > best.value) best = { value, weightKg: s.weightKg, reps: s.reps, date }
  }
  return best
}

// ── Progressão ────────────────────────────────────────────────────────────────

export interface ProgressionPoint {
  date: string
  label: string
  /** 1RM estimado da sessão — a leitura mais justa de progresso de força. */
  est1RM: number | null
  /** Maior carga da sessão. */
  topWeight: number
  volume: number
}

/** Série temporal de um exercício, da sessão mais antiga para a mais recente. */
export function exerciseProgression(
  workouts: ManualWorkout[],
  name: string,
  limit = 20,
): ProgressionPoint[] {
  const key = exerciseKey(name)
  const points: ProgressionPoint[] = []

  for (const w of [...workouts].sort((a, b) => a.rawDate.localeCompare(b.rawDate))) {
    for (const e of w.exercises ?? []) {
      if (exerciseKey(e.name) !== key || e.sets.length === 0) continue
      points.push({
        date: w.rawDate,
        label: shortDate(w.rawDate),
        est1RM: best1RM(e),
        topWeight: pickHeaviest(e.sets).weightKg,
        volume: exerciseVolume(e),
      })
    }
  }

  return points.slice(-limit)
}

function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${d}/${m}`
}

// ── Sugestões ─────────────────────────────────────────────────────────────────

/** Exercícios já usados, do mais recente para o mais antigo — alimenta o autocompletar. */
export function knownExercises(workouts: ManualWorkout[], limit = 40): string[] {
  const seen = new Map<string, string>()
  for (const w of [...workouts].sort((a, b) => b.rawDate.localeCompare(a.rawDate))) {
    for (const e of w.exercises ?? []) {
      const key = exerciseKey(e.name)
      if (key && !seen.has(key)) seen.set(key, e.name.trim())
    }
  }
  return [...seen.values()].slice(0, limit)
}

/** Repete a última sessão do exercício — ponto de partida para bater a carga anterior. */
export function lastSessionOf(workouts: ManualWorkout[], name: string): Exercise | null {
  const key = exerciseKey(name)
  for (const w of [...workouts].sort((a, b) => b.rawDate.localeCompare(a.rawDate))) {
    for (const e of w.exercises ?? []) {
      if (exerciseKey(e.name) === key && e.sets.length > 0) return e
    }
  }
  return null
}

/** Exercícios comuns oferecidos antes de existir histórico. */
export const COMMON_EXERCISES = [
  'Agachamento', 'Supino reto', 'Levantamento terra', 'Desenvolvimento militar',
  'Remada curvada', 'Puxada alta', 'Leg press', 'Cadeira extensora',
  'Mesa flexora', 'Rosca direta', 'Tríceps testa', 'Elevação lateral',
  'Panturrilha', 'Abdominal', 'Barra fixa', 'Flexão de braço',
]
