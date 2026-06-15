import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { saveHabitDefs, getHabitDefs, type HabitDef } from '../lib/db'

export type { HabitDef }

export const DEFAULT_DEFS: HabitDef[] = [
  { id: 'agua',      icon: '💧', label: 'Água 3L',          why: 'Seu corpo e sua mente funcionam melhor hidratados.', createdAt: Date.now() },
  { id: 'treino',    icon: '🏋', label: 'Treino',            why: 'Cuidar do corpo é a base para ter energia em tudo o resto.', createdAt: Date.now() },
  { id: 'leitura',   icon: '📚', label: 'Leitura 30min',     why: 'Investir em conhecimento é investir em quem você está se tornando.', createdAt: Date.now() },
  { id: 'meditacao', icon: '🧘', label: 'Meditação 10min',   why: 'Uma mente calma toma decisões melhores.', createdAt: Date.now() },
  { id: 'sono',      icon: '😴', label: 'Dormir 22h30',      why: 'Descanso de qualidade é o multiplicador invisível da sua produtividade.', createdAt: Date.now() },
  { id: 'proteina',  icon: '🥩', label: 'Meta de proteína',  why: 'Alimentar bem o corpo sustenta seus objetivos físicos.', createdAt: Date.now() },
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
        const defs = [...get().defs, { ...def, id: Math.random().toString(36).slice(2), createdAt: Date.now() }]
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
