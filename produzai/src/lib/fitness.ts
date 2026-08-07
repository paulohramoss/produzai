// Condicionamento estimado a partir das corridas registradas — VDOT, VO₂máx,
// ritmos de treino e previsão de tempo de prova.
//
// Tudo aqui é matemática pura (Jack Daniels, "Daniels' Running Formula"), sem
// IA e sem teste de laboratório: o próprio histórico de corridas é o teste.

import type { ManualWorkout } from '../store/useWorkoutStore'
import { parseDurationToMinutes, formatPace } from './performance'

const RUNNING_TYPE = 'Corrida'

/** Esforços curtos demais distorcem o VDOT para cima. */
const MIN_EFFORT_KM = 1.5
/** Fora dessa janela o esforço não representa mais a forma atual. */
const RECENT_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

// ── Núcleo das fórmulas de Daniels ───────────────────────────────────────────

/** Consumo de oxigênio (ml/kg/min) exigido por uma velocidade em m/min. */
function vo2AtVelocity(vMetersPerMin: number): number {
  return -4.60 + 0.182258 * vMetersPerMin + 0.000104 * vMetersPerMin ** 2
}

/** Velocidade (m/min) que exige determinado VO₂ — o inverso da função acima. */
function velocityAtVo2(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.60 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

/** Fração do VO₂máx sustentável por `minutes` de esforço máximo. */
function fractionOfMax(minutes: number): number {
  return 0.8
    + 0.1894393 * Math.exp(-0.012778 * minutes)
    + 0.2989558 * Math.exp(-0.1932605 * minutes)
}

/** VDOT de um esforço: a "nota" de condicionamento que aquele desempenho implica. */
export function vdotFromEffort(distanceKm: number, durationMin: number): number | null {
  if (distanceKm < MIN_EFFORT_KM || durationMin <= 0) return null
  const velocity = (distanceKm * 1000) / durationMin
  const vdot = vo2AtVelocity(velocity) / fractionOfMax(durationMin)
  if (!Number.isFinite(vdot) || vdot < 20 || vdot > 90) return null
  return Math.round(vdot * 10) / 10
}

// ── Estimativa a partir do histórico ─────────────────────────────────────────

export interface FitnessEstimate {
  vdot: number
  /** Para corrida, VDOT e VO₂máx estimado coincidem na prática. */
  vo2max: number
  /** Corrida que produziu a estimativa. */
  source: ManualWorkout
  /** Corridas consideradas na janela. */
  candidates: number
  level: string
}

/**
 * O VDOT vem do MELHOR esforço recente, não da média: rodagem leve não mede
 * capacidade, só o esforço mais próximo do limite é que revela o teto atual.
 */
export function estimateFitness(workouts: ManualWorkout[], now = new Date()): FitnessEstimate | null {
  const cutoff = now.getTime() - RECENT_DAYS * DAY_MS

  const candidates = workouts.filter(w => {
    if (w.type !== RUNNING_TYPE || w.dist < MIN_EFFORT_KM) return false
    const [y, m, d] = w.rawDate.split('-').map(Number)
    return new Date(y, m - 1, d).getTime() >= cutoff
  })

  let best: { vdot: number; workout: ManualWorkout } | null = null
  for (const w of candidates) {
    const minutes = parseDurationToMinutes(w.time)
    if (minutes === null) continue
    const vdot = vdotFromEffort(w.dist, minutes)
    if (vdot !== null && (best === null || vdot > best.vdot)) best = { vdot, workout: w }
  }

  if (!best) return null

  return {
    vdot: best.vdot,
    vo2max: Math.round(best.vdot),
    source: best.workout,
    candidates: candidates.length,
    level: describeLevel(best.vdot),
  }
}

function describeLevel(vdot: number): string {
  if (vdot < 30) return 'Iniciante'
  if (vdot < 38) return 'Recreativo'
  if (vdot < 46) return 'Intermediário'
  if (vdot < 54) return 'Avançado'
  if (vdot < 62) return 'Competitivo'
  return 'Elite'
}

// ── Ritmos de treino ─────────────────────────────────────────────────────────

export interface TrainingPace {
  key: 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition'
  label: string
  purpose: string
  /** Ritmo em min/km (decimal). */
  paceMin: number
  formatted: string
  color: string
}

// Percentuais do VDOT que definem cada ritmo em Daniels.
// O fácil fica em 0,65 (meio da faixa E, que vai de 0,59 a 0,74) de propósito:
// prescrever o topo da faixa é o que faz amador transformar rodagem leve em
// treino médio e nunca recuperar de verdade.
const PACE_SPECS: Array<Omit<TrainingPace, 'paceMin' | 'formatted'> & { pct: number }> = [
  { key: 'easy',       pct: 0.65, label: 'Fácil (E)',     purpose: 'Rodagem e recuperação — 80% do seu volume mora aqui', color: '#22C55E' },
  { key: 'marathon',   pct: 0.84, label: 'Maratona (M)',  purpose: 'Ritmo de prova longa, esforço controlado',            color: '#60A5FA' },
  { key: 'threshold',  pct: 0.88, label: 'Limiar (T)',    purpose: 'Tempo run — eleva o limiar de lactato',               color: '#F97316' },
  { key: 'interval',   pct: 0.98, label: 'Intervalado (I)', purpose: 'Tiros de 3-5 min — desenvolve o VO₂máx',            color: '#F472B6' },
  { key: 'repetition', pct: 1.06, label: 'Repetição (R)', purpose: 'Tiros curtos — velocidade e economia de corrida',     color: '#EF4444' },
]

export function trainingPaces(vdot: number): TrainingPace[] {
  return PACE_SPECS.map(spec => {
    const velocity = velocityAtVo2(vdot * spec.pct) // m/min
    const paceMin = Math.round((1000 / velocity) * 100) / 100
    return {
      key: spec.key,
      label: spec.label,
      purpose: spec.purpose,
      color: spec.color,
      paceMin,
      formatted: `${formatPace(paceMin)}/km`,
    }
  })
}

// ── Previsão de prova ────────────────────────────────────────────────────────

export interface RacePrediction {
  distanceKm: number
  label: string
  seconds: number
  formatted: string
  pacePerKm: string
}

export const RACE_DISTANCES: Array<{ km: number; label: string }> = [
  { km: 5,    label: '5 km' },
  { km: 10,   label: '10 km' },
  { km: 21.1, label: 'Meia maratona' },
  { km: 42.2, label: 'Maratona' },
]

/**
 * Tempo de prova que o VDOT implica. Como a fração sustentável do VO₂máx
 * depende da própria duração, o tempo aparece dos dois lados da equação — a
 * solução é iterar: chuta, recalcula, converge (5 voltas bastam).
 */
export function predictRaceTime(vdot: number, distanceKm: number): number {
  const meters = distanceKm * 1000
  let minutes = distanceKm * 5 // chute inicial: 5 min/km

  for (let i = 0; i < 12; i++) {
    const velocity = velocityAtVo2(vdot * fractionOfMax(minutes))
    const next = meters / velocity
    if (Math.abs(next - minutes) < 0.01) { minutes = next; break }
    minutes = next
  }

  return Math.round(minutes * 60)
}

function formatRaceTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function predictRaces(vdot: number): RacePrediction[] {
  return RACE_DISTANCES.map(({ km, label }) => {
    const seconds = predictRaceTime(vdot, km)
    return {
      distanceKm: km,
      label,
      seconds,
      formatted: formatRaceTime(seconds),
      pacePerKm: `${formatPace((seconds / 60) / km)}/km`,
    }
  })
}

// ── Evolução do VDOT ao longo do tempo ───────────────────────────────────────

export interface VdotPoint {
  label: string
  date: string
  vdot: number
}

/**
 * Melhor VDOT em janelas de 4 semanas — mostra se a forma está subindo ou
 * estagnada, sem o serrilhado de plotar cada corrida.
 */
export function buildVdotTrend(workouts: ManualWorkout[], months = 6): VdotPoint[] {
  const now = new Date()
  const points: VdotPoint[] = []

  for (let i = months - 1; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)

    let best: number | null = null
    for (const w of workouts) {
      if (w.type !== RUNNING_TYPE || w.dist < MIN_EFFORT_KM) continue
      const [y, m, d] = w.rawDate.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      if (dt < start || dt > end) continue
      const minutes = parseDurationToMinutes(w.time)
      if (minutes === null) continue
      const vdot = vdotFromEffort(w.dist, minutes)
      if (vdot !== null && (best === null || vdot > best)) best = vdot
    }

    if (best !== null) {
      points.push({
        label: start.toLocaleDateString('pt-BR', { month: 'short' }),
        date: start.toISOString().slice(0, 10),
        vdot: best,
      })
    }
  }

  return points
}

// ── Resumo textual para prompts de IA ────────────────────────────────────────

export function describeFitnessForAI(estimate: FitnessEstimate | null): string {
  if (!estimate) return 'Sem corridas suficientes para estimar VDOT/VO₂máx.'

  const paces = trainingPaces(estimate.vdot)
  const races = predictRaces(estimate.vdot)

  return [
    `VDOT estimado: ${estimate.vdot} (VO₂máx ≈ ${estimate.vo2max} ml/kg/min · nível ${estimate.level})`,
    `Baseado em: ${estimate.source.name} — ${estimate.source.dist}km em ${estimate.source.time} (${estimate.source.rawDate})`,
    `Ritmos de treino: ${paces.map(p => `${p.label} ${p.formatted}`).join(' · ')}`,
    `Previsão de prova: ${races.map(r => `${r.label} ${r.formatted}`).join(' · ')}`,
  ].join('\n')
}
