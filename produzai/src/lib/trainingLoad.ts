// Carga de treino e razão aguda:crônica (ACWR).
//
// O dado já estava no banco: cada treino tem esforço percebido (1 a 5) e
// duração. sRPE = RPE × minutos é a medida clássica de carga interna — ela
// enxerga que 60 min puxados pesam mais que 60 min leves, coisa que "número de
// treinos por semana" não vê.
//
// A razão aguda:crônica compara a carga dos últimos 7 dias com a média das
// últimas 4 semanas. Subir carga rápido demais é o padrão que antecede lesão;
// ficar muito abaixo por muito tempo é destreino. A leitura só vale quando já
// existe base crônica suficiente — antes disso o número engana mais do que ajuda.

import type { ManualWorkout } from '../store/useWorkoutStore'
import { parseDurationToMinutes } from './performance'
import { toLocalISO, todayKey } from './date'

/** Dias de histórico necessários para a carga crônica significar alguma coisa. */
export const MIN_DAYS_FOR_ACWR = 21

const ACUTE_DAYS = 7
const CHRONIC_DAYS = 28

/**
 * Esforço percebido do app é 1 a 5; a escala de Borg CR10 usada no sRPE vai até
 * 10. A conversão mantém a proporção: 1→2, 3→6, 5→10.
 */
export function effortToRpe(effort?: number): number {
  const e = Number(effort)
  if (!Number.isFinite(e) || e < 1) return 6      // sem esforço registrado: assume moderado
  return Math.min(5, Math.round(e)) * 2
}

/** Carga interna de uma sessão: RPE (0–10) × minutos. Unidade: "UA" (unidades arbitrárias). */
export function sessionLoad(w: ManualWorkout): number {
  const minutes = parseDurationToMinutes(w.time) ?? 0
  if (minutes <= 0) return 0
  return Math.round(effortToRpe(w.effort) * minutes)
}

// ── Carga por dia ─────────────────────────────────────────────────────────────

function dateMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function loadByDate(workouts: ManualWorkout[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const w of workouts) {
    const load = sessionLoad(w)
    if (load <= 0) continue
    map.set(w.rawDate, (map.get(w.rawDate) ?? 0) + load)
  }
  return map
}

/** Soma da carga na janela de `days` dias que termina em `end` (inclusive). */
function sumWindow(byDate: Map<string, number>, end: string, days: number): number {
  let total = 0
  const cursor = new Date(dateMs(end))
  for (let i = 0; i < days; i++) {
    total += byDate.get(toLocalISO(cursor)) ?? 0
    cursor.setDate(cursor.getDate() - 1)
  }
  return total
}

// ── ACWR ──────────────────────────────────────────────────────────────────────

export type LoadZone = 'destreino' | 'ideal' | 'atencao' | 'risco' | 'sem-base'

export interface TrainingLoadSummary {
  /** Carga dos últimos 7 dias, em UA. */
  acute: number
  /** Média semanal das últimas 4 semanas, em UA. */
  chronic: number
  /** Razão aguda:crônica — null enquanto não houver base suficiente. */
  acwr: number | null
  zone: LoadZone
  headline: string
  advice: string
  /** Quantos dias de histórico existem, do primeiro treino até hoje. */
  historyDays: number
  /** Carga da semana anterior, para comparação direta. */
  previousWeek: number
}

const ZONE_LABEL: Record<LoadZone, string> = {
  'destreino': 'Carga bem abaixo do seu normal',
  'ideal':     'Carga na faixa saudável',
  'atencao':   'Carga subindo rápido',
  'risco':     'Pico de carga',
  'sem-base':  'Ainda montando sua base',
}

export const ZONE_EMOJI: Record<LoadZone, string> = {
  'destreino': '🔵', 'ideal': '🟢', 'atencao': '🟡', 'risco': '🔴', 'sem-base': '⚪',
}

/**
 * Faixas usuais na literatura de carga: abaixo de 0,8 é destreino, 0,8–1,3 é a
 * janela confortável, 1,3–1,5 pede atenção e acima de 1,5 é o pico associado a
 * maior risco de lesão. São referências de população, não lei — por isso o texto
 * sugere ajuste, não proíbe treino.
 */
