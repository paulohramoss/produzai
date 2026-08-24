import { getDoc, setDoc } from 'firebase/firestore'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

// ── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  onboardingDone: boolean
  createdAt?: number
  consentAt?: number   // Unix ms — when the user accepted the privacy policy
  goals?: string[]
  values?: string[]
  onboardingSummary?: string
  /** Peso atual em kg — entra na fórmula MET do gasto calórico e no TDEE. */
  weightKg?: number
  /** Altura em cm. */
  heightCm?: number
  /** Data de nascimento "YYYY-MM-DD" — guardamos a data, não a idade, para não envelhecer errado. */
  birthDate?: string
  /** Sexo biológico — a fórmula de Mifflin-St Jeor usa constantes diferentes. */
  sex?: 'masculino' | 'feminino'
  /** Nível de atividade fora dos treinos registrados — multiplicador do TDEE. */
  activityLevel?: ActivityLevel
  /** Token do link read-only ativo para o treinador — ausente quando não há link. */
  coachShareToken?: string
  /** De onde este atleta veio (UTM + código de indicação). Gravado uma vez, no cadastro. */
  attribution?: {
    source?: string
    medium?: string
    campaign?: string
    ref?: string
    landingPath?: string
    landedAt: number
  }
}

export type ActivityLevel = 'sedentario' | 'leve' | 'moderado' | 'intenso' | 'atleta'

export async function getProfile(): Promise<UserProfile | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('profile'))
    return snap.exists() ? (snap.data() as UserProfile) : null
  } catch (e) { logDbError('getProfile', e); return null }
}

export async function saveProfile(data: Partial<UserProfile>) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('profile'), data, { merge: true }), 'saveProfile')
}

// ── Weight log ───────────────────────────────────────────────────────────────
// Uma pesagem por dia (a última do dia vence). Guardado num documento só, como
// os demais: o volume é baixo (uma entrada por dia) e a leitura vira 1 read.

export interface WeightEntry {
  /** "YYYY-MM-DD" no fuso local. */
  date: string
  kg: number
}

/** Quantas pesagens mantemos — ~2 anos de registro diário. */
const WEIGHT_LOG_MAX = 730

export async function getWeightLog(): Promise<WeightEntry[]> {
  if (!getDbUid()) return []
  try {
    const snap = await getDoc(dataRef('weightLog'))
    return snap.exists() ? ((snap.data().items as WeightEntry[]) ?? []) : []
  } catch (e) { logDbError('getWeightLog', e); return [] }
}

export async function saveWeightLog(entries: WeightEntry[]) {
  if (!getDbUid()) return
  const items = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-WEIGHT_LOG_MAX)
  fireWrite(setDoc(dataRef('weightLog'), { items }), 'saveWeightLog')
}
