// Cálculos corporais: idade, IMC, gasto energético e sugestão de macros.
//
// Tudo aqui é estimativa de bolso, não medida clínica — serve para o app partir
// de um número plausível em vez de um slider no chute. O usuário sempre pode
// sobrescrever o resultado.

import type { ActivityLevel, WeightEntry } from './db'

/**
 * Os dados corporais como o app os carrega. Aceita `null` além de ausente porque
 * o store guarda "ainda não informado" como null e o Firestore como campo ausente.
 */
export interface BodyInput {
  weightKg?: number | null
  heightCm?: number | null
  birthDate?: string | null
  sex?: 'masculino' | 'feminino' | null
  activityLevel?: ActivityLevel | null
}

/** Limites de sanidade — protegem as fórmulas de digitação errada. */
export const MIN_HEIGHT_CM = 100
export const MAX_HEIGHT_CM = 250

// ── Idade ─────────────────────────────────────────────────────────────────────

/** Idade em anos a partir de "YYYY-MM-DD". Null se a data faltar ou for inválida. */
export function ageFromBirthDate(birthDate?: string | null): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  const born = new Date(y, m - 1, d)
  if (born.getFullYear() !== y || born.getMonth() !== m - 1 || born.getDate() !== d) return null

  const now = new Date()
  let age = now.getFullYear() - y
  const hadBirthday = now.getMonth() > m - 1 || (now.getMonth() === m - 1 && now.getDate() >= d)
  if (!hadBirthday) age--
  return age >= 10 && age <= 100 ? age : null
}

// ── IMC ───────────────────────────────────────────────────────────────────────

export interface BmiResult { value: number; label: string }

/**
 * IMC com a ressalva que atleta precisa ouvir: massa muscular infla o índice,
 * então "sobrepeso" no IMC não significa gordura em excesso.
 */
export function computeBmi(weightKg?: number | null, heightCm?: number | null): BmiResult | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null
  const m = heightCm / 100
  const value = Math.round((weightKg / (m * m)) * 10) / 10
  const label =
    value < 18.5 ? 'abaixo do peso' :
    value < 25   ? 'faixa normal' :
    value < 30   ? 'sobrepeso' : 'obesidade'
  return { value, label }
}

// ── Gasto energético ──────────────────────────────────────────────────────────

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string; factor: number }[] = [
  { value: 'sedentario', label: 'Sedentário',      desc: 'Trabalho parado, sem treino',       factor: 1.2   },
  { value: 'leve',       label: 'Leve',            desc: 'Treino leve 1–3x por semana',       factor: 1.375 },
  { value: 'moderado',   label: 'Moderado',        desc: 'Treino 3–5x por semana',            factor: 1.55  },
  { value: 'intenso',    label: 'Intenso',         desc: 'Treino pesado 6–7x por semana',     factor: 1.725 },
  { value: 'atleta',     label: 'Atleta',          desc: 'Dois treinos por dia ou trabalho físico', factor: 1.9 },
]

export const DEFAULT_ACTIVITY_LEVEL: ActivityLevel = 'moderado'

function activityFactor(level?: ActivityLevel | null): number {
  return ACTIVITY_LEVELS.find(a => a.value === level)?.factor
    ?? ACTIVITY_LEVELS.find(a => a.value === DEFAULT_ACTIVITY_LEVEL)!.factor
}

/**
 * Taxa metabólica basal por Mifflin-St Jeor — o que o corpo gasta parado.
 * Precisa de peso, altura, idade e sexo; sem os quatro não há número honesto.
 */
export function computeBmr(profile: BodyInput): number | null {
  const { weightKg, heightCm, sex } = profile
  const age = ageFromBirthDate(profile.birthDate)
  if (!weightKg || !heightCm || age == null || !sex) return null

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'masculino' ? base + 5 : base - 161)
}

/** Gasto diário total: BMR × fator de atividade. */
export function computeTdee(profile: BodyInput): number | null {
  const bmr = computeBmr(profile)
  if (bmr == null) return null
  return Math.round(bmr * activityFactor(profile.activityLevel))
}

// ── Macros ────────────────────────────────────────────────────────────────────

export type MacroGoal = 'cutting' | 'manutencao' | 'bulking'

export const MACRO_GOALS: { value: MacroGoal; label: string; desc: string; delta: number }[] = [
  { value: 'cutting',     label: 'Perder gordura', desc: '−20% do gasto diário', delta: -0.20 },
  { value: 'manutencao',  label: 'Manter',         desc: 'Igual ao gasto diário', delta: 0     },
  { value: 'bulking',     label: 'Ganhar massa',   desc: '+10% do gasto diário',  delta: 0.10  },
]

export interface MacroSuggestion {
  cal: number
  prot: number
  carb: number
  fat: number
  tdee: number
}

/**
 * Distribuição a partir do TDEE:
 *   proteína 2,0 g/kg (1,8–2,2 é a faixa usual para quem treina)
 *   gordura  25% das calorias
 *   carboidrato preenche o restante
 * Piso de segurança nas calorias para o corte não virar fome.
 */
export function suggestMacros(profile: BodyInput, goal: MacroGoal): MacroSuggestion | null {
  const tdee = computeTdee(profile)
  if (tdee == null || !profile.weightKg) return null

  const delta = MACRO_GOALS.find(g => g.value === goal)?.delta ?? 0
  // Nunca abaixo de 1200 kcal nem de 80% da basal — corte agressivo demais
  // derruba treino, sono e humor, que é justamente o que o app tenta proteger.
  const floor = Math.max(1200, Math.round((computeBmr(profile) ?? 1200) * 0.8))
  const cal = Math.max(floor, Math.round((tdee * (1 + delta)) / 10) * 10)

  const prot = Math.round(profile.weightKg * 2)
  const fat = Math.round((cal * 0.25) / 9)
  const carb = Math.max(0, Math.round((cal - prot * 4 - fat * 9) / 4))

  return { cal, prot, carb, fat, tdee }
}

// ── Tendência de peso ─────────────────────────────────────────────────────────

export interface WeightTrend {
  /** Diferença em kg entre a última pesagem e a mais antiga dentro da janela. */
  deltaKg: number
  /** Quantos dias a janela realmente cobre. */
  days: number
  /** Ritmo em kg por semana. */
  perWeek: number
  direction: 'subindo' | 'descendo' | 'estavel'
}

/** Variação de peso na janela pedida. Precisa de ao menos duas pesagens. */
export function weightTrend(log: WeightEntry[], windowDays = 30): WeightTrend | null {
  if (log.length < 2) return null

  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const inWindow = sorted.filter(e => dateMs(e.date) >= cutoffMs)
  const first = inWindow.length >= 2 ? inWindow[0] : sorted[0]
  if (first.date === last.date) return null

  const days = Math.max(1, Math.round((dateMs(last.date) - dateMs(first.date)) / (24 * 60 * 60 * 1000)))
  const deltaKg = Math.round((last.kg - first.kg) * 10) / 10
  const perWeek = Math.round((deltaKg / days) * 7 * 100) / 100

  return {
    deltaKg,
    days,
    perWeek,
    direction: Math.abs(deltaKg) < 0.3 ? 'estavel' : deltaKg > 0 ? 'subindo' : 'descendo',
  }
}

function dateMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
