import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { saveDiet } from '../lib/db'

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
  setup:       (goals: WebDietGoals, meals?: WebDietMeal[]) => void
  toggleMeal:  (id: string) => void
  addMeal:     (meal: Omit<WebDietMeal, 'id'>) => void
  removeMeal:  (id: string) => void
  updateGoals: (goals: WebDietGoals) => void
  setData:     (data: WebDietData | null) => void
  clear:       () => void
}

function sync(data: WebDietData | null) {
  if (data) saveDiet(data)
}

export const useWebDietStore = create<WebDietState>()(
  persist(
    (set, get) => ({
      data: null,

      setup: (goals, meals = []) => {
        const data = { goals, meals }
        set({ data })
        sync(data)
      },

      toggleMeal: id => {
        const s = get()
        if (!s.data) return
        const data = { ...s.data, meals: s.data.meals.map(m => m.id === id ? { ...m, done: !m.done } : m) }
        set({ data })
        sync(data)
      },

      addMeal: meal => {
        const s = get()
        if (!s.data) return
        const data = { ...s.data, meals: [...s.data.meals, { ...meal, id: Math.random().toString(36).slice(2) }] }
        set({ data })
        sync(data)
      },

      removeMeal: id => {
        const s = get()
        if (!s.data) return
        const data = { ...s.data, meals: s.data.meals.filter(m => m.id !== id) }
        set({ data })
        sync(data)
      },

      updateGoals: goals => {
        const s = get()
        if (!s.data) return
        const data = { ...s.data, goals }
        set({ data })
        sync(data)
      },

      setData: data => set({ data }),

      clear: () => set({ data: null }),
    }),
    {
      name: 'webdiet_data',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
