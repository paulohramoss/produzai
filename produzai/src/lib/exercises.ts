// Exercícios de um treino de força: o que a planilha do professor prescreve
// (série, repetição, carga) e a leitura desses dados ao longo do histórico —
// é daqui que sai a progressão de carga.

import type { ManualWorkout } from '../store/useWorkoutStore'

export interface WorkoutExercise {
  name: string
  /** Número de séries. 0 = não informado. */
  sets: number
  /** Texto livre porque a planilha varia: "12", "10-12", "30s", "20 cada perna". */
  reps: string
  /** Carga em kg. 0 = peso corporal ou carga não numérica — nesse caso veja `note`. */
  loadKg: number
  /** O que a planilha diz e não cabe nos campos: "sem pausa", "PB", "acelerado". */
  note?: string
}

/**
 * Teto de exercícios por treino. A lista inteira de treinos vive num único
 * documento do Firestore (`saveWorkouts`), que tem limite de 1 MiB — sem teto,
 * uma planilha malformada lida pela IA poderia inflar o documento de todos.
 */
export const MAX_EXERCISES = 40

// Uma linha de planilha emenda exercício e prescrição ("ABD supra estendidos /
// pés chão – 15 repetições + 30\" prancha ventral"), então o nome precisa de
// folga — cortar em 60 truncava no meio da palavra.
const MAX_NAME_LEN = 90
const MAX_REPS_LEN = 32
const MAX_NOTE_LEN = 80

/** Chave de comparação entre sessões: sem acento, sem caixa, sem pontuação. */
export function exerciseKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Corta no último espaço antes do limite, para não partir palavra ao meio. */
function clampText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return ''
  const text = raw.trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

/**
 * A planilha escreve "27,5" e o modelo às vezes devolve assim, como texto.
 * Só aceita número puro: "5X5" e "PB" viram NaN (e depois 0) em vez de virarem
 * carga inventada — carga errada no histórico estraga a progressão.
 */
function toNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (typeof raw !== 'string') return NaN
  const cleaned = raw.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN
}

/** Normaliza o que vem da IA ou do formulário: descarta linha sem nome. */
export function sanitizeExercises(raw: unknown): WorkoutExercise[] {
  if (!Array.isArray(raw)) return []
  const out: WorkoutExercise[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    const name = clampText(e.name, MAX_NAME_LEN)
    if (!name) continue

    const sets = Math.round(toNumber(e.sets))
    const loadKg = toNumber(e.loadKg)
    const note = clampText(e.note, MAX_NOTE_LEN)

    out.push({
      name,
      sets: Number.isFinite(sets) && sets > 0 ? Math.min(sets, 20) : 0,
      reps: clampText(e.reps, MAX_REPS_LEN),
      // Meio quilo é o menor incremento que aparece na prática (anilhas de 0,5).
      loadKg: Number.isFinite(loadKg) && loadKg > 0 ? Math.min(Math.round(loadKg * 2) / 2, 500) : 0,
      ...(note ? { note } : {}),
    })
    if (out.length >= MAX_EXERCISES) break
  }
  return out
}

export function emptyExercise(): WorkoutExercise {
  return { name: '', sets: 0, reps: '', loadKg: 0 }
}

/** "3×10 a 12" — a prescrição em uma linha, omitindo o que não foi informado. */
export function formatPrescription(ex: WorkoutExercise): string {
  if (ex.sets > 0 && ex.reps) return `${ex.sets}×${ex.reps}`
  if (ex.sets > 0) return `${ex.sets} séries`
  return ex.reps
}

/** "27,5 kg" — vírgula decimal, sem casa quando é inteiro. */
export function formatLoad(kg: number): string {
  if (kg <= 0) return '—'
  return `${(Math.round(kg * 10) / 10).toString().replace('.', ',')}kg`
}

export interface ExercisePoint {
  workoutId: string
  workoutName: string
  /** "YYYY-MM-DD" */
  rawDate: string
  loadKg: number
  sets: number
  reps: string
}

