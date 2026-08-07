// Perfil fisiológico do atleta — a base de qualquer cálculo de zona, carga ou
// prontidão. Tudo aqui tem um valor derivado razoável quando o usuário não
// preencheu nada, para que nenhuma tela precise checar `null` a cada uso.

export type Sex = 'M' | 'F' | 'NA'

export interface AthleteProfile {
  birthYear: number | null
  weightKg: number | null
  heightCm: number | null
  sex: Sex
  /** FC de repouso medida ao acordar, deitado (bpm). */
  restingHr: number | null
  /** FC máxima medida em teste de campo. Vazia = estimada pela idade. */
  maxHr: number | null
  /** Objetivo principal — usado pelo plano adaptativo. */
  goal?: string
  /** Data da prova alvo, "YYYY-MM-DD". */
  raceDate?: string
  /** Distância da prova alvo em km (5, 10, 21.1, 42.2...). */
  raceDistanceKm?: number
  /** Dias da semana em que consegue treinar — 0=domingo. */
  availableDays?: number[]
}

export const EMPTY_ATHLETE: AthleteProfile = {
  birthYear: null,
  weightKg: null,
  heightCm: null,
  sex: 'NA',
  restingHr: null,
  maxHr: null,
}

const DEFAULT_AGE = 32
const DEFAULT_WEIGHT_KG = 70
const DEFAULT_RESTING_HR = 60

export function ageOf(p: AthleteProfile | null): number {
  if (!p?.birthYear) return DEFAULT_AGE
  const age = new Date().getFullYear() - p.birthYear
  return age >= 10 && age <= 100 ? age : DEFAULT_AGE
}

/** Tanaka et al. (2001): 208 − 0,7 × idade. Erro menor que o clássico 220 − idade. */
export function maxHrOf(p: AthleteProfile | null): number {
  if (p?.maxHr && p.maxHr > 120) return p.maxHr
  return Math.round(208 - 0.7 * ageOf(p))
}

export function restingHrOf(p: AthleteProfile | null): number {
  if (p?.restingHr && p.restingHr >= 30 && p.restingHr <= 110) return p.restingHr
  return DEFAULT_RESTING_HR
}

export function weightOf(p: AthleteProfile | null): number {
  if (p?.weightKg && p.weightKg > 25 && p.weightKg < 300) return p.weightKg
  return DEFAULT_WEIGHT_KG
}

/** True quando o usuário informou o suficiente para os cálculos não serem chute. */
export function isAthleteProfileComplete(p: AthleteProfile | null): boolean {
  return Boolean(p?.birthYear && p?.weightKg && p?.restingHr)
}

// ── Zonas de frequência cardíaca ─────────────────────────────────────────────
// Karvonen (%FCR = reserva cardíaca) em vez de %FCmax: com a FC de repouso do
// usuário as zonas ficam individualizadas em vez de genéricas.

export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5
  label: string
  description: string
  minHr: number
  maxHr: number
  color: string
}

const ZONE_BOUNDS: Array<{ zone: 1 | 2 | 3 | 4 | 5; from: number; to: number; label: string; description: string; color: string }> = [
  { zone: 1, from: 0.00, to: 0.60, label: 'Z1 Recuperação', description: 'Regenerativo — conversa fácil',      color: '#60A5FA' },
  { zone: 2, from: 0.60, to: 0.70, label: 'Z2 Base',        description: 'Aeróbico — o pão com manteiga',      color: '#22C55E' },
  { zone: 3, from: 0.70, to: 0.80, label: 'Z3 Tempo',       description: 'Ritmo forte sustentado',             color: '#F97316' },
  { zone: 4, from: 0.80, to: 0.90, label: 'Z4 Limiar',      description: 'Limiar anaeróbico — desconfortável', color: '#F472B6' },
  { zone: 5, from: 0.90, to: 1.10, label: 'Z5 VO₂máx',      description: 'Máximo — poucos minutos',            color: '#EF4444' },
]

export function hrZones(p: AthleteProfile | null): HrZone[] {
  const max = maxHrOf(p)
  const rest = restingHrOf(p)
  const reserve = Math.max(1, max - rest)
  return ZONE_BOUNDS.map(b => ({
    zone: b.zone,
    label: b.label,
    description: b.description,
    color: b.color,
    minHr: Math.round(rest + reserve * b.from),
    maxHr: Math.round(rest + reserve * b.to),
  }))
}

/** Em qual zona (1-5) cai um batimento. */
export function zoneOfHr(hr: number, p: AthleteProfile | null): 1 | 2 | 3 | 4 | 5 {
  const max = maxHrOf(p)
  const rest = restingHrOf(p)
  const pct = (hr - rest) / Math.max(1, max - rest)
  for (const b of ZONE_BOUNDS) {
    if (pct < b.to) return b.zone
  }
  return 5
}
