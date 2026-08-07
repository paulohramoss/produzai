// Análise de UM treino. Roda 100% local sobre os streams do Strava (ou sobre o
// resumo, quando não há streams) — sem custo de IA. A IA da Fase 1 recebe estes
// números prontos e só escreve a narrativa em cima deles.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { AthleteProfile } from './athleteProfile'
import { hrZones, zoneOfHr, maxHrOf } from './athleteProfile'
import { formatPace, parsePaceToMinutes, parseDurationToMinutes } from './performance'

// ── Streams crus vindos do Strava ────────────────────────────────────────────

interface StreamChannel { data?: number[] }
export interface StravaStreams {
  time?: StreamChannel
  heartrate?: StreamChannel
  velocity_smooth?: StreamChannel
  distance?: StreamChannel
  altitude?: StreamChannel
  cadence?: StreamChannel
}

// ── Resultado ────────────────────────────────────────────────────────────────

export interface ZoneSlice {
  zone: 1 | 2 | 3 | 4 | 5
  label: string
  color: string
  seconds: number
  pct: number
}

export interface KmSplit {
  km: number
  paceMin: number
  hr: number | null
  elevDelta: number | null
}

export interface WorkoutAnalysis {
  /** 'streams' = análise completa; 'summary' = só o que o resumo permitia. */
  depth: 'streams' | 'summary'
  zones: ZoneSlice[]
  avgHr: number | null
  maxHr: number | null
  /** % do tempo em Z1+Z2 — a base da regra 80/20. */
  easyPct: number | null
  hardPct: number | null
  splits: KmSplit[]
  /** Deriva cardíaca: quanto a relação ritmo:FC piorou na 2ª metade (%). */
  decoupling: number | null
  /** Negativo = 2ª metade mais rápida (negative split), em segundos por km. */
  splitDeltaSec: number | null
  avgCadence: number | null
  elevGain: number | null
  /** Metros percorridos por batimento — proxy simples de economia. */
  efficiency: number | null
}

const MAX_SPLITS = 60

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Análise completa a partir dos streams segundo a segundo. */
export function analyzeStreams(
  streams: StravaStreams | null,
  profile: AthleteProfile | null,
  fallback: { durationMin: number; distKm: number; avgHr: number },
): WorkoutAnalysis {
  const time = streams?.time?.data ?? []
  const hr = streams?.heartrate?.data ?? []
  const dist = streams?.distance?.data ?? []
  const alt = streams?.altitude?.data ?? []
  const cad = streams?.cadence?.data ?? []

  const hasStreams = time.length > 1 && (hr.length > 1 || dist.length > 1)
  if (!hasStreams) return analyzeFromSummary(fallback, profile)

  const zoneDefs = hrZones(profile)
  const secondsPerZone = new Map<number, number>()
  const hrSamples: number[] = []

  for (let i = 1; i < time.length; i++) {
    const dt = Math.max(0, Math.min(30, time[i] - time[i - 1])) // pausas longas não contam
    const beat = hr[i]
    if (!beat || beat <= 0) continue
    hrSamples.push(beat)
    const z = zoneOfHr(beat, profile)
    secondsPerZone.set(z, (secondsPerZone.get(z) ?? 0) + dt)
  }

  const totalZoneSec = [...secondsPerZone.values()].reduce((a, b) => a + b, 0)
  const zones: ZoneSlice[] = zoneDefs.map(z => {
    const seconds = Math.round(secondsPerZone.get(z.zone) ?? 0)
    return {
      zone: z.zone,
      label: z.label,
      color: z.color,
      seconds,
      pct: totalZoneSec > 0 ? Math.round((seconds / totalZoneSec) * 100) : 0,
    }
  })

  const avgHr = hrSamples.length ? Math.round(mean(hrSamples)!) : (fallback.avgHr || null)
  const peakHr = hrSamples.length ? Math.max(...hrSamples) : null

  const easyPct = totalZoneSec > 0 ? zones[0].pct + zones[1].pct : null
  const hardPct = totalZoneSec > 0 ? zones[3].pct + zones[4].pct : null

  return {
    depth: 'streams',
    zones,
    avgHr,
    maxHr: peakHr,
    easyPct,
    hardPct,
    splits: buildSplits(time, dist, hr, alt),
    decoupling: computeDecoupling(time, dist, hr),
    splitDeltaSec: computeSplitDelta(time, dist),
    avgCadence: computeCadence(cad),
    elevGain: computeElevGain(alt),
    efficiency: computeEfficiency(dist, hrSamples, avgHr),
  }
}