/**
 * Todas as vezes que o exercício foi registrado, da mais recente para a mais
 * antiga. `before` (data "YYYY-MM-DD") e `excludeId` recortam a janela quando
 * quem chama quer só o que veio *antes* de um treino específico.
 */
export function exerciseHistory(
  name: string,
  workouts: ManualWorkout[],
  opts: { before?: string; excludeId?: string } = {},
): ExercisePoint[] {
  const key = exerciseKey(name)
  if (!key) return []

  const points: ExercisePoint[] = []
  for (const w of workouts) {
    if (opts.excludeId && w.id === opts.excludeId) continue
    if (opts.before && w.rawDate > opts.before) continue
    for (const ex of w.exercises ?? []) {
      if (exerciseKey(ex.name) !== key) continue
      points.push({
        workoutId: w.id,
        workoutName: w.name,
        rawDate: w.rawDate,
        loadKg: ex.loadKg,
        sets: ex.sets,
        reps: ex.reps,
      })
    }
  }
  // A lista do store costuma vir do mais novo para o mais antigo, mas não é
  // garantido depois de importações — ordena aqui em vez de confiar nisso.
  return points.sort((a, b) => b.rawDate.localeCompare(a.rawDate))
}

/** Última carga registrada com valor numérico, ou null se é a estreia do exercício. */
export function previousLoad(
  name: string,
  workouts: ManualWorkout[],
  opts: { before?: string; excludeId?: string } = {},
): ExercisePoint | null {
  return exerciseHistory(name, workouts, opts).find(p => p.loadKg > 0) ?? null
}

/** Variação de carga em relação à sessão anterior do mesmo exercício. */
export interface LoadDelta {
  previous: ExercisePoint
  diffKg: number
  pct: number
}

export function loadDelta(
  exercise: WorkoutExercise,
  workout: Pick<ManualWorkout, 'id' | 'rawDate'>,
  workouts: ManualWorkout[],
): LoadDelta | null {
  if (exercise.loadKg <= 0) return null
  const previous = previousLoad(exercise.name, workouts, {
    before: workout.rawDate,
    excludeId: workout.id,
  })
  if (!previous) return null
  const diffKg = Math.round((exercise.loadKg - previous.loadKg) * 10) / 10
  return { previous, diffKg, pct: Math.round((diffKg / previous.loadKg) * 100) }
}

// ── Progressão de carga (leitura do histórico para o Coach) ──────────────────

function daysBetween(fromISO: string, toISO: string): number {
  const [ay, am, ad] = fromISO.split('-').map(Number)
  const [by, bm, bd] = toISO.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + delta))
  return t.toISOString().slice(0, 10)
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export type ProgressStatus = 'novo' | 'subindo' | 'estagnado' | 'caindo'

export interface ExerciseProgress {
  /** Nome como escrito na sessão mais recente. */
  name: string
  /** Quantas sessões registraram esse exercício com carga numérica. */
  sessions: number
  currentLoadKg: number
  firstLoadKg: number
  /** Data da sessão mais recente ("YYYY-MM-DD"). */
  lastDate: string
  /** Sessões consecutivas mais recentes com a carga atual (mínimo 1). */
  plateauSessions: number
  /** Semanas inteiras desde que a carga atual parou de mudar. */
  plateauWeeks: number
  status: ProgressStatus
}

/**
 * Progressão de carga por exercício na janela recente.
 *
 * Só entra exercício com carga numérica: peso corporal e sigla ("PB", "5X5")
 * não têm progressão para acompanhar, e poluiriam o briefing do Coach.
 * `today` vem de quem chama para manter a função pura e testável.
 */
