export type EffortLevel = 1 | 2 | 3 | 4 | 5

export const EFFORT_LEVELS: { value: EffortLevel; label: string }[] = [
  { value: 1, label: 'Leve' },
  { value: 2, label: 'Moderado' },
  { value: 3, label: 'Intenso' },
  { value: 4, label: 'Muito intenso' },
  { value: 5, label: 'Máximo' },
]

// Peso de referência usado na fórmula (kcal = MET × kg × horas) apenas como
// último recurso, enquanto o usuário não informou o peso dele no perfil.
// Estimar 70kg para todo mundo erra o gasto calórico em ~30% nos extremos.
export const REFERENCE_WEIGHT_KG = 70

// Limites de sanidade para o peso informado — protege a fórmula de digitação
// errada (ex: 700 em vez de 70) e de valores fisiologicamente impossíveis.
export const MIN_WEIGHT_KG = 30
export const MAX_WEIGHT_KG = 300

/** Devolve um peso utilizável na fórmula: o do usuário, se válido; senão a referência. */
export function resolveWeightKg(weightKg?: number | null): number {
  if (weightKg == null || !Number.isFinite(weightKg)) return REFERENCE_WEIGHT_KG
  if (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) return REFERENCE_WEIGHT_KG
  return weightKg
}

// MET (Metabolic Equivalent of Task) por tipo de atividade e grau de esforço (1 a 5).
const MET_TABLE: Record<string, [number, number, number, number, number]> = {
  Corrida:   [7,   9,   11,  13,  15],
  Caminhada: [2.8, 3.8, 4.8, 5.8, 7],
  Academia:  [3,   4.5, 6,   7.5, 9],
  Ciclismo:  [4,   6,   8,   10,  12],
  Natação:   [5,   6.5, 8,   9.5, 11],
  Futebol:   [5,   7,   8.5, 10,  11.5],
  Outro:     [3,   4.5, 6,   7.5, 9],
}

/**
 * Estima o gasto calórico (kcal) a partir do tipo de atividade, duração e grau
 * de esforço percebido. `weightKg` é o peso do usuário — sem ele a conta cai no
 * peso de referência e o resultado é só uma aproximação grosseira.
 */
export function estimateCalories(
  type: string,
  durationMin: number,
  effort: EffortLevel,
  weightKg?: number | null,
): number {
  const mets = MET_TABLE[type] ?? MET_TABLE.Outro
  const met = mets[effort - 1]
  const hours = durationMin / 60
  return Math.round(met * resolveWeightKg(weightKg) * hours)
}