function zoneOf(acwr: number): LoadZone {
  if (acwr < 0.8) return 'destreino'
  if (acwr <= 1.3) return 'ideal'
  if (acwr <= 1.5) return 'atencao'
  return 'risco'
}

function adviceFor(zone: LoadZone, acute: number, chronic: number): string {
  const diff = Math.round(acute - chronic)
  switch (zone) {
    case 'ideal':
      return 'A carga desta semana está coerente com o que seu corpo vem aguentando. Pode seguir o plano.'
    case 'destreino':
      return `Você treinou ${Math.abs(diff)} UA a menos que sua média das últimas semanas. Uma semana leve é descanso; várias seguidas viram perda de base.`
    case 'atencao':
      return `Esta semana está ${diff} UA acima da sua média. Dá pra sustentar, mas evite somar mais intensidade nos próximos dias.`
    case 'risco':
      return `Salto grande: ${diff} UA acima da média das últimas 4 semanas. É o padrão que costuma anteceder lesão — segure o volume nos próximos dias e priorize sono.`
    case 'sem-base':
      return 'Continue registrando duração e esforço dos treinos. Em cerca de três semanas dá para comparar sua carga atual com a sua base.'
  }
}

export function computeTrainingLoad(
  workouts: ManualWorkout[],
  today: string = todayKey(),
): TrainingLoadSummary {
  const byDate = loadByDate(workouts)

  const acute = sumWindow(byDate, today, ACUTE_DAYS)
  const chronicTotal = sumWindow(byDate, today, CHRONIC_DAYS)
  const chronic = Math.round(chronicTotal / (CHRONIC_DAYS / ACUTE_DAYS))

  const previousWeekEnd = new Date(dateMs(today))
  previousWeekEnd.setDate(previousWeekEnd.getDate() - ACUTE_DAYS)
  const previousWeek = sumWindow(byDate, toLocalISO(previousWeekEnd), ACUTE_DAYS)

  const dates = [...byDate.keys()].sort()
  const historyDays = dates.length > 0
    ? Math.round((dateMs(today) - dateMs(dates[0])) / 86400000) + 1
    : 0

  // Sem base crônica, a razão vira ruído: uma primeira semana de treino daria
  // ACWR altíssimo só porque não há com o que comparar.
  if (historyDays < MIN_DAYS_FOR_ACWR || chronic <= 0) {
    return {
      acute, chronic, acwr: null, zone: 'sem-base',
      headline: ZONE_LABEL['sem-base'],
      advice: adviceFor('sem-base', acute, chronic),
      historyDays, previousWeek,
    }
  }

  const acwr = Math.round((acute / chronic) * 100) / 100
  const zone = zoneOf(acwr)

  return {
    acute, chronic, acwr, zone,
    headline: ZONE_LABEL[zone],
    advice: adviceFor(zone, acute, chronic),
    historyDays, previousWeek,
  }
}

// ── Série para gráfico ────────────────────────────────────────────────────────

export interface WeeklyLoadPoint {
  label: string
  /** Carga da semana, em UA. */
  load: number
  /** ACWR ao fim daquela semana — null enquanto faltava base. */
  acwr: number | null
}

/** Carga semanal e ACWR das últimas `weeks` semanas, da mais antiga para a mais nova. */
export function weeklyLoadTrend(
  workouts: ManualWorkout[],
  weeks = 8,
  today: string = todayKey(),
): WeeklyLoadPoint[] {
  const byDate = loadByDate(workouts)
  const dates = [...byDate.keys()].sort()
  const firstMs = dates.length > 0 ? dateMs(dates[0]) : null

  const points: WeeklyLoadPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(dateMs(today))
    end.setDate(end.getDate() - i * ACUTE_DAYS)
    const endKey = toLocalISO(end)

    const load = sumWindow(byDate, endKey, ACUTE_DAYS)
    const chronic = Math.round(sumWindow(byDate, endKey, CHRONIC_DAYS) / (CHRONIC_DAYS / ACUTE_DAYS))
    const daysOfHistory = firstMs === null ? 0 : Math.round((dateMs(endKey) - firstMs) / 86400000) + 1

    points.push({
      label: shortDate(endKey),
      load,
      acwr: daysOfHistory >= MIN_DAYS_FOR_ACWR && chronic > 0
        ? Math.round((load / chronic) * 100) / 100
        : null,
    })
  }
  return points
}

function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${d}/${m}`
}
