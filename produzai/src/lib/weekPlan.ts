// Plano da semana: o que está previsto, e não só o que já passou.
//
// Até aqui o app era inteiramente retrospectivo — registrava o treino depois de
// feito. O plano é uma grade fixa por dia da semana (segunda a domingo) que se
// repete: é assim que um plano de treino real funciona. Dele saem duas coisas
// que faltavam: "seu próximo treino é X" e a aderência entre planejado e feito.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { EffortLevel } from './calories'
import { toLocalISO, todayKey } from './date'

/** 1 = segunda … 7 = domingo (mesma convenção ISO usada no resto do app). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo',
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom',
}

export interface PlannedSession {
  id: string
  weekday: Weekday
  type: string
  name: string
  durationMin: number
  effort?: EffortLevel
  notes?: string
}

// ── Calendário ────────────────────────────────────────────────────────────────

export function weekdayOf(dateKey: string): Weekday {
  const [y, m, d] = dateKey.split('-').map(Number)
  return ((new Date(y, m - 1, d).getDay() || 7) as Weekday)
}

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalISO(date)
}

/** Datas de segunda a domingo da semana que contém `anyDay`. */
export function weekDates(anyDay: string = todayKey()): string[] {
  const monday = shift(anyDay, -(weekdayOf(anyDay) - 1))
  return Array.from({ length: 7 }, (_, i) => shift(monday, i))
}

// ── Próximo treino ────────────────────────────────────────────────────────────

export interface NextSession {
  session: PlannedSession
  date: string
  /** 0 = hoje, 1 = amanhã, … */
  daysAhead: number
  /** Se a sessão de hoje já foi registrada. */
  doneToday: boolean
}

function isDoneOn(workouts: ManualWorkout[], date: string, type: string): boolean {
  return workouts.some(w => w.rawDate === date && w.type === type)
}

/**
 * A próxima sessão do plano, olhando de hoje até sete dias à frente.
 *
 * A de hoje continua sendo "a próxima" mesmo depois de registrada — o card
 * mostra que foi cumprida em vez de pular direto para amanhã, que seria
 * confuso para quem acabou de treinar.
 */
export function nextSession(
  plan: PlannedSession[],
  workouts: ManualWorkout[],
  from: string = todayKey(),
): NextSession | null {
  if (plan.length === 0) return null

  for (let i = 0; i <= 7; i++) {
    const date = shift(from, i)
    const day = weekdayOf(date)
    const sessions = plan.filter(s => s.weekday === day)
    if (sessions.length === 0) continue

    // No dia de hoje, prioriza o que ainda não foi feito.
    const pending = sessions.find(s => !isDoneOn(workouts, date, s.type))
    const session = pending ?? sessions[0]
    return { session, date, daysAhead: i, doneToday: !pending }
  }
  return null
}

/** Sessões previstas para um dia específico. */
export function sessionsOn(plan: PlannedSession[], date: string): PlannedSession[] {
  return plan.filter(s => s.weekday === weekdayOf(date))
}

// ── Aderência ─────────────────────────────────────────────────────────────────

export interface DayAdherence {
  date: string
  weekday: Weekday
  planned: PlannedSession[]
  /** Treinos registrados no dia. */
  done: ManualWorkout[]
  /** Quantas sessões previstas foram cumpridas (casadas por tipo). */
  matched: number
  /** Dia ainda no futuro — não conta como falha. */
  future: boolean
}

export interface WeekAdherence {
  days: DayAdherence[]
  plannedCount: number
  matchedCount: number
  /** Treinos feitos que não estavam no plano. */
  extraCount: number
  /** Percentual do plano cumprido até aqui, ignorando dias futuros. */
  pct: number
  /** Sessões já vencidas e não cumpridas. */
  missed: PlannedSession[]
}

/**
 * Compara plano e execução na semana de `anyDay`. O casamento é por TIPO de
 * atividade, não por nome: quem planejou "Corrida" e registrou "Corrida no
 * parque" cumpriu o plano. Dias futuros ficam de fora da conta — cobrar hoje
 * um treino de sábado não faria sentido.
 */
export function weekAdherence(
  plan: PlannedSession[],
  workouts: ManualWorkout[],
  anyDay: string = todayKey(),
  today: string = todayKey(),
): WeekAdherence {
  const days: DayAdherence[] = weekDates(anyDay).map(date => {
    const planned = sessionsOn(plan, date)
    const done = workouts.filter(w => w.rawDate === date)

    // Cada treino registrado cumpre no máximo uma sessão prevista.
    const available = [...done]
    let matched = 0
    for (const session of planned) {
      const idx = available.findIndex(w => w.type === session.type)
      if (idx >= 0) { available.splice(idx, 1); matched++ }
    }

    return { date, weekday: weekdayOf(date), planned, done, matched, future: date > today }
  })

  const past = days.filter(d => !d.future)
  const plannedCount = past.reduce((s, d) => s + d.planned.length, 0)
  const matchedCount = past.reduce((s, d) => s + d.matched, 0)
  const extraCount = days.reduce((s, d) => s + Math.max(0, d.done.length - d.matched), 0)

  const missed: PlannedSession[] = []
  for (const d of past) {
    // As primeiras `matched` sessões do dia contam como cumpridas; o resto falhou.
    missed.push(...d.planned.slice(d.matched))
  }

  return {
    days,
    plannedCount,
    matchedCount,
    extraCount,
    pct: plannedCount > 0 ? Math.round((matchedCount / plannedCount) * 100) : 0,
    missed,
  }
}

/** Carga semanal prevista pelo plano, em minutos — serve de referência ao ACWR. */
export function plannedMinutes(plan: PlannedSession[]): number {
  return plan.reduce((s, p) => s + p.durationMin, 0)
}