/** Sem streams: dá para saber a zona média e pouco mais — melhor que nada. */
export function analyzeFromSummary(
  w: { durationMin: number; distKm: number; avgHr: number },
  profile: AthleteProfile | null,
): WorkoutAnalysis {
  const zoneDefs = hrZones(profile)
  const seconds = Math.max(0, Math.round(w.durationMin * 60))
  const hasHr = w.avgHr > 0
  const zoneOfAvg = hasHr ? zoneOfHr(w.avgHr, profile) : null

  const zones: ZoneSlice[] = zoneDefs.map(z => ({
    zone: z.zone,
    label: z.label,
    color: z.color,
    seconds: z.zone === zoneOfAvg ? seconds : 0,
    pct: z.zone === zoneOfAvg ? 100 : 0,
  }))

  return {
    depth: 'summary',
    zones: hasHr ? zones : [],
    avgHr: hasHr ? w.avgHr : null,
    maxHr: null,
    easyPct: zoneOfAvg ? (zoneOfAvg <= 2 ? 100 : 0) : null,
    hardPct: zoneOfAvg ? (zoneOfAvg >= 4 ? 100 : 0) : null,
    splits: [],
    decoupling: null,
    splitDeltaSec: null,
    avgCadence: null,
    elevGain: null,
    efficiency: null,
  }
}

// ── Cálculos individuais ─────────────────────────────────────────────────────

function buildSplits(time: number[], dist: number[], hr: number[], alt: number[]): KmSplit[] {
  if (dist.length < 2) return []
  const splits: KmSplit[] = []
  let nextMark = 1000
  let lastIdx = 0

  for (let i = 1; i < dist.length && splits.length < MAX_SPLITS; i++) {
    if (dist[i] < nextMark) continue
    const seconds = time[i] - time[lastIdx]
    const meters = dist[i] - dist[lastIdx]
    if (seconds > 0 && meters > 0) {
      const hrSlice = hr.slice(lastIdx, i + 1).filter(h => h > 0)
      splits.push({
        km: splits.length + 1,
        paceMin: Math.round(((seconds / 60) / (meters / 1000)) * 100) / 100,
        hr: hrSlice.length ? Math.round(mean(hrSlice)!) : null,
        elevDelta: alt.length > i ? Math.round(alt[i] - alt[lastIdx]) : null,
      })
    }
    lastIdx = i
    nextMark += 1000
  }
  return splits
}

/**
 * Deriva cardíaca (Pa:HR). Compara a razão velocidade/FC da 1ª e da 2ª metade.
 * Acima de ~5% indica base aeróbica insuficiente para a duração do esforço —
 * é o número que separa "fiz o treino" de "aguentei o treino".
 */
function computeDecoupling(time: number[], dist: number[], hr: number[]): number | null {
  if (time.length < 60 || dist.length < 60 || hr.length < 60) return null
  const mid = Math.floor(time.length / 2)

  const halfRatio = (from: number, to: number): number | null => {
    const seconds = time[to] - time[from]
    const meters = dist[to] - dist[from]
    const beats = hr.slice(from, to + 1).filter(h => h > 0)
    if (seconds <= 0 || meters <= 0 || beats.length === 0) return null
    const speed = meters / seconds // m/s
    return speed / mean(beats)!
  }

  const first = halfRatio(0, mid)
  const second = halfRatio(mid, time.length - 1)
  if (first === null || second === null || first === 0) return null
  return Math.round(((first - second) / first) * 1000) / 10
}

