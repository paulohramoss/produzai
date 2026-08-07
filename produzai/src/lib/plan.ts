// Plano de treino adaptativo de 14 dias.
//
// A IA gera o plano UMA vez, a partir do objetivo, do condicionamento atual e
// da disponibilidade. Depois disso quem manda são as regras locais deste
// arquivo: elas reconciliam o plano com o que foi de fato treinado e rebaixam,
// movem ou trocam sessões quando a fadiga, a prontidão ou a carga mandam.
//
// Essa divisão é de propósito — plano que só se ajusta quando o usuário abre o
// chat não é adaptativo, é um PDF com passos extras.

import type { ManualWorkout } from '../store/useWorkoutStore'
import type { AcwrResult } from './trainingLoad'
import { parseDurationToMinutes } from './performance'
import { trainingPaces, type TrainingPace } from './fitness'

export type SessionKind = 'easy' | 'long' | 'quality' | 'strength' | 'rest' | 'race'
export type SessionStatus = 'planned' | 'done' | 'missed' | 'adjusted'
export type PaceKey = TrainingPace['key']

export interface PlanSession {
  id: string
  /** "YYYY-MM-DD" */
  date: string
  kind: SessionKind
  title: string
  /** O que fazer, concreto: aquecimento, blocos, recuperação. */
  description: string
  targetMin: number
  targetKm?: number
  targetPaceKey?: PaceKey
  /** Por que essa sessão existe neste dia — o que ela treina. */
  why: string
  status: SessionStatus
  completedWorkoutId?: string
  /** Preenchido quando as regras locais mexeram na sessão. */
  adjustmentNote?: string
}

export interface PlanAdaptation {
  at: number
  date: string
  text: string
}

export interface TrainingPlan {
  generatedAt: number
  startDate: string
  goal: string
  raceDate?: string
  raceDistanceKm?: number
  /** Frase que resume a intenção do bloco de 14 dias. */
  focus: string
  sessions: PlanSession[]
  adaptations: PlanAdaptation[]
}

export const SESSION_META: Record<SessionKind, { label: string; color: string; icon: string }> = {
  easy:     { label: 'Rodagem fácil', color: '#22C55E', icon: '🏃' },
  long:     { label: 'Longo',         color: '#60A5FA', icon: '🛣️' },
  quality:  { label: 'Qualidade',     color: '#F472B6', icon: '⚡' },
  strength: { label: 'Força',         color: '#A78BFA', icon: '🏋️' },
  rest:     { label: 'Descanso',      color: '#666666', icon: '😴' },
  race:     { label: 'Prova',         color: '#F97316', icon: '🏁' },
}

const DAY_MS = 24 * 60 * 60 * 1000

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / DAY_MS)
}

export function todayKey(): string {
  return isoDate(new Date())
}

/** Um plano cujo último dia já passou não serve mais para nada. */
export function isPlanExpired(plan: TrainingPlan | null, today = todayKey()): boolean {
  if (!plan || plan.sessions.length === 0) return true
  const last = plan.sessions.reduce((max, s) => (s.date > max ? s.date : max), plan.sessions[0].date)
  return today > last
}

export function sessionsForDate(plan: TrainingPlan | null, date: string): PlanSession[] {
  return plan?.sessions.filter(s => s.date === date) ?? []
}

// ── Adaptação local ──────────────────────────────────────────────────────────

export interface AdaptContext {
  workouts: ManualWorkout[]
  /** TSB do dia. */
  form: number | null
  acwr: AcwrResult | null
  /** Prontidão de hoje (0-100), quando houver sinais suficientes. */
  readiness: number | null
  today?: string
}

export interface AdaptResult {
  plan: TrainingPlan
  /** Mudanças aplicadas agora — para avisar o usuário. */
  changes: string[]
}

/**
 * Reconcilia o plano com a realidade e ajusta o que vem pela frente.
 * Determinística e idempotente: rodar duas vezes no mesmo dia não duplica nada.
 */
