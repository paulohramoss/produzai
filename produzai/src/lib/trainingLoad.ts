// Motor de carga de treino — o núcleo que faltava para o app sair de "conta
// quilômetros" e virar coaching. Roda 100% local, sem custo de IA.
//
// Três modelos clássicos, todos alimentados pelos mesmos treinos já registrados:
//
//   1. Carga por sessão   — TRIMP de Banister (com FC) ou sRPE (sem FC),
//                           normalizados para "1h no limiar = 100".
//   2. Fitness/Fadiga     — CTL (média exponencial de 42d), ATL (7d) e
//                           TSB = CTL − ATL, o modelo de Banister/Coggan.
//   3. ACWR               — razão carga aguda (7d) / crônica (28d), o indicador
//                           com melhor correlação conhecida com risco de lesão.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { AthleteProfile } from './athleteProfile'
import { maxHrOf, restingHrOf } from './athleteProfile'
import { parseDurationToMinutes } from './performance'

const DAY_MS = 24 * 60 * 60 * 1000

const CTL_DAYS = 42
const ATL_DAYS = 7

// Ambos os modelos são normalizados para a mesma referência — 1h no limiar =
// 100 —, senão um treino com cinta e outro sem produziriam cargas em escalas
// diferentes e a série de fitness ficaria sem sentido.
const TRIMP_AT_THRESHOLD = 166.9  // TRIMP de Banister para 60 min a 85% da FCR
const SRPE_AT_THRESHOLD = 480     // 60 min × RPE 8

// ── Carga de uma sessão ──────────────────────────────────────────────────────

export type LoadMethod = 'trimp' | 'srpe'

export interface SessionLoad {
  workoutId: string
  date: string
  load: number
  method: LoadMethod
  durationMin: number
}

/**
 * TRIMP de Banister: dá peso exponencial à intensidade, então 30 min forte pesa
 * mais que 60 min leve — que é exatamente o que a fadiga real faz.
 */
function trimp(durationMin: number, avgHr: number, profile: AthleteProfile | null): number {
  const rest = restingHrOf(profile)
  const max = maxHrOf(profile)
  const reserve = Math.max(1, max - rest)
  const hrRatio = Math.min(1, Math.max(0, (avgHr - rest) / reserve))
  const sexFactor = profile?.sex === 'F' ? 0.86 : 0.64
  const expFactor = profile?.sex === 'F' ? 1.67 : 1.92
  return durationMin * hrRatio * sexFactor * Math.exp(expFactor * hrRatio)
}

/** Sessão × RPE (Foster): o fallback honesto quando não há dado de frequência cardíaca. */
function srpe(durationMin: number, effort: number): number {
  return durationMin * (effort * 2)
}

export function sessionLoad(w: ManualWorkout, profile: AthleteProfile | null): SessionLoad {
  const durationMin = parseDurationToMinutes(w.time) ?? 0

  if (durationMin <= 0) {
    return { workoutId: w.id, date: w.rawDate, load: 0, method: 'srpe', durationMin: 0 }
  }

  if (w.hr > 0) {
    const raw = trimp(durationMin, w.hr, profile)
    return {
      workoutId: w.id,
      date: w.rawDate,
      load: Math.round((raw / TRIMP_AT_THRESHOLD) * 100),
      method: 'trimp',
      durationMin,
    }
  }

  const raw = srpe(durationMin, w.effort ?? 2)
  return {
    workoutId: w.id,
    date: w.rawDate,
    load: Math.round((raw / SRPE_AT_THRESHOLD) * 100),
    method: 'srpe',
    durationMin,
  }
}

// ── Série diária: fitness, fadiga e forma ────────────────────────────────────