/** Diferença de pace entre 2ª e 1ª metade, em segundos por km. Negativo = acelerou. */
function computeSplitDelta(time: number[], dist: number[]): number | null {
  if (time.length < 60 || dist.length < 60) return null
  const mid = Math.floor(time.length / 2)

  const pace = (from: number, to: number): number | null => {
    const seconds = time[to] - time[from]
    const km = (dist[to] - dist[from]) / 1000
    if (seconds <= 0 || km <= 0.3) return null
    return seconds / km
  }

  const first = pace(0, mid)
  const second = pace(mid, time.length - 1)
  if (first === null || second === null) return null
  return Math.round(second - first)
}

function computeCadence(cad: number[]): number | null {
  const valid = cad.filter(c => c > 0)
  if (valid.length < 10) return null
  // O Strava reporta a cadência de UMA perna na corrida — o padrão (spm) é o dobro.
  return Math.round(mean(valid)! * 2)
}

function computeElevGain(alt: number[]): number | null {
  if (alt.length < 10) return null
  let gain = 0
  for (let i = 1; i < alt.length; i++) {
    const delta = alt[i] - alt[i - 1]
    if (delta > 0.3) gain += delta // ignora ruído do barômetro
  }
  return Math.round(gain)
}

/** Metros por batimento: quanto mais alto, mais barato o ritmo saiu para o coração. */
function computeEfficiency(dist: number[], hrSamples: number[], avgHr: number | null): number | null {
  if (dist.length < 10 || !avgHr || hrSamples.length === 0) return null
  const meters = dist[dist.length - 1] - dist[0]
  if (meters <= 0) return null
  const minutes = hrSamples.length / 60
  if (minutes <= 0) return null
  const beats = avgHr * minutes
  return Math.round((meters / beats) * 100) / 100
}

// ── Comparação com o histórico ───────────────────────────────────────────────

export interface SimilarComparison {
  count: number
  avgPaceMin: number | null
  avgHr: number | null
  avgDistKm: number
  /** Diferença deste treino contra a média dos anteriores, em seg/km. Negativo = mais rápido. */
  paceDeltaSec: number | null
  hrDelta: number | null
  isDistanceRecord: boolean
  isPaceRecord: boolean
}

/** Compara o treino com os últimos do mesmo tipo — o contexto que a IA precisa. */
export function compareWithSimilar(
  target: ManualWorkout,
  all: ManualWorkout[],
  limit = 6,
): SimilarComparison | null {
  const previous = all
    .filter(w => w.id !== target.id && w.type === target.type && w.rawDate <= target.rawDate)
    .sort((a, b) => b.rawDate.localeCompare(a.rawDate))
    .slice(0, limit)

  if (previous.length === 0) return null

  const paces = previous.map(w => parsePaceToMinutes(w.pace)).filter((p): p is number => p !== null)
  const hrs = previous.map(w => w.hr).filter(h => h > 0)
  const targetPace = parsePaceToMinutes(target.pace)

  const avgPaceMin = paces.length ? Math.round((mean(paces)! ) * 100) / 100 : null
  const avgHr = hrs.length ? Math.round(mean(hrs)!) : null

  return {
    count: previous.length,
    avgPaceMin,
    avgHr,
    avgDistKm: Math.round(mean(previous.map(w => w.dist))! * 10) / 10,
    paceDeltaSec: targetPace !== null && avgPaceMin !== null
      ? Math.round((targetPace - avgPaceMin) * 60)
      : null,
    hrDelta: avgHr !== null && target.hr > 0 ? target.hr - avgHr : null,
    isDistanceRecord: target.dist > 0 && previous.every(w => w.dist < target.dist),
    isPaceRecord: targetPace !== null && paces.length > 0 && paces.every(p => p > targetPace),
  }
}

// ── Serialização para a IA ───────────────────────────────────────────────────

