// All AI calls go through /api/ai/* Vercel functions.
// The Anthropic API key and proprietary coaching knowledge live server-side only.

import { auth } from './firebase'
import { readCoachStream, type ChatToolUse } from './coachStream'
import type { ManualWorkout } from '../store/useWorkoutStore'
import type { WebDietData } from '../store/useWebDietStore'
import type { HabitDef } from '../store/useHabitsStore'

// Always true — the API key is on the server, not in this bundle.
export function hasApiKey(): boolean {
  return true
}

export interface ChatAttachment {
  name: string
  mediaType: string
  data: string // base64, no "data:" prefix
}

export type { ChatToolUse } from './coachStream'

export interface ChatToolResult {
  id: string
  content: string
  isError?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachment?: ChatAttachment
  /** Presente no turno do assistente que pediu ferramentas. */
  toolUses?: ChatToolUse[]
  /** Presente no turno de usuário que devolve o resultado delas. */
  toolResults?: ChatToolResult[]
}

export interface CoachContext {
  type: 'coach'
  workouts: ManualWorkout[]
  weekWorkouts: ManualWorkout[]
  wd: WebDietData | null
  habitDefs: HabitDef[]
  userName?: string
}

export interface OnboardingContext {
  type: 'onboarding'
  userName?: string
}

export type StreamContext = CoachContext | OnboardingContext

async function getAuthToken(): Promise<string | null> {
  try {
    return (await auth.currentUser?.getIdToken()) ?? null
  } catch {
    return null
  }
}

function bearerHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Streaming coach ───────────────────────────────────────────────────────────

export async function streamCoach(
  messages: ChatMessage[],
  context: StreamContext,
  onChunk: (text: string) => void,
  onDone: (toolUses: ChatToolUse[]) => void,
  onError: (err: string) => void,
): Promise<void> {
  try {
    const token = await getAuthToken()
    const res = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...bearerHeader(token),
      },
      body: JSON.stringify({ messages, context }),
    })

    if (!res.ok) {
      let msg = `Erro HTTP ${res.status}`
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error) msg = body.error
      } catch { /* noop */ }
      onError(msg)
      return
    }

    const toolUses = await readCoachStream(res.body!, onChunk, onError)
    if (toolUses === null) return // erro já reportado

    onDone(toolUses)
  } catch (e) {
    onError((e as Error).message ?? 'Erro desconhecido')
  }
}

// ── Generic completion helper ─────────────────────────────────────────────────

async function callCompletion<T>(type: string, payload: unknown): Promise<T | null> {
  try {
    const token = await getAuthToken()
    const res = await fetch('/api/ai/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...bearerHeader(token),
      },
      body: JSON.stringify({ type, payload }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { result?: T }
    return body.result ?? null
  } catch {
    return null
  }
}

// ── Workout parsing from spoken description ───────────────────────────────────

export interface ParsedWorkout {
  type: string
  name: string
  durationMin: number
  dist: number
  effort: 1 | 2 | 3 | 4 | 5
  hr: number
}

export async function parseWorkoutFromSpeech(transcript: string): Promise<ParsedWorkout | null> {
  if (!transcript.trim()) return null
  return callCompletion('parse-workout', { transcript })
}

/** Print do relógio, painel da esteira ou tela do app — mesmo extrator, entrada visual. */
export async function parseWorkoutFromImage(
  image: { mediaType: string; data: string },
  transcript = '',
): Promise<ParsedWorkout | null> {
  if (!image.data) return null
  return callCompletion('parse-workout', { image, transcript })
}

// ── Macros estimation ─────────────────────────────────────────────────────────

export async function estimateMealMacros(
  items: string[],
): Promise<{ cal: number; prot: number; carb: number; fat: number } | null> {
  if (items.length === 0) return null
  return callCompletion('macros', { items })
}

// ── PDF diet parsing ──────────────────────────────────────────────────────────

export async function parsePdfDiet(pdfBase64: string): Promise<WebDietData | null> {
  return callCompletion('pdf-diet', { pdfBase64 })
}

// ── Onboarding plan generation ────────────────────────────────────────────────

export interface OnboardingPlan {
  summary: string
  goals: string[]
  values: string[]
  habits: Array<{ icon: string; label: string; why: string }>
  focusSuggestion: string
  macros?: { cal: number; prot: number; carb: number; fat: number }
}

export async function generateOnboardingPlan(
  conversation: ChatMessage[],
  userName?: string,
): Promise<OnboardingPlan | null> {
  return callCompletion('onboarding-plan', { conversation, userName })
}

// ── Daily reflection ──────────────────────────────────────────────────────────

const FALLBACK_REFLECTION_QUESTIONS = [
  'O que te deu mais energia hoje, e como você pode ter mais disso amanhã?',
  'Qual foi o momento mais difícil do seu dia — e o que ele te ensinou sobre você?',
  'Se hoje fosse uma nota de 0 a 10, qual seria, e o que faria ela subir 1 ponto?',
  'O que você fez hoje que seu "eu" de daqui a um ano agradeceria?',
  'Teve algum momento hoje em que você se sentiu mais você mesmo? Como foi?',
  'O que você está evitando fazer, e o que isso te custa continuar evitando?',
  'Qual pequena decisão de hoje pode ter um impacto grande se você repetir ela amanhã?',
  'O que hoje te lembrou por que você está construindo esses hábitos?',
  'Se pudesse refazer uma hora do seu dia, qual seria e o que mudaria?',
  'O que está pesando na sua cabeça agora que ainda não foi dito em voz alta?',
  'Você se sentiu mais no controle ou mais reativo hoje? Por quê?',
  'Qual foi a coisa mais gentil que você fez por si mesmo hoje?',
]

export function fallbackReflectionQuestion(seed: number): string {
  const idx =
    ((seed % FALLBACK_REFLECTION_QUESTIONS.length) +
      FALLBACK_REFLECTION_QUESTIONS.length) %
    FALLBACK_REFLECTION_QUESTIONS.length
  return FALLBACK_REFLECTION_QUESTIONS[idx]
}

export async function generateReflectionQuestion(ctx: {
  habitsDone: number
  habitsTotal: number
  focusDone: number
  focusTotal: number
  mood: number
  energy: number
  userName?: string
}): Promise<string | null> {
  return callCompletion('reflection', ctx)
}

// ── Weekly review ─────────────────────────────────────────────────────────────

export interface WeeklyReviewResult {
  summary: string
  wins: string[]
  slips: string[]
  question: string
  adjustment: string
}

export async function generateWeeklyReview(
  weekSummary: string,
): Promise<WeeklyReviewResult | null> {
  return callCompletion('weekly-review', { weekSummary })
}