export interface LoadPoint {
  date: string
  label: string
  /** Carga do dia (soma das sessões). */
  load: number
  /** CTL — condicionamento acumulado (42 dias). */
  fitness: number
  /** ATL — fadiga recente (7 dias). */
  fatigue: number
  /** TSB — forma: fitness de ontem menos fadiga de ontem. */
  form: number
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shortLabel(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Série diária dos últimos `days` dias.
 *
 * O aquecimento importa: a média exponencial precisa de histórico ANTES da
 * janela exibida, senão todo usuário aparece com fitness zero subindo do nada.
 * Por isso a série é calculada desde o primeiro treino e só depois recortada.
 */
export function buildLoadSeries(
  workouts: ManualWorkout[],
  profile: AthleteProfile | null,
  days = 90,
): LoadPoint[] {
  if (workouts.length === 0) return []

  const loadByDate = new Map<string, number>()
  for (const w of workouts) {
    const { load } = sessionLoad(w, profile)
    loadByDate.set(w.rawDate, (loadByDate.get(w.rawDate) ?? 0) + load)
  }

  const sortedDates = [...loadByDate.keys()].sort()
  const [fy, fm, fd] = sortedDates[0].split('-').map(Number)
  const start = new Date(fy, fm - 1, fd)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const points: LoadPoint[] = []
  let fitness = 0
  let fatigue = 0

  for (let cursor = new Date(start); cursor <= today; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const date = isoDate(cursor)
    const load = loadByDate.get(date) ?? 0

    // A forma do dia é medida ANTES do treino de hoje — é com ela que o atleta
    // acorda e decide se aguenta a sessão.
    const form = fitness - fatigue

    fitness += (load - fitness) / CTL_DAYS
    fatigue += (load - fatigue) / ATL_DAYS

    points.push({
      date,
      label: shortLabel(cursor),
      load,
      fitness: Math.round(fitness * 10) / 10,
      fatigue: Math.round(fatigue * 10) / 10,
      form: Math.round(form * 10) / 10,
    })
  }

  return points.slice(-days)
}

// ── ACWR: risco de lesão por salto de volume ─────────────────────────────────

export type AcwrStatus = 'subcarga' | 'ideal' | 'atencao' | 'risco'

export interface AcwrResult {
  ratio: number
  acute: number
  chronic: number
  status: AcwrStatus
  label: string
  detail: string
  color: string
}

const ACWR_COLORS: Record<AcwrStatus, string> = {
  subcarga: '#60A5FA',
  ideal:    '#22C55E',
  atencao:  '#F97316',
  risco:    '#EF4444',
}

/**
 * Carga aguda (7 dias) sobre carga crônica (média semanal dos últimos 28).
 * A literatura de carga de treino aponta a faixa 0,8–1,3 como "sweet spot": é
 * onde se ganha condicionamento sem o salto de volume que precede lesões.
 */
export function computeAcwr(
  workouts: ManualWorkout[],
  profile: AthleteProfile | null,
  reference = new Date(),
): AcwrResult | null {
  const ref = new Date(reference)
  ref.setHours(23, 59, 59, 999)

  const loadWithin = (fromDaysAgo: number, toDaysAgo: number): number => {
    const from = ref.getTime() - fromDaysAgo * DAY_MS
    const to = ref.getTime() - toDaysAgo * DAY_MS
    return workouts
      .filter(w => {
        const [y, m, d] = w.rawDate.split('-').map(Number)
        const t = new Date(y, m - 1, d).getTime()
        return t > from && t <= to
      })
      .reduce((sum, w) => sum + sessionLoad(w, profile).load, 0)
  }

  const acute = loadWithin(7, 0)
  const chronic28 = loadWithin(28, 0)

  // Sem 28 dias de histórico o denominador é ruído — melhor não mostrar nada
  // do que mostrar um número que assusta sem base.
  const oldest = workouts.reduce((min, w) => (w.rawDate < min ? w.rawDate : min), workouts[0]?.rawDate ?? '')
  if (!oldest) return null
  const [oy, om, od] = oldest.split('-').map(Number)
  const historyDays = (ref.getTime() - new Date(oy, om - 1, od).getTime()) / DAY_MS
  if (historyDays < 21 || chronic28 <= 0) return null

  const chronic = chronic28 / 4
  const ratio = Math.round((acute / chronic) * 100) / 100

  let status: AcwrStatus
  let detail: string
  if (ratio < 0.8) {
    status = 'subcarga'
    detail = 'Sua carga desta semana está bem abaixo da média das últimas 4. Ótimo se for semana de recuperação; se não for, você está perdendo estímulo.'
  } else if (ratio <= 1.3) {
    status = 'ideal'
    detail = 'Sua carga está crescendo no ritmo que o corpo consegue absorver. É aqui que se ganha condicionamento sem cobrar caro depois.'
  } else if (ratio <= 1.5) {
    status = 'atencao'
    detail = 'Você subiu o volume mais rápido que a média das últimas semanas. Dá para sustentar por pouco tempo — evite outra semana igual em seguida.'
  } else {
    status = 'risco'
    detail = 'Salto de carga grande em relação ao seu histórico. É o padrão que costuma anteceder lesão por sobrecarga. Considere uma semana mais leve.'
  }

  const LABELS: Record<AcwrStatus, string> = {
    subcarga: 'Abaixo da base',
    ideal: 'Zona ideal',
    atencao: 'Subindo rápido',
    risco: 'Risco de sobrecarga',
  }

  return {
    ratio,
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    status,
    label: LABELS[status],
    detail,
    color: ACWR_COLORS[status],
  }
}

// ── Monotonia e strain (Foster) ──────────────────────────────────────────────

export interface MonotonyResult {
  monotony: number
  strain: number
  weeklyLoad: number
  isMonotonous: boolean
}

/**
 * Monotonia = média / desvio-padrão da carga diária na semana. Treinar sempre
 * igual, sem dias fáceis de verdade, eleva o strain e é associado a queda de
 * desempenho e adoecimento — mesmo com volume total moderado.
 */
export function computeMonotony(
  workouts: ManualWorkout[],
  profile: AthleteProfile | null,
  reference = new Date(),
): MonotonyResult | null {
  const ref = new Date(reference)
  ref.setHours(23, 59, 59, 999)

  const daily: number[] = []
  for (let i = 6; i >= 0; i--) {
    const day = isoDate(new Date(ref.getTime() - i * DAY_MS))
    daily.push(
      workouts
        .filter(w => w.rawDate === day)
        .reduce((sum, w) => sum + sessionLoad(w, profile).load, 0),
    )
  }

  const weeklyLoad = daily.reduce((a, b) => a + b, 0)
  if (weeklyLoad <= 0) return null

  const mean = weeklyLoad / 7
  const variance = daily.reduce((s, d) => s + (d - mean) ** 2, 0) / 7
  const sd = Math.sqrt(variance)

  // Desvio zero = TODOS os dias com carga idêntica, que é o extremo da
  // monotonia, não a ausência dela. Dividir por zero daria infinito, então o
  // piso no desvio mantém o índice num valor alto porém utilizável.
  const monotony = Math.round((mean / Math.max(sd, mean * 0.2)) * 100) / 100
  return {
    monotony,
    strain: Math.round(weeklyLoad * monotony),
    weeklyLoad: Math.round(weeklyLoad),
    isMonotonous: monotony >= 2,
  }
}

// ── Leitura da forma (TSB) ───────────────────────────────────────────────────

export type FormStatus = 'destreino' | 'fresco' | 'neutro' | 'construindo' | 'sobrecarga'

export interface FormReading {
  status: FormStatus
  label: string
  detail: string
  color: string
}

export function readForm(form: number): FormReading {
  if (form > 25) {
    return {
      status: 'destreino',
      label: 'Muito descansado',
      detail: 'Você está bem mais fresco do que treinado. Bom para uma prova nos próximos dias; ruim se a intenção era evoluir.',
      color: '#60A5FA',
    }
  }
  if (form > 5) {
    return {
      status: 'fresco',
      label: 'Fresco',
      detail: 'Corpo recuperado e pronto para render. É a janela ideal para uma prova ou um treino de qualidade forte.',
      color: '#22C55E',
    }
  }
  if (form >= -10) {
    return {
      status: 'neutro',
      label: 'Equilibrado',
      detail: 'Fadiga e condicionamento em equilíbrio. Dá para manter a rotina normalmente.',
      color: '#A78BFA',
    }
  }
  if (form >= -30) {
    return {
      status: 'construindo',
      label: 'Construindo',
      detail: 'Fadiga acumulada acima do condicionamento — é assim que se ganha base. Sustentável por algumas semanas, desde que venha um período leve depois.',
      color: '#F97316',
    }
  }
  return {
    status: 'sobrecarga',
    label: 'Sobrecarga',
    detail: 'Fadiga muito acima do que seu condicionamento sustenta. Continuar aqui troca ganho por risco — priorize dias leves e sono.',
    color: '#EF4444',
  }
}

// ── Prontidão do dia ─────────────────────────────────────────────────────────

export interface ReadinessInput {
  form: number | null
  acwr: AcwrResult | null
  sleepHours: number | null
  mood: number | null
  energy: number | null
  /** Desvio da VFC de hoje contra a linha de base pessoal, em %. Fase 6. */
  hrvDeviationPct: number | null
  /** Desvio da FC de repouso contra a linha de base, em bpm. Fase 6. */
  restingHrDelta: number | null
}

export interface ReadinessResult {
  score: number
  label: string
  color: string
  /** O que puxou o número para cima ou para baixo, do mais forte ao mais fraco. */
  drivers: Array<{ text: string; impact: 'up' | 'down' }>
  recommendation: string
  /** Quantos sinais alimentaram o cálculo — abaixo de 2 o número é fraco. */
  confidence: number
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Prontidão 0-100 — a resposta para "o que eu faço HOJE?".
 * Cada sinal disponível entra como um componente 0-100 e o resultado é a média;
 * sinais ausentes simplesmente não pesam, em vez de virarem zero.
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const parts: number[] = []
  const drivers: ReadinessResult['drivers'] = []

  if (input.form !== null) {
    // Forma +25 → 100, forma −40 → 0.
    const component = clamp(((input.form + 40) / 65) * 100)
    parts.push(component)
    const reading = readForm(input.form)
    if (input.form < -20) drivers.push({ text: `Fadiga acumulada alta (forma ${Math.round(input.form)})`, impact: 'down' })
    else if (input.form > 5) drivers.push({ text: `Corpo recuperado (${reading.label.toLowerCase()})`, impact: 'up' })
  }

  if (input.sleepHours !== null) {
    const h = input.sleepHours
    const component = h >= 7 && h <= 9 ? 100 : clamp(100 - (h < 7 ? (7 - h) : (h - 9)) * 22)
    parts.push(component)
    if (h < 6) drivers.push({ text: `Dormiu só ${h}h`, impact: 'down' })
    else if (h >= 7.5) drivers.push({ text: `Dormiu ${h}h`, impact: 'up' })
  }

  const wellbeing = [input.mood, input.energy].filter((v): v is number => v !== null && v > 0)
  if (wellbeing.length > 0) {
    const avg = wellbeing.reduce((a, b) => a + b, 0) / wellbeing.length
    parts.push(clamp(((avg - 1) / 4) * 100))
    if (avg <= 2) drivers.push({ text: 'Humor e energia baixos hoje', impact: 'down' })
    else if (avg >= 4) drivers.push({ text: 'Humor e energia altos hoje', impact: 'up' })
  }

  if (input.hrvDeviationPct !== null) {
    // VFC 15% abaixo da linha de base já é sinal claro de estresse fisiológico.
    const component = clamp(50 + input.hrvDeviationPct * 3.3)
    parts.push(component)
    if (input.hrvDeviationPct <= -10) drivers.push({ text: `VFC ${Math.abs(Math.round(input.hrvDeviationPct))}% abaixo da sua média`, impact: 'down' })
    else if (input.hrvDeviationPct >= 8) drivers.push({ text: 'VFC acima da sua média', impact: 'up' })
  }

  if (input.restingHrDelta !== null) {
    const component = clamp(100 - Math.max(0, input.restingHrDelta) * 12)
    parts.push(component)
    if (input.restingHrDelta >= 5) drivers.push({ text: `FC de repouso ${input.restingHrDelta} bpm acima do normal`, impact: 'down' })
  }

  if (input.acwr && (input.acwr.status === 'risco' || input.acwr.status === 'atencao')) {
    parts.push(input.acwr.status === 'risco' ? 25 : 55)
    drivers.push({ text: `Carga subiu rápido (ACWR ${input.acwr.ratio})`, impact: 'down' })
  }

  const score = parts.length > 0
    ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
    : 50

  let label: string, color: string, recommendation: string
  if (score >= 80) {
    label = 'Pronto para forçar'
    color = '#22C55E'
    recommendation = 'Dia bom para o treino mais duro da semana: intervalado, limiar ou o longo forte.'
  } else if (score >= 60) {
    label = 'Pronto'
    color = '#A78BFA'
    recommendation = 'Siga o plano normalmente. Se for treino de qualidade, mantenha; só não invente volume extra.'
  } else if (score >= 40) {
    label = 'Moderado'
    color = '#F97316'
    recommendation = 'Treine, mas segure a intensidade. Rodagem fácil em Z2 rende mais hoje que forçar um intervalado.'
  } else {
    label = 'Recuperar'
    color = '#EF4444'
    recommendation = 'Hoje o ganho está no descanso, não no treino. Caminhada leve, mobilidade ou folga — e priorize o sono.'
  }

  return {
    score,
    label,
    color,
    drivers: drivers.slice(0, 4),
    recommendation,
    confidence: parts.length,
  }
}

// ── Resumo textual para prompts de IA ────────────────────────────────────────

export function describeLoadForAI(
  series: LoadPoint[],
  acwr: AcwrResult | null,
  monotony: MonotonyResult | null,
): string {
  const last = series[series.length - 1]
  if (!last) return 'Sem histórico de treino suficiente para calcular carga.'

  const lines = [
    `Condicionamento (CTL, 42d): ${last.fitness}`,
    `Fadiga (ATL, 7d): ${last.fatigue}`,
    `Forma (TSB): ${last.form} — ${readForm(last.form).label}`,
  ]

  const fourWeeksAgo = series[series.length - 29]
  if (fourWeeksAgo) {
    const delta = Math.round((last.fitness - fourWeeksAgo.fitness) * 10) / 10
    lines.push(`Variação do condicionamento em 4 semanas: ${delta > 0 ? '+' : ''}${delta}`)
  }

  if (acwr) lines.push(`ACWR (aguda/crônica): ${acwr.ratio} — ${acwr.label}`)
  if (monotony) {
    lines.push(`Carga da semana: ${monotony.weeklyLoad} · monotonia ${monotony.monotony}${monotony.isMonotonous ? ' (alta — faltam dias realmente leves)' : ''}`)
  }

  return lines.join('\n')
}
