// Ciclo menstrual como fator de performance — sempre opt-in.
//
// Para a atleta mulher o ciclo explica variações de força, disposição e
// recuperação que nenhum outro fator do app captura: a mesma noite de sono rende
// diferente na fase folicular e na lútea tardia. Aqui ele vira o que os outros
// fatores já são — um número de 0 a 100 e uma frase que muda a decisão do treino.
//
// O cálculo é de calendário, não de laboratório: parte das datas de início de
// menstruação que a usuária registra e da duração média do ciclo dela.

export type CyclePhase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea'

export interface CycleSettings {
  /** Enquanto false, nada de ciclo aparece no app nem entra em nenhum score. */
  enabled: boolean
  /** Duração média do ciclo — do 1º dia de uma menstruação ao 1º da seguinte. */
  avgLength: number
  /** Quantos dias costuma durar o fluxo. */
  periodLength: number
}

export interface CycleData extends CycleSettings {
  /** Datas "YYYY-MM-DD" de início de menstruação, em ordem crescente. */
  starts: string[]
}

export const DEFAULT_CYCLE: CycleData = {
  enabled: false,
  avgLength: 28,
  periodLength: 5,
  starts: [],
}

export const CYCLE_LENGTH_RANGE = { min: 21, max: 40 }
export const PERIOD_LENGTH_RANGE = { min: 2, max: 10 }

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual:  'Menstrual',
  folicular:  'Folicular',
  ovulatoria: 'Ovulatória',
  lutea:      'Lútea',
}

export const PHASE_EMOJI: Record<CyclePhase, string> = {
  menstrual: '🩸', folicular: '🌱', ovulatoria: '⚡', lutea: '🌙',
}

export const PHASE_COLOR: Record<CyclePhase, 'red' | 'green' | 'orange' | 'purple'> = {
  menstrual: 'red', folicular: 'green', ovulatoria: 'orange', lutea: 'purple',
}

/**
 * Quanto a fase costuma render, de 0 a 100. Média de população, não verdade
 * individual — por isso a leitura do dia sempre mostra a frase junto do número.
 */
export const PHASE_SCORE: Record<CyclePhase, number> = {
  menstrual: 60, folicular: 95, ovulatoria: 100, lutea: 75,
}

export const PHASE_ADVICE: Record<CyclePhase, string> = {
  menstrual:
    'Energia costuma estar mais baixa nos primeiros dias. Treinar ajuda com cólica, '
    + 'mas hoje é para manter o volume, não para bater recorde.',
  folicular:
    'Melhor janela do ciclo para carga e intensidade: estrogênio subindo, força e '
    + 'recuperação em alta. Se tem treino puxado na semana, encaixe aqui.',
  ovulatoria:
    'Pico de força e disposição — dia de PR. Atenção só à estabilidade articular: '
    + 'a frouxidão ligamentar aumenta, então capriche no aquecimento.',
  lutea:
    'Corpo pede mais recuperação: temperatura e frequência cardíaca sobem, o calor '
    + 'pesa mais. Bom período para volume moderado, técnica e trabalho aeróbico.',
}

export interface CycleState {
  /** Dia do ciclo, começando em 1 no primeiro dia de menstruação. */
  day: number
  phase: CyclePhase
  /** "YYYY-MM-DD" do início do ciclo atual. */
  cycleStart: string
  /** Previsão do próximo início, pela duração média. */
  nextPeriod: string
  /** Negativo quando a previsão já passou. */
  daysToNextPeriod: number
  /**
   * O ciclo passou bastante da duração média — a previsão perde valor e a
   * usuária provavelmente esqueceu de registrar o início.
   */
  late: boolean
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Dias inteiros de `from` até `to` (negativo quando `to` é anterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / 86400000)
}

function addDays(key: string, days: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + days)
  return formatKey(d)
}

function clampInt(n: number, min: number, max: number, fallback: number): number {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
}

/** Normaliza o que veio da nuvem — duração fora da faixa quebraria a previsão. */
export function normalizeCycle(raw: Partial<CycleData> | null | undefined): CycleData {
  if (!raw) return { ...DEFAULT_CYCLE }
  const starts = [...new Set((raw.starts ?? []).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)))].sort()
  return {
    enabled: Boolean(raw.enabled),
    avgLength: clampInt(raw.avgLength ?? 28, CYCLE_LENGTH_RANGE.min, CYCLE_LENGTH_RANGE.max, 28),
    periodLength: clampInt(raw.periodLength ?? 5, PERIOD_LENGTH_RANGE.min, PERIOD_LENGTH_RANGE.max, 5),
    starts,
  }
}

function phaseForDay(day: number, s: Pick<CycleSettings, 'avgLength' | 'periodLength'>): CyclePhase {
  if (day <= s.periodLength) return 'menstrual'
  // A fase lútea tem duração quase fixa (~14 dias); é a folicular que estica ou
  // encurta. Por isso a ovulação é contada de trás para frente.
  const ovulation = Math.max(s.periodLength + 2, s.avgLength - 14)
  if (day >= ovulation - 1 && day <= ovulation + 1) return 'ovulatoria'
  return day < ovulation - 1 ? 'folicular' : 'lutea'
}

/**
 * Onde a atleta está no ciclo em `date`. `null` quando não há registro anterior
 * a essa data ou quando o último início ficou tão longe que a conta viraria chute.
 */
export function cycleStateFor(
  date: string,
  data: Pick<CycleData, 'starts' | 'avgLength' | 'periodLength'>,
): CycleState | null {
  const past = data.starts.filter(s => s <= date)
  if (past.length === 0) return null

  const cycleStart = past[past.length - 1]
  const day = daysBetween(cycleStart, date) + 1
  // Mais de dois ciclos sem registro: a previsão não diz mais nada de útil.
  if (day > data.avgLength * 2) return null

  const nextPeriod = addDays(cycleStart, data.avgLength)
  return {
    day,
    phase: phaseForDay(day, data),
    cycleStart,
    nextPeriod,
    daysToNextPeriod: daysBetween(date, nextPeriod),
    late: day > data.avgLength + 3,
  }
}

/** Duração média real dos últimos ciclos registrados — melhor que o valor digitado. */
export function observedCycleLength(starts: string[]): number | null {
  if (starts.length < 3) return null
  const sorted = [...starts].sort()
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i])
    if (gap >= CYCLE_LENGTH_RANGE.min && gap <= CYCLE_LENGTH_RANGE.max) gaps.push(gap)
  }
  if (gaps.length < 2) return null
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
}
