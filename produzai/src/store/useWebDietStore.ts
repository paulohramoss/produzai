import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WebDietGoals {
  cal: number
  prot: number
  carb: number
  fat: number
}

export interface WebDietMeal {
  id: string
  time: string
  name: string
  cal: number
  prot: number
  carb: number
  fat: number
  done: boolean
  items: string[]
}

export interface WebDietData {
  goals: WebDietGoals
  meals: WebDietMeal[]
}

interface WebDietState {
  data: WebDietData | null
  setup: (goals: WebDietGoals, meals?: WebDietMeal[]) => void
  toggleMeal: (id: string) => void
  addMeal: (meal: Omit<WebDietMeal, 'id'>) => void
  removeMeal: (id: string) => void
  updateGoals: (goals: WebDietGoals) => void
  clear: () => void
}

export const useWebDietStore = create<WebDietState>()(
  persist(
    set => ({
      data: null,
      setup: (goals, meals = []) => set({ data: { goals, meals } }),
      toggleMeal: id =>
        set(s =>
          s.data
            ? { data: { ...s.data, meals: s.data.meals.map(m => m.id === id ? { ...m, done: !m.done } : m) } }
            : s,
        ),
      addMeal: meal =>
        set(s =>
          s.data
            ? { data: { ...s.data, meals: [...s.data.meals, { ...meal, id: Math.random().toString(36).slice(2) }] } }
            : s,
        ),
      removeMeal: id =>
        set(s =>
          s.data
            ? { data: { ...s.data, meals: s.data.meals.filter(m => m.id !== id) } }
            : s,
        ),
      updateGoals: goals =>
        set(s => (s.data ? { data: { ...s.data, goals } } : s)),
      clear: () => set({ data: null }),
    }),
    { name: 'webdiet_data' },
  ),
)
