// Agendamento de lembretes no cliente.
//
// O que havia era um único lembrete diário em hora fixa. Aqui existem quatro
// tipos, e três deles só disparam se ainda fizerem sentido no momento do toque:
//
//   • manhã       — abre o dia
//   • por hábito  — no horário em que aquele hábito acontece, e só se estiver pendente
//   • nudge       — fim da noite, só se o dia não foi registrado
//   • streak      — só se a sequência está viva e o dia ainda não fechou
//
// Enquanto o app está aberto, os disparos saem daqui. Com o app fechado, quem
// avisa é o Web Push (api/push/cron.js) usando as mesmas preferências, salvas
// no Firestore.

import type { ReminderPrefs } from './db'
import { show } from './notifications'

export type ReminderKind = 'morning' | 'habit' | 'nudge' | 'streak'

export interface ScheduledReminder {
  kind: ReminderKind
  /** Minutos desde a meia-noite local. */
  atMinutes: number
  title: string
  body: string
  /** Só para lembretes de hábito. */
  habitId?: string
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: false,
  morning: '08:00',
  eveningNudge: '21:00',
  streakAlert: '21:30',
  habitTimes: {},
}

// ── Horários ──────────────────────────────────────────────────────────────────

/** "HH:MM" → minutos desde a meia-noite. Null se o formato não bater. */
export function parseTime(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null
  const [h, m] = value.split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function minutesNow(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

// ── Montagem da agenda ────────────────────────────────────────────────────────

export interface HabitReminderInfo {
  id: string
  icon: string
  label: string
}

/** Todos os lembretes do dia, em ordem de horário. */
export function buildSchedule(prefs: ReminderPrefs, habits: HabitReminderInfo[]): ScheduledReminder[] {
  if (!prefs.enabled) return []
  const out: ScheduledReminder[] = []

  const morning = parseTime(prefs.morning)
  if (morning !== null) {
    out.push({
      kind: 'morning', atMinutes: morning,
      title: '⚡ Bom dia',
      body: 'Marque sua prontidão e veja o treino de hoje.',
    })
  }

  for (const habit of habits) {
    const at = parseTime(prefs.habitTimes[habit.id])
    if (at === null) continue
    out.push({
      kind: 'habit', atMinutes: at, habitId: habit.id,
      title: `${habit.icon} ${habit.label}`,
      body: 'Hora do seu hábito — leva um toque para marcar.',
    })
  }

  const nudge = parseTime(prefs.eveningNudge)
  if (nudge !== null) {
    out.push({
      kind: 'nudge', atMinutes: nudge,
      title: '🌙 Fecha o dia?',
      body: 'Você ainda não registrou nada hoje. Um minuto resolve.',
    })
  }

  const streak = parseTime(prefs.streakAlert)
  if (streak !== null) {
    out.push({
      kind: 'streak', atMinutes: streak,
      title: '🔥 Sua sequência está em risco',
      body: 'Faltam hábitos para fechar o dia e manter a sequência viva.',
    })
  }

  return out.sort((a, b) => a.atMinutes - b.atMinutes)
}

// ── Estado do dia ─────────────────────────────────────────────────────────────

/** O que o agendador precisa saber para decidir se um lembrete ainda faz sentido. */
export interface DayState {
  /** Ids dos hábitos ainda pendentes hoje. */
  pendingHabitIds: string[]
  /** Se houve qualquer registro hoje (hábito, foco, prontidão, treino). */
  anythingLogged: boolean
  /** Sequência de dias atual. */
  streakDays: number
  /** Se o dia já está fechado. */
  dayComplete: boolean
}

/**
 * Um lembrete só toca se ainda for útil. Avisar "marque seu hábito" depois de
 * marcado, ou "sua sequência está em risco" para quem não tem sequência, é o
 * tipo de ruído que faz o usuário desligar as notificações de vez.
 */
export function shouldFire(reminder: ScheduledReminder, state: DayState): boolean {
  switch (reminder.kind) {
    case 'morning':
      return true
    case 'habit':
      return reminder.habitId ? state.pendingHabitIds.includes(reminder.habitId) : false
    case 'nudge':
      return !state.anythingLogged
    case 'streak':
      return state.streakDays > 0 && !state.dayComplete
  }
}

/** Texto do alerta de sequência, com o número real de dias em jogo. */
export function streakBody(streakDays: number): string {
  return `Você está há ${streakDays} ${streakDays === 1 ? 'dia' : 'dias'} sem falhar. Feche os hábitos de hoje para não zerar.`
}

// ── Agendador ─────────────────────────────────────────────────────────────────

const FIRED_KEY = 'reminders_fired'

/** Marca do que já tocou hoje, para não repetir a cada re-render ou reabertura. */
function firedToday(dateKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { date: string; keys: string[] }
    return parsed.date === dateKey ? new Set(parsed.keys) : new Set()
  } catch {
    return new Set()
  }
}

function markFired(dateKey: string, key: string) {
  const keys = firedToday(dateKey)
  keys.add(key)
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date: dateKey, keys: [...keys] }))
  } catch { /* silent */ }
}

function reminderKey(r: ScheduledReminder): string {
  return `${r.kind}:${r.habitId ?? ''}:${r.atMinutes}`
}

export interface SchedulerOptions {
  schedule: ScheduledReminder[]
  /** Consultado no momento do disparo — o estado do dia muda enquanto o app está aberto. */
  getState: () => DayState
  todayKey: string
}

/**
 * Dispara o que está vencido e ainda é útil.
 *
 * Roda por varredura (a cada minuto) em vez de um setTimeout por lembrete: o
 * navegador estrangula timers longos em aba de fundo, e a varredura recupera
 * sozinha o horário perdido quando a aba volta ao primeiro plano. Um lembrete
 * atrasado mais de uma hora é descartado — avisar do hábito das 7h às 14h só
 * incomoda.
 */
const MAX_LATE_MINUTES = 60

export function runDueReminders(opts: SchedulerOptions, now: Date = new Date()): ScheduledReminder[] {
  const current = minutesNow(now)
  const fired = firedToday(opts.todayKey)
  const sent: ScheduledReminder[] = []

  for (const reminder of opts.schedule) {
    const key = reminderKey(reminder)
    if (fired.has(key)) continue
    if (reminder.atMinutes > current) continue
    if (current - reminder.atMinutes > MAX_LATE_MINUTES) {
      markFired(opts.todayKey, key)   // passou da hora: registra e não avisa
      continue
    }

    const state = opts.getState()
    if (!shouldFire(reminder, state)) {
      // Ainda pode virar útil hoje (hábito pode ser desmarcado), mas não
      // insistimos: marcamos como resolvido para não repetir a cada varredura.
      markFired(opts.todayKey, key)
      continue
    }

    const body = reminder.kind === 'streak' ? streakBody(state.streakDays) : reminder.body
    show(reminder.title, body)
    markFired(opts.todayKey, key)
    sent.push(reminder)
  }

  return sent
}

/** Intervalo da varredura. Um minuto é fino o bastante e barato. */
export const SCAN_INTERVAL_MS = 60_000
