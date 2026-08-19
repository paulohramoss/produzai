import type { ManualWorkout } from '../store/useWorkoutStore'
import { toLocalISO } from './date'
import challengeDef from '../../challenge.json'

// Desafio com data para acabar.
//
// O ranking geral do app não tem começo nem fim: quem entrou primeiro está na
// frente para sempre e não há motivo para o novato disputar. O desafio resolve
// isso com uma janela fechada — todo mundo começa em zero no mesmo dia, e no
// último dia alguém ganha alguma coisa.
//
// ── Quem manda no placar ─────────────────────────────────────────────────────
// O número oficial é do SERVIDOR (api/challenge/sync.js). Este módulo calcula a
// mesma coisa localmente, mas só para a tela ter o que mostrar offline e para
// dizer "isso aqui ainda não foi confirmado". Nada do que é calculado aqui
// chega ao placar: o cliente não tem permissão de escrever em `challenges/`.
//
// A definição vive em challenge.json, na raiz do pacote, porque o servidor lê o
// MESMO arquivo. Trocar de desafio é editar um lugar só.

export interface ChallengeDef {
  /** Identificador estável — vira a chave do placar no Firestore. */
  id: string
  name: string
  /** Uma frase de venda, usada na landing e no card. */
  pitch: string
  /** O que o vencedor leva. Aparece no app inteiro. */
  prize: string
  /** Quem banca o prêmio. Vazio quando não há parceiro. */
  partner?: string
  /** Primeiro dia válido, "YYYY-MM-DD" no fuso local. */
  startDate: string
  /** Último dia válido, inclusive. */
  endDate: string
  /** Quantos dias de treino fecham o desafio. */
  goalDays: number
}

export const ACTIVE_CHALLENGE: ChallengeDef = {
  id:        challengeDef.id,
  name:      challengeDef.name,
  pitch:     challengeDef.pitch,
  prize:     challengeDef.prize,
  partner:   challengeDef.partner || undefined,
  startDate: challengeDef.startDate,
  endDate:   challengeDef.endDate,
  goalDays:  challengeDef.goalDays,
}

export type ChallengeState = 'upcoming' | 'running' | 'ended'

export interface ChallengeWindow {
  state: ChallengeState
  /** Dias que faltam para começar (upcoming) ou para acabar (running). */
  daysLeft: number
  /** Dias já decorridos desde o início, mínimo 0, limitado ao total. */
  daysElapsed: number
  /** Duração total da janela, em dias. */
  totalDays: number
}

/** Meia-noite local do dia "YYYY-MM-DD". */
function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

export function challengeWindow(def: ChallengeDef, now = new Date()): ChallengeWindow {
  const today = parseDay(toLocalISO(now))
  const start = parseDay(def.startDate)
  const end = parseDay(def.endDate)
  const totalDays = daysBetween(start, end) + 1

  if (today < start) {
    return { state: 'upcoming', daysLeft: daysBetween(today, start), daysElapsed: 0, totalDays }
  }
  if (today > end) {
    return { state: 'ended', daysLeft: 0, daysElapsed: totalDays, totalDays }
  }
  return {
    state: 'running',
    daysLeft: daysBetween(today, end) + 1,
    daysElapsed: daysBetween(start, today) + 1,
    totalDays,
  }
}

export interface ChallengeProgress {
  /** Dias distintos com pelo menos um treino dentro da janela. */
  daysDone: number
  /** Data do último treino que contou, "YYYY-MM-DD" — vazio se nenhum. */
  lastDay: string
  /** 0–100. */
  pct: number
  /** Fechou a meta. */
  completed: boolean
  /** Os dias em si — usados para comparar com o que o servidor confirmou. */
  days: string[]
}

/**
 * Estimativa local do progresso: dias distintos treinados dentro da janela.
 *
 * Conta DIAS, não treinos — treinar seis vezes no domingo não compra a semana,
 * que é justamente o hábito que o desafio quer construir.
 *
 * ISTO NÃO É O PLACAR. É o que a tela mostra enquanto o servidor não responde,
 * e a base do aviso "treino de hoje ainda não confirmado".
 */
export function challengeProgress(
  def: ChallengeDef,
  workouts: ManualWorkout[],
): ChallengeProgress {
  const days = new Set<string>()
  for (const w of workouts) {
    if (w.rawDate >= def.startDate && w.rawDate <= def.endDate) days.add(w.rawDate)
  }
  const sorted = [...days].sort()
  const daysDone = Math.min(sorted.length, def.goalDays)
  return {
    daysDone,
    lastDay: sorted[sorted.length - 1] ?? '',
    pct: Math.round((daysDone / def.goalDays) * 100),
    completed: daysDone >= def.goalDays,
    days: sorted,
  }
}

/** Texto curto de status, para card e landing. */
export function challengeStatusLabel(w: ChallengeWindow): string {
  if (w.state === 'upcoming') {
    return w.daysLeft === 1 ? 'Começa amanhã' : `Começa em ${w.daysLeft} dias`
  }
  if (w.state === 'ended') return 'Encerrado'
  return w.daysLeft === 1 ? 'Último dia' : `Faltam ${w.daysLeft} dias`
}
