export interface Habit { id: string; icon: string; label: string; done: boolean; why?: string }
export interface FocusItem { id: string; text: string; done: boolean }

export function computeScore(habits: Habit[], focus: FocusItem[]): number {
  const doneHabits = habits.filter(h => h.done).length
  const totalFocus = focus.filter(f => f.text).length
  const doneFocus  = focus.filter(f => f.done && f.text).length
  const habitsPart = habits.length > 0 ? (doneHabits / habits.length) * 60 : 0
  const focusPart  = totalFocus > 0 ? (doneFocus / totalFocus) * 40 : 0
  return Math.round(habitsPart + focusPart)
}
