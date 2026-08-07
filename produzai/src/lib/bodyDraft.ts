// Rascunho dos dados corporais durante o onboarding: os campos chegam como texto
// do formulário e só viram número depois de validados. Fica fora do arquivo do
// componente para o hot reload continuar funcionando.

import {
  DEFAULT_ACTIVITY_LEVEL, MIN_HEIGHT_CM, MAX_HEIGHT_CM, suggestMacros,
  type BodyInput, type MacroGoal, type MacroSuggestion,
} from './body'
import { MIN_WEIGHT_KG, MAX_WEIGHT_KG } from './calories'
import type { ActivityLevel } from './db'

export interface BodyDraft {
  weight: string
  height: string
  birthDate: string
  sex: 'masculino' | 'feminino' | null
  activityLevel: ActivityLevel
  goal: MacroGoal
}

export const EMPTY_BODY_DRAFT: BodyDraft = {
  weight: '', height: '', birthDate: '', sex: null,
  activityLevel: DEFAULT_ACTIVITY_LEVEL, goal: 'manutencao',
}

function num(raw: string, min: number, max: number): number | null {
  const n = parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

/** Converte o rascunho de formulário nos dados que as fórmulas esperam. */
export function draftToBody(d: BodyDraft): BodyInput {
  return {
    weightKg:      num(d.weight, MIN_WEIGHT_KG, MAX_WEIGHT_KG),
    heightCm:      num(d.height, MIN_HEIGHT_CM, MAX_HEIGHT_CM),
    birthDate:     d.birthDate || null,
    sex:           d.sex,
    activityLevel: d.activityLevel,
  }
}

/** Sugestão de macros a partir do rascunho — null enquanto faltar algum dado. */
export function draftMacros(d: BodyDraft): MacroSuggestion | null {
  return suggestMacros(draftToBody(d), d.goal)
}
