export interface Habit { id: string; icon: string; label: string; done: boolean; why?: string }
export interface FocusItem { id: string; text: string; done: boolean }

/**
 * Score do dia: hábitos 60%, foco 40%.
 *
 * `pendingIds`, quando informado, restringe a conta aos hábitos realmente
 * cobrados no dia (ver lib/streaks.ts). Sem isso, quem tem hábito de 4x por
 * semana nunca fecharia 100% — os três dias de descanso contariam como falha.
 * Hábito em descanso que for cumprido mesmo assim continua somando.
 */
export function computeScore(habits: Habit[], focus: FocusItem[], pendingIds?: Set<string>): number {
  const counted = pendingIds ? habits.filter(h => pendingIds.has(h.id) || h.done) : habits
  const doneHabits = counted.filter(h => h.done).length
  const totalFocus = focus.filter(f => f.text).length
  const doneFocus  = focus.filter(f => f.done && f.text).length
  const habitsPart = counted.length > 0 ? (doneHabits / counted.length) * 60 : 0
  const focusPart  = totalFocus > 0 ? (doneFocus / totalFocus) * 40 : 0
  return Math.round(habitsPart + focusPart)
}
