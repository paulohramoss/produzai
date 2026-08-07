export type EffortLevel = 1 | 2 | 3 | 4 | 5

export const EFFORT_LEVELS: { value: EffortLevel; label: string }[] = [
  { value: 1, label: 'Leve' },
  { value: 2, label: 'Moderado' },
  { value: 3, label: 'Intenso' },
  { value: 4, label: 'Muito intenso' },
  { value: 5, label: 'Máximo' },
]

// Peso assumido quando o usuário ainda não preencheu o perfil de atleta.
// A fórmula é kcal = MET × kg × horas, então o peso entra linearmente: um
// atleta de 95 kg gasta ~36% mais que este padrão na mesma sessão.
const FALLBACK_WEIGHT_KG = 70

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
 * de esforço percebido.
 *
 * `weightKg` é opcional para que o valor padrão continue valendo em qualquer
 * chamada que ainda não tenha o perfil do atleta em mãos.
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
  const kg = weightKg && weightKg > 25 && weightKg < 300 ? weightKg : FALLBACK_WEIGHT_KG
  return Math.round(met * kg * hours)
}