/** Briefing textual e compacto — é isso que vai no prompt, não o JSON cru. */
export function describeForAI(
  w: ManualWorkout,
  analysis: WorkoutAnalysis,
  comparison: SimilarComparison | null,
  profile: AthleteProfile | null,
): string {
  const lines: string[] = []
  const durationMin = parseDurationToMinutes(w.time)

  lines.push(`Treino: ${w.name} (${w.type}) em ${w.rawDate}`)
  lines.push(`Duração: ${w.time}${durationMin ? ` (${durationMin} min)` : ''}`)
  if (w.dist > 0) lines.push(`Distância: ${w.dist} km · pace médio ${w.pace}/km`)
  if (w.cal > 0) lines.push(`Calorias: ${w.cal} kcal`)
  if (analysis.elevGain) lines.push(`Ganho de elevação: ${analysis.elevGain} m`)

  if (analysis.avgHr) {
    lines.push(`FC média: ${analysis.avgHr} bpm${analysis.maxHr ? ` · pico ${analysis.maxHr} bpm` : ''} (FCmáx estimada do atleta: ${maxHrOf(profile)} bpm)`)
  }

  const activeZones = analysis.zones.filter(z => z.pct > 0)
  if (activeZones.length > 0) {
    lines.push(`Distribuição por zona: ${activeZones.map(z => `${z.label} ${z.pct}%`).join(' · ')}`)
  }
  if (analysis.easyPct !== null && analysis.hardPct !== null) {
    lines.push(`Fácil (Z1-Z2): ${analysis.easyPct}% · Forte (Z4-Z5): ${analysis.hardPct}%`)
  }

  if (analysis.decoupling !== null) {
    lines.push(`Deriva cardíaca (Pa:HR): ${analysis.decoupling > 0 ? '+' : ''}${analysis.decoupling}% — acima de 5% indica que a base aeróbica não sustentou o esforço até o fim`)
  }
  if (analysis.splitDeltaSec !== null) {
    lines.push(`Split: 2ª metade ${analysis.splitDeltaSec < 0 ? `${Math.abs(analysis.splitDeltaSec)}s/km mais RÁPIDA (negative split)` : `${analysis.splitDeltaSec}s/km mais lenta`}`)
  }
  if (analysis.avgCadence) lines.push(`Cadência média: ${analysis.avgCadence} passos/min`)
  if (analysis.efficiency) lines.push(`Economia: ${analysis.efficiency} metros por batimento`)

  if (analysis.splits.length >= 2) {
    const shown = analysis.splits.slice(0, 25)
    lines.push(`Parciais por km: ${shown.map(s => `${s.km}) ${formatPace(s.paceMin)}${s.hr ? ` ${s.hr}bpm` : ''}`).join(' · ')}`)
  }

  if (comparison) {
    lines.push('')
    lines.push(`Comparação com os ${comparison.count} treinos anteriores de ${w.type}:`)
    if (comparison.avgPaceMin !== null) lines.push(`- Pace médio anterior: ${formatPace(comparison.avgPaceMin)}/km`)
    if (comparison.paceDeltaSec !== null) {
      lines.push(`- Este treino: ${comparison.paceDeltaSec < 0 ? `${Math.abs(comparison.paceDeltaSec)}s/km mais rápido` : `${comparison.paceDeltaSec}s/km mais lento`} que a média`)
    }
    if (comparison.avgHr !== null) lines.push(`- FC média anterior: ${comparison.avgHr} bpm`)
    if (comparison.hrDelta !== null) lines.push(`- Diferença de FC: ${comparison.hrDelta > 0 ? '+' : ''}${comparison.hrDelta} bpm`)
    lines.push(`- Distância média anterior: ${comparison.avgDistKm} km`)
    if (comparison.isDistanceRecord) lines.push('- 🏆 MAIOR DISTÂNCIA já registrada neste tipo')
    if (comparison.isPaceRecord) lines.push('- 🏆 MELHOR PACE já registrado neste tipo')
  }

  return lines.join('\n')
}
