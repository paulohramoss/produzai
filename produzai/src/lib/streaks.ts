// Sequências de hábito — com meta semanal e folga.
//
// O modelo antigo era binário-diário: quem planeja treinar 4x por semana levava
// "falha" nos três dias de descanso legítimos. Aqui cada hábito declara quantas
// vezes por semana ele vale (`targetPerWeek`):
//
//   • 7 (padrão)  → hábito diário, sequência contada em DIAS
//   • 1 a 6       → hábito de frequência, sequência contada em SEMANAS cumpridas
//
// E toda sequência diária tem UMA folga por semana: um dia perdido não zera o
// progresso de semanas, desde que a folga daquela semana ainda esteja livre.

import type { DailyData, HabitDef } from './db'
import { toLocalISO, todayKey } from './date'
import { getWeekKey } from './xp'

export const DEFAULT_TARGET_PER_WEEK = 7

export function targetOf(def: Pick<HabitDef, 'targetPerWeek'>): number {
  const t = def.targetPerWeek
  if (typeof t !== 'number' || !Number.isFinite(t)) return DEFAULT_TARGET_PER_WEEK
  return Math.max(1, Math.min(7, Math.round(t)))
}

export function isDaily(def: Pick<HabitDef, 'targetPerWeek'>): boolean {
  return targetOf(def) >= 7
}

// ── Utilidades de calendário ──────────────────────────────────────────────────

