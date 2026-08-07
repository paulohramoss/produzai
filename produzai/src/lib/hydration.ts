// Hidratação — o pouco de lógica que o card de água compartilha com as páginas.

/** Quanto entra a cada toque no botão principal. */
export const WATER_STEP_ML = 250

/** 3500 vira "3,5" — litros com uma casa, vírgula decimal. */
export function formatLiters(ml: number): string {
  return (ml / 1000).toFixed(1).replace('.', ',')
}
