// Sinais de recuperação: variabilidade da frequência cardíaca (VFC/rMSSD) e
// frequência cardíaca de repouso.
//
// Nenhum dos dois diz nada em valor absoluto — VFC de 60 ms é ótima para uma
// pessoa e ruim para outra. O que informa é o DESVIO contra a linha de base do
// próprio atleta, e é isso que este módulo calcula.

import type { MentalEntry } from './db'

/** Mínimo de medições para a linha de base valer alguma coisa. */
const MIN_BASELINE_SAMPLES = 5
const BASELINE_WINDOW_DAYS = 30

export interface RecoveryDeviation {
  /** Quanto a VFC de hoje está acima (+) ou abaixo (−) da linha de base, em %. */
  hrvDeviationPct: number | null
  /** Quantos bpm a FC de repouso de hoje está acima (+) da linha de base. */
  restingHrDelta: number | null
  hrvBaseline: number | null
  restingHrBaseline: number | null
  hrvToday: number | null
  restingHrToday: number | null
  samples: number
}

const EMPTY: RecoveryDeviation = {
  hrvDeviationPct: null,
  restingHrDelta: null,
  hrvBaseline: null,
  restingHrBaseline: null,
  hrvToday: null,
  restingHrToday: null,
  samples: 0,
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function previousDates(todayKey: string, days: number): string[] {
  const [y, m, d] = todayKey.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  const out: string[] = []
  for (let i = 1; i <= days; i++) {
    const dt = new Date(base)
    dt.setDate(base.getDate() - i)
    const pad = (n: number) => String(n).padStart(2, '0')
    out.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`)
  }
  return out
}

/**
 * Compara as medições de hoje com a média dos 30 dias anteriores.
 * A leitura prática: VFC 10% ou mais abaixo da base, ou FC de repouso 5+ bpm
 * acima, indicam que o corpo ainda está pagando o treino anterior (ou dormindo
 * mal, ou adoecendo) — em qualquer dos casos, não é dia de forçar.
 */
export function recoveryDeviation(
  history: Record<string, MentalEntry>,
  todayKey: string,
): RecoveryDeviation {
  const today = history[todayKey]
  const previous = previousDates(todayKey, BASELINE_WINDOW_DAYS).map(d => history[d]).filter(Boolean)

  const hrvSamples = previous.map(e => e.hrvMs).filter((v): v is number => typeof v === 'number' && v > 0)
  const rhrSamples = previous.map(e => e.restingHr).filter((v): v is number => typeof v === 'number' && v > 0)

  const hrvToday = today?.hrvMs && today.hrvMs > 0 ? today.hrvMs : null
  const rhrToday = today?.restingHr && today.restingHr > 0 ? today.restingHr : null

  if (!hrvToday && !rhrToday) return EMPTY

  const hrvBaseline = hrvSamples.length >= MIN_BASELINE_SAMPLES ? Math.round(mean(hrvSamples)) : null
  const rhrBaseline = rhrSamples.length >= MIN_BASELINE_SAMPLES ? Math.round(mean(rhrSamples)) : null

  return {
    hrvToday,
    restingHrToday: rhrToday,
    hrvBaseline,
    restingHrBaseline: rhrBaseline,
    hrvDeviationPct: hrvToday !== null && hrvBaseline
      ? Math.round(((hrvToday - hrvBaseline) / hrvBaseline) * 1000) / 10
      : null,
    restingHrDelta: rhrToday !== null && rhrBaseline ? rhrToday - rhrBaseline : null,
    samples: Math.max(hrvSamples.length, rhrSamples.length),
  }
}

/** Frase curta sobre o estado de recuperação — usada em cards e no prompt da IA. */
export function describeRecovery(dev: RecoveryDeviation): string | null {
  if (dev.hrvDeviationPct === null && dev.restingHrDelta === null) return null

  const parts: string[] = []
  if (dev.hrvDeviationPct !== null) {
    const abs = Math.abs(Math.round(dev.hrvDeviationPct))
    if (dev.hrvDeviationPct <= -10) parts.push(`VFC ${abs}% abaixo da sua linha de base (${dev.hrvToday}ms vs ${dev.hrvBaseline}ms)`)
    else if (dev.hrvDeviationPct >= 8) parts.push(`VFC ${abs}% acima da sua linha de base`)
    else parts.push(`VFC dentro da normalidade (${dev.hrvToday}ms)`)
  }
  if (dev.restingHrDelta !== null) {
    if (dev.restingHrDelta >= 5) parts.push(`FC de repouso ${dev.restingHrDelta} bpm acima do normal`)
    else if (dev.restingHrDelta <= -3) parts.push(`FC de repouso ${Math.abs(dev.restingHrDelta)} bpm abaixo do normal`)
    else parts.push(`FC de repouso normal (${dev.restingHrToday} bpm)`)
  }
  return parts.join(' · ')
}