export function adaptPlan(plan: TrainingPlan, ctx: AdaptContext): AdaptResult {
  const today = ctx.today ?? todayKey()
  const changes: string[] = []
  const sessions = plan.sessions.map(s => ({ ...s }))

  // ── 1. O que já passou: foi feito ou foi perdido? ──────────────────────────
  const workoutsByDate = new Map<string, ManualWorkout[]>()
  for (const w of ctx.workouts) {
    const list = workoutsByDate.get(w.rawDate) ?? []
    list.push(w)
    workoutsByDate.set(w.rawDate, list)
  }

  for (const s of sessions) {
    if (s.date >= today || s.kind === 'rest') continue
    if (s.status === 'done' || s.status === 'missed') continue

    const candidates = workoutsByDate.get(s.date) ?? []
    // Metade do tempo previsto já conta como cumprido — o plano serve ao
    // atleta, não o contrário.
    const match = candidates.find(w => (parseDurationToMinutes(w.time) ?? 0) >= s.targetMin * 0.5)

    if (match) {
      s.status = 'done'
      s.completedWorkoutId = match.id
    } else {
      s.status = 'missed'
    }
  }

  const upcoming = sessions.filter(s => s.date >= today && s.status === 'planned')

  // ── 2. Carga subindo rápido demais ────────────────────────────────────────
  // O filtro por `adjustmentNote` é o que impede o plano de ser achatado um
  // pouco mais a cada vez que a página é aberta: sessão já ajustada não é
  // rebaixada de novo.
  if (ctx.acwr?.status === 'risco') {
    const nextHard = upcoming.find(s => (s.kind === 'quality' || s.kind === 'long') && !s.adjustmentNote)
    if (nextHard) {
      const originalLabel = SESSION_META[nextHard.kind].label
      downgrade(nextHard, 'Carga aguda muito acima da sua base (ACWR alto) — sessão rebaixada para proteger de sobrecarga.')
      changes.push(`${originalLabel} de ${friendlyDay(nextHard.date, today)} virou rodagem fácil: sua carga subiu rápido demais.`)
    }
  }

  // ── 3. Fadiga acumulada acima do que o condicionamento sustenta ────────────
  if (ctx.form !== null && ctx.form < -30) {
    const nextHard = upcoming.find(s => (s.kind === 'quality' || s.kind === 'long') && !s.adjustmentNote)
    if (nextHard) {
      const originalLabel = SESSION_META[nextHard.kind].label.toLowerCase()
      downgrade(nextHard, 'Forma muito negativa: fadiga acima do que sua base sustenta. Trocado por sessão leve.')
      changes.push(`Fadiga acumulada alta — troquei ${originalLabel} de ${friendlyDay(nextHard.date, today)} por rodagem leve.`)
    }
  }

  // ── 4. Prontidão baixa hoje ───────────────────────────────────────────────
  if (ctx.readiness !== null && ctx.readiness < 40) {
    for (const s of sessions) {
      if (s.date !== today || s.status !== 'planned') continue
      if (s.kind !== 'quality' && s.kind !== 'long') continue
      downgrade(s, 'Prontidão baixa hoje (sono, humor ou recuperação abaixo do normal).')
      changes.push('Sua prontidão hoje está baixa — a sessão forte virou rodagem fácil. O ganho de hoje está na recuperação.')
    }
  }

  // ── 5. Longo perdido: remarcar em vez de simplesmente sumir ────────────────
  // `adjustmentNote` marca o longo perdido como já tratado — sem isso ele seria
  // remarcado de novo a cada visita, espalhando cópias pelo resto do bloco.
  const recentMissedLong = sessions.find(s =>
    s.kind === 'long' && s.status === 'missed' && !s.adjustmentNote && daysBetween(s.date, today) <= 3,
  )
  if (recentMissedLong) {
    const slot = upcoming.find(s =>
      (s.kind === 'easy' || s.kind === 'rest') && !s.adjustmentNote
      && daysBetween(today, s.date) >= 1 && daysBetween(today, s.date) <= 4,
    )
    if (slot) {
      recentMissedLong.adjustmentNote = `Remarcado para ${friendlyDay(slot.date, today)}.`
      slot.kind = 'long'
      slot.title = recentMissedLong.title
      slot.description = recentMissedLong.description
      slot.targetMin = recentMissedLong.targetMin
      slot.targetKm = recentMissedLong.targetKm
      slot.targetPaceKey = recentMissedLong.targetPaceKey
      slot.why = recentMissedLong.why
      slot.status = 'adjusted'
      slot.adjustmentNote = `Longo remarcado de ${friendlyDay(recentMissedLong.date, today)}.`
      changes.push(`Seu longo de ${friendlyDay(recentMissedLong.date, today)} não aconteceu — remarquei para ${friendlyDay(slot.date, today)}.`)
    }
  }

  // ── 6. Polimento na semana de prova ───────────────────────────────────────
  if (plan.raceDate) {
    for (const s of upcoming) {
      const toRace = daysBetween(s.date, plan.raceDate)
      if (toRace < 0 || toRace > 7 || s.kind === 'race' || s.adjustmentNote) continue
      if (s.kind === 'long' || s.kind === 'quality') {
        const reduced = Math.max(20, Math.round(s.targetMin * 0.6))
        s.targetMin = reduced
        if (s.targetKm) s.targetKm = Math.round(s.targetKm * 0.6 * 10) / 10
        s.status = 'adjusted'
        s.adjustmentNote = 'Volume reduzido: semana de polimento antes da prova.'
      }
    }
  }

  const adaptations = [...plan.adaptations]
  for (const text of changes) {
    // Não registra a mesma adaptação duas vezes no mesmo dia.
    if (!adaptations.some(a => a.date === today && a.text === text)) {
      adaptations.push({ at: Date.now(), date: today, text })
    }
  }

  return {
    plan: { ...plan, sessions, adaptations: adaptations.slice(-30) },
    changes,
  }
}

