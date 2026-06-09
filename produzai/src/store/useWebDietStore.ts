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

export type ComplianceStatus = 'perfect' | 'good' | 'alcohol' | 'skipped'

export interface DietCompliance {
  date: string
  status: ComplianceStatus
  note: string
}

interface WebDietState {
  data: WebDietData | null
<<<<<<< HEAD
  pdfBase64: string | null
  pdfName: string | null
  compliance: DietCompliance[]
  setup: (goals: WebDietGoals, meals?: WebDietMeal[]) => void
  toggleMeal: (id: string) => void
  addMeal: (meal: Omit<WebDietMeal, 'id'>) => void
  removeMeal: (id: string) => void
  updateGoals: (goals: WebDietGoals) => void
  clear: () => void
  setPdf: (base64: string, name: string) => void
  removePdf: () => void
  logCompliance: (entry: DietCompliance) => void
=======
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
>>>>>>> e189c45cca12979c14c0fe49c725a92330ce0de6
}

export const useWebDietStore = create<WebDietState>()(
  persist(
    (set, get) => ({
      data: null,
<<<<<<< HEAD
      pdfBase64: null,
      pdfName: null,
      compliance: [],
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
=======

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

>>>>>>> e189c45cca12979c14c0fe49c725a92330ce0de6
      clear: () => set({ data: null }),
      setPdf: (base64, name) => set({ pdfBase64: base64, pdfName: name }),
      removePdf: () => set({ pdfBase64: null, pdfName: null }),
      logCompliance: entry =>
        set(s => ({
          compliance: [
            ...s.compliance.filter(c => c.date !== entry.date),
            entry,
          ],
        })),
    }),
    {
      name: 'webdiet_data',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