export function buildStrengthProgress(
  workouts: ManualWorkout[],
  opts: { today: string; days?: number },
): ExerciseProgress[] {
  const cutoff = shiftDays(opts.today, -(opts.days ?? 90))

  // O nome viaja junto com o ponto: o card exibe o exercício como o usuário
  // escreveu na sessão mais recente, não a chave normalizada.
  type NamedPoint = ExercisePoint & { name: string }

  const groups = new Map<string, NamedPoint[]>()
  for (const w of workouts) {
    if (w.rawDate < cutoff || w.rawDate > opts.today) continue
    for (const ex of w.exercises ?? []) {
      if (ex.loadKg <= 0) continue
      const key = exerciseKey(ex.name)
      if (!key) continue
      const point: NamedPoint = {
        workoutId: w.id,
        workoutName: w.name,
        rawDate: w.rawDate,
        loadKg: ex.loadKg,
        sets: ex.sets,
        reps: ex.reps,
        name: ex.name,
      }
      const list = groups.get(key)
      if (list) list.push(point)
      else groups.set(key, [point])
    }
  }

  const out: ExerciseProgress[] = []
  for (const points of groups.values()) {
    points.sort((a, b) => b.rawDate.localeCompare(a.rawDate))
    const current = points[0]

    let plateauSessions = 1
    while (plateauSessions < points.length && points[plateauSessions].loadKg === current.loadKg) {
      plateauSessions++
    }
    const plateauStart = points[plateauSessions - 1].rawDate

    const status: ProgressStatus =
      points.length === 1 ? 'novo'
      : plateauSessions >= 2 ? 'estagnado'
      : current.loadKg > points[1].loadKg ? 'subindo'
      : 'caindo'

    out.push({
      name: current.name,
      sessions: points.length,
      currentLoadKg: current.loadKg,
      firstLoadKg: points[points.length - 1].loadKg,
      lastDate: current.rawDate,
      plateauSessions,
      plateauWeeks: Math.floor(daysBetween(plateauStart, opts.today) / 7),
      status,
    })
  }

  // Primeiro o que pede ação (travado, caindo), depois o que tem mais história.
  const rank: Record<ProgressStatus, number> = { estagnado: 0, caindo: 1, subindo: 2, novo: 3 }
  return out.sort((a, b) => rank[a.status] - rank[b.status] || b.sessions - a.sessions)
}

/**
 * Bloco de texto para o Coach. Números prontos: a IA lê e cita, não recalcula.
 * `limit` segura o tamanho do prompt — o briefing vai em toda mensagem do chat.
 */
export function describeStrengthForAI(
  progress: ExerciseProgress[],
  opts: { days?: number; limit?: number } = {},
): string {
  if (progress.length === 0) return ''
  const limit = opts.limit ?? 12

  const lines = [
    `${progress.length} exercício(s) com carga registrada nos últimos ${opts.days ?? 90} dias.`,
  ]

  for (const p of progress.slice(0, limit)) {
    const load = formatLoad(p.currentLoadKg)
    const since = shortDate(p.lastDate)
    if (p.status === 'novo') {
      lines.push(`- ${p.name}: ${load} — primeiro registro (${since})`)
      continue
    }
    if (p.status === 'estagnado') {
      const tempo = p.plateauWeeks >= 1
        ? `há ${p.plateauWeeks} semana${p.plateauWeeks > 1 ? 's' : ''}`
        : 'desde a sessão anterior'
      lines.push(
        `- ${p.name}: ${load} — travado nessa carga ${tempo} (${p.plateauSessions} sessões seguidas; última em ${since})`,
      )
      continue
    }
    const diff = Math.round((p.currentLoadKg - p.firstLoadKg) * 10) / 10
    const sinal = diff > 0 ? '+' : ''
    lines.push(
      `- ${p.name}: ${load} — ${p.status} (${sinal}${diff.toString().replace('.', ',')}kg em ${p.sessions} sessões; última em ${since})`,
    )
  }

  if (progress.length > limit) {
    lines.push(`(+${progress.length - limit} outros exercícios com menos histórico)`)
  }

  return lines.join('\n')
}
