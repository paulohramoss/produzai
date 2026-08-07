// Prontidão do dia: transforma o check-in da manhã num número e num veredicto.
//
// Quatro perguntas (sono, qualidade do sono, dor muscular, disposição) mais a FC
// de repouso opcional. O objetivo não é precisão de laboratório — é dar ao atleta
// um sinal honesto antes do treino: hoje dá para puxar, manter ou segurar.

import type { ReadinessEntry } from './db'

export type Verdict = 'puxa' | 'mantem' | 'segura'

export interface ReadinessFactor {
  label: string
  /** 0 a 100 — quanto esse fator contribuiu. */
  score: number
  detail: string
}

export interface ReadinessResult {
  score: number
  verdict: Verdict
  headline: string
  advice: string
  factors: ReadinessFactor[]
  /** Quanto a FC de repouso mexeu no score (0 quando não há base de comparação). */
  hrAdjustment: number
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  puxa:   'Hoje dá pra puxar',
  mantem: 'Hoje é dia de manter',
  segura: 'Hoje é dia de segurar',
}

export const VERDICT_EMOJI: Record<Verdict, string> = {
  puxa: '🟢', mantem: '🟡', segura: '🔴',
}

// ── Peças do score ────────────────────────────────────────────────────────────

/** 7 a 9 horas é a faixa cheia; cada hora fora tira 20 pontos. */
function sleepHoursScore(hours: number): number {
  if (hours >= 7 && hours <= 9) return 100
  const diff = hours < 7 ? 7 - hours : hours - 9
  return clamp(100 - diff * 20)
}

/** Escalas de 1 a 5 viram 0 a 100. */
function scale5(v: number): number {
  return clamp(((v - 1) / 4) * 100)
}

/** Dor muscular é invertida: 1 (nenhuma) é o melhor cenário. */
function sorenessScore(v: number): number {
  return clamp(((5 - v) / 4) * 100)
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}

const WEIGHTS = { sleepHours: 0.3, sleepQuality: 0.2, soreness: 0.25, drive: 0.25 }

// ── FC de repouso ─────────────────────────────────────────────────────────────

/**
 * Base de comparação da FC de repouso: média das medidas anteriores.
 * Abaixo de 3 medidas não há base — um único dia não diz nada.
 */
export function restingHrBaseline(history: ReadinessEntry[]): number | null {
  const values = history.map(e => e.restingHr).filter((v): v is number => typeof v === 'number' && v > 0)
  if (values.length < 3) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * FC de repouso acima da base costuma indicar recuperação incompleta, infecção
 * ou estresse. Vale como ajuste, nunca como fator dominante: −15 a +5 pontos.
 */
function hrAdjustment(entry: ReadinessEntry, baseline: number | null): number {
  if (!entry.restingHr || baseline == null) return 0
  const diff = entry.restingHr - baseline
  if (diff >= 10) return -15
  if (diff >= 5) return -8
  if (diff <= -5) return 5
  return 0
}

// ── Resultado ─────────────────────────────────────────────────────────────────

export function computeReadiness(entry: ReadinessEntry, history: ReadinessEntry[] = []): ReadinessResult {
  const baseline = restingHrBaseline(history)

  const parts = {
    sleepHours:   sleepHoursScore(entry.sleepHours),
    sleepQuality: scale5(entry.sleepQuality),
    soreness:     sorenessScore(entry.soreness),
    drive:        scale5(entry.drive),
  }

  const weighted =
    parts.sleepHours * WEIGHTS.sleepHours +
    parts.sleepQuality * WEIGHTS.sleepQuality +
    parts.soreness * WEIGHTS.soreness +
    parts.drive * WEIGHTS.drive

  const adjustment = hrAdjustment(entry, baseline)
  const score = Math.round(clamp(weighted + adjustment))
  const verdict: Verdict = score >= 78 ? 'puxa' : score >= 58 ? 'mantem' : 'segura'

  const factors: ReadinessFactor[] = [
    { label: 'Sono',        score: parts.sleepHours,   detail: `${formatHours(entry.sleepHours)} dormidas` },
    { label: 'Qualidade',   score: parts.sleepQuality, detail: `${entry.sleepQuality}/5 de qualidade` },
    { label: 'Dor muscular', score: parts.soreness,    detail: sorenessLabel(entry.soreness) },
    { label: 'Disposição',  score: parts.drive,        detail: `${entry.drive}/5 de disposição` },
  ]
  if (entry.restingHr && baseline != null) {
    const diff = entry.restingHr - baseline
    factors.push({
      label: 'FC repouso',
      score: clamp(100 + adjustment * 4),
      detail: diff === 0
        ? `${entry.restingHr} bpm, na sua média`
        : `${entry.restingHr} bpm (${diff > 0 ? '+' : ''}${diff} vs. sua média de ${baseline})`,
    })
  }

  return {
    score,
    verdict,
    headline: VERDICT_LABEL[verdict],
    advice: buildAdvice(verdict, entry, parts, adjustment),
    factors,
    hrAdjustment: adjustment,
  }
}

function formatHours(h: number): string {
  return Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h${Math.round((h % 1) * 60)}`
}

function sorenessLabel(v: number): string {
  return ['sem dor', 'dor leve', 'dor moderada', 'dor forte', 'dor muito forte'][v - 1] ?? `${v}/5`
}

/** O conselho aponta o elo mais fraco do dia — é o que muda a decisão do treino. */
function buildAdvice(
  verdict: Verdict,
  entry: ReadinessEntry,
  parts: Record<string, number>,
  adjustment: number,
): string {
  if (verdict === 'puxa') {
    return 'Corpo recuperado. Se tem treino puxado na semana, hoje é o dia dele.'
  }

  const weakest = Object.entries(parts).sort((a, b) => a[1] - b[1])[0][0]

  if (verdict === 'mantem') {
    const because =
      weakest === 'sleepHours'   ? `você dormiu ${formatHours(entry.sleepHours)}` :
      weakest === 'sleepQuality' ? 'o sono não foi dos melhores' :
      weakest === 'soreness'     ? 'ainda tem dor da sessão anterior' :
                                   'a disposição está média'
    return `Dá pra treinar normal, mas ${because} — mantenha o volume planejado e evite subir carga hoje.`
  }

  if (adjustment <= -8) {
    return 'FC de repouso bem acima da sua média, sinal clássico de recuperação incompleta. Treino leve ou descanso, e reavalie amanhã.'
  }
  const because =
    weakest === 'sleepHours'   ? `dormiu só ${formatHours(entry.sleepHours)}` :
    weakest === 'sleepQuality' ? 'o sono foi ruim' :
    weakest === 'soreness'     ? 'a dor muscular está alta' :
                                 'a disposição está no chão'
  return `Hoje ${because}. Troque por algo leve — caminhada, mobilidade, técnica — e guarde a intensidade para quando o corpo devolver.`
}

// ── Sugestão de valores ───────────────────────────────────────────────────────

/** Ponto de partida do formulário: repete o último check-in, ou o meio da escala. */
export function defaultReadinessDraft(last: ReadinessEntry | null): Omit<ReadinessEntry, 'loggedAt'> {
  return {
    sleepHours:   last?.sleepHours ?? 7,
    sleepQuality: last?.sleepQuality ?? 3,
    soreness:     last?.soreness ?? 2,
    drive:        last?.drive ?? 3,
    ...(last?.restingHr ? { restingHr: last.restingHr } : {}),
  }
}
