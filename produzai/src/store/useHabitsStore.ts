import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { saveHabitDefs, getHabitDefs, type HabitDef } from '../lib/db'

export type { HabitDef }

export const DEFAULT_DEFS: HabitDef[] = [
  { id: 'agua',      icon: '💧', label: 'Água 3L' },
  { id: 'treino',    icon: '🏋', label: 'Treino' },
  { id: 'leitura',   icon: '📚', label: 'Leitura 30min' },
  { id: 'meditacao', icon: '🧘', label: 'Meditação 10min' },
  { id: 'sono',      icon: '😴', label: 'Dormir 22h30' },
  { id: 'proteina',  icon: '🥩', label: 'Meta de proteína' },
]

interface HabitsState {
  defs: HabitDef[]
  setDefs:    (defs: HabitDef[]) => void
  addDef:     (def: Omit<HabitDef, 'id'>) => void
  removeDef:  (id: string) => void
  updateDef:  (id: string, patch: Partial<Omit<HabitDef, 'id'>>) => void
  loadFromCloud: () => Promise<void>
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      defs: DEFAULT_DEFS,

      setDefs: defs => {
        set({ defs })
        saveHabitDefs(defs)
      },

      addDef: def => {
        const defs = [...get().defs, { ...def, id: Math.random().toString(36).slice(2) }]
        set({ defs })
        saveHabitDefs(defs)
      },

      removeDef: id => {
        const defs = get().defs.filter(d => d.id !== id)
        set({ defs })
        saveHabitDefs(defs)
      },

      updateDef: (id, patch) => {
        const defs = get().defs.map(d => d.id === id ? { ...d, ...patch } : d)
        set({ defs })
        saveHabitDefs(defs)
      },

      loadFromCloud: async () => {
        const cloud = await getHabitDefs()
        if (cloud !== null && cloud.length > 0) set({ defs: cloud })
      },
    }),
    {
      name: 'habit_defs',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