function dateOf(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function shift(key: string, days: number): string {
  const d = dateOf(key)
  d.setDate(d.getDate() + days)
  return toLocalISO(d)
}

/** Segunda-feira da semana de `key`. */
function mondayOf(key: string): string {
  const d = dateOf(key)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return toLocalISO(d)
}

function doneOn(history: Record<string, DailyData>, date: string, habitId: string): boolean | null {
  const day = history[date]
  if (!day?.habits) return null            // dia sem registro — fim do histórico, não é falha
  const h = day.habits.find(x => x.id === habitId)
  return h ? h.done : null                 // hábito ainda não existia nesse dia
}

// ── Sequência de um hábito ────────────────────────────────────────────────────

export interface HabitStreak {
  habitId: string
  /** Tamanho da sequência atual. */
  count: number
  unit: 'dias' | 'semanas'
  /** Se a folga da semana corrente já foi gasta para segurar a sequência. */
  freezeUsed: boolean
  /** Progresso da semana atual: quantas vezes feito e quantas a meta pede. */
  weekDone: number
  weekTarget: number
  /** Se a meta da semana já foi batida. */
  weekMet: boolean
}

/**
 * Sequência DIÁRIA: anda para trás dia a dia. Um dia sem registro nenhum encerra
 * a contagem (não sabemos o que houve, então não punimos); um dia registrado e
 * não feito consome a folga da semana, e o segundo da mesma semana quebra.
 */
function dailyStreak(habitId: string, history: Record<string, DailyData>, from: string): { count: number; freezeUsed: boolean } {
  const usedFreeze = new Set<string>()
  let cursor = from
  let count = 0

  // Hoje ainda em aberto não conta como falha: se não foi feito, começa por ontem.
  if (doneOn(history, cursor, habitId) !== true) cursor = shift(cursor, -1)

  for (;;) {
    const state = doneOn(history, cursor, habitId)
    if (state === null) break              // fim do histórico
    if (state) {
      count++
    } else {
      const week = getWeekKey(dateOf(cursor))
      if (usedFreeze.has(week)) break      // folga da semana já gasta
      usedFreeze.add(week)                 // folga desta semana segura a sequência
    }
    cursor = shift(cursor, -1)
  }

  return { count, freezeUsed: usedFreeze.has(getWeekKey(dateOf(from))) }
}

/** Quantas vezes o hábito foi cumprido na semana que contém `anyDay`. */
function doneInWeek(habitId: string, history: Record<string, DailyData>, anyDay: string): { done: number; recorded: number } {
  const monday = mondayOf(anyDay)
  let done = 0
  let recorded = 0
  for (let i = 0; i < 7; i++) {
    const state = doneOn(history, shift(monday, i), habitId)
    if (state === null) continue
    recorded++
    if (state) done++
  }
  return { done, recorded }
}

/**
 * Sequência SEMANAL: conta semanas fechadas em que a meta foi cumprida. A semana
 * corrente entra na conta assim que a meta é batida — bater 4/4 na quarta já
 * soma, não precisa esperar o domingo.
 */
function weeklyStreak(habitId: string, history: Record<string, DailyData>, from: string, target: number): number {
  let count = 0
  let cursor = from

  // Semana corrente: só soma se a meta já foi atingida.
  if (doneInWeek(habitId, history, cursor).done >= target) count++
  cursor = shift(mondayOf(cursor), -1)     // domingo da semana anterior

  for (;;) {
    const { done, recorded } = doneInWeek(habitId, history, cursor)
    if (recorded === 0) break              // semana sem nenhum registro — fim do histórico
    if (done < target) break
    count++
    cursor = shift(mondayOf(cursor), -1)
  }

  return count
}

export function computeHabitStreak(
  def: HabitDef,
  history: Record<string, DailyData>,
  from: string = todayKey(),
): HabitStreak {
  const target = targetOf(def)
  const week = doneInWeek(def.id, history, from)

  if (target >= 7) {
    const { count, freezeUsed } = dailyStreak(def.id, history, from)
    return {
      habitId: def.id,
      count,
      unit: 'dias',
      freezeUsed,
      weekDone: week.done,
      weekTarget: 7,
      weekMet: week.done >= 7,
    }
  }

  return {
    habitId: def.id,
    count: weeklyStreak(def.id, history, from, target),
    unit: 'semanas',
    freezeUsed: false,
    weekDone: week.done,
    weekTarget: target,
    weekMet: week.done >= target,
  }
}

// ── Sequência do dia (visão geral) ────────────────────────────────────────────

export interface DayStreak {
  count: number
  freezeUsed: boolean
  /** Se o dia de hoje já está fechado (todos os hábitos do dia cumpridos). */
  todayComplete: boolean
}

/**
 * Um dia está "fechado" quando todo hábito DIÁRIO foi cumprido. Hábitos de
 * frequência (3x, 4x por semana) não entram: eles são cobrados na semana, não no
 * dia — é exatamente o que impedia o atleta de manter sequência em dia de folga.
 */
function dayComplete(defs: HabitDef[], history: Record<string, DailyData>, date: string): boolean | null {
  const day = history[date]
  if (!day?.habits) return null

  const daily = defs.filter(isDaily)
  if (daily.length === 0) return null

  let known = 0
  for (const def of daily) {
    const state = doneOn(history, date, def.id)
    if (state === null) continue           // hábito não existia nesse dia
    known++
    if (!state) return false
  }
  return known > 0 ? true : null
}

export function computeDayStreak(
  defs: HabitDef[],
  history: Record<string, DailyData>,
  from: string = todayKey(),
): DayStreak {
  const usedFreeze = new Set<string>()
  const todayComplete = dayComplete(defs, history, from) === true

  let cursor = todayComplete ? from : shift(from, -1)
  let count = 0

  for (;;) {
    const state = dayComplete(defs, history, cursor)
    if (state === null) break
    if (state) {
      count++
    } else {
      const week = getWeekKey(dateOf(cursor))
      if (usedFreeze.has(week)) break
      usedFreeze.add(week)
    }
    cursor = shift(cursor, -1)
  }

  return { count, freezeUsed: usedFreeze.has(getWeekKey(dateOf(from))), todayComplete }
}

// ── Pendências do dia ─────────────────────────────────────────────────────────

/**
 * Um hábito de frequência só é "pendente" hoje se a meta da semana ainda não foi
 * batida E ainda dá para batê-la — assim o dia de descanso planejado não aparece
 * como falha na tela.
 */
export function isPendingToday(def: HabitDef, streak: HabitStreak, date: string = todayKey()): boolean {
  if (isDaily(def)) return true
  if (streak.weekMet) return false
  const daysLeftInWeek = 7 - ((dateOf(date).getDay() || 7) - 1)
  return streak.weekTarget - streak.weekDone <= daysLeftInWeek
}

/**
 * Quais hábitos são realmente cobrados em `date`. Hábito de frequência com a
 * meta da semana já batida (ou impossível de bater) fica de fora — é o que
 * impede o dia de descanso planejado de derrubar o score do dia.
 */
export function pendingIdsFor(
  defs: HabitDef[],
  history: Record<string, DailyData>,
  date: string = todayKey(),
): Set<string> {
  const ids = new Set<string>()
  for (const def of defs) {
    if (isPendingToday(def, computeHabitStreak(def, history, date), date)) ids.add(def.id)
  }
  return ids
}