function downgrade(s: PlanSession, note: string) {
  s.kind = 'easy'
  s.title = 'Rodagem fácil'
  s.description = 'Corrida leve e confortável, conversando sem esforço. Sem tiros, sem forçar o ritmo.'
  s.targetMin = Math.max(20, Math.round(s.targetMin * 0.6))
  if (s.targetKm) s.targetKm = Math.round(s.targetKm * 0.6 * 10) / 10
  s.targetPaceKey = 'easy'
  s.status = 'adjusted'
  s.adjustmentNote = note
}

function friendlyDay(date: string, today: string): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff === -1) return 'ontem'
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  return `${days[dt.getDay()]} (${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')})`
}

// ── Progresso ────────────────────────────────────────────────────────────────

export interface PlanProgress {
  done: number
  missed: number
  planned: number
  total: number
  adherencePct: number
}

export function planProgress(plan: TrainingPlan): PlanProgress {
  const real = plan.sessions.filter(s => s.kind !== 'rest')
  const done = real.filter(s => s.status === 'done').length
  const missed = real.filter(s => s.status === 'missed').length
  const planned = real.filter(s => s.status === 'planned' || s.status === 'adjusted').length
  const settled = done + missed
  return {
    done,
    missed,
    planned,
    total: real.length,
    adherencePct: settled > 0 ? Math.round((done / settled) * 100) : 0,
  }
}

// ── Texto para prompts ───────────────────────────────────────────────────────

/** Resolve os ritmos alvo em min/km reais, para exibir e para o Coach citar. */
export function resolvePace(session: PlanSession, vdot: number | null): string | null {
  if (!session.targetPaceKey || vdot === null) return null
  const pace = trainingPaces(vdot).find(p => p.key === session.targetPaceKey)
  return pace?.formatted ?? null
}

export function describePlanForAI(plan: TrainingPlan | null, today = todayKey()): string {
  if (!plan) return 'O usuário ainda não tem plano de treino gerado.'

  const upcoming = plan.sessions
    .filter(s => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7)

  const progress = planProgress(plan)
  const lines = [
    `Plano ativo: ${plan.focus}`,
    `Objetivo: ${plan.goal}${plan.raceDate ? ` · prova em ${plan.raceDate}${plan.raceDistanceKm ? ` (${plan.raceDistanceKm}km)` : ''}` : ''}`,
    `Aderência: ${progress.done} sessões feitas, ${progress.missed} perdidas (${progress.adherencePct}%)`,
  ]

  if (upcoming.length > 0) {
    lines.push('Próximas sessões:')
    for (const s of upcoming) {
      const parts = [`  • ${s.date} — ${SESSION_META[s.kind].label}: ${s.title} (${s.targetMin}min${s.targetKm ? `, ${s.targetKm}km` : ''})`]
      if (s.adjustmentNote) parts.push(` [ajustado: ${s.adjustmentNote}]`)
      lines.push(parts.join(''))
    }
  }

  const recent = plan.adaptations.slice(-3)
  if (recent.length > 0) {
    lines.push('Ajustes recentes do plano:')
    for (const a of recent) lines.push(`  • ${a.text}`)
  }

  return lines.join('\n')
}
