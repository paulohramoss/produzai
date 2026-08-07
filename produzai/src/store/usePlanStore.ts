import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { getWeekPlan, saveWeekPlan } from '../lib/db'
import type { PlannedSession } from '../lib/weekPlan'

interface PlanState {
  sessions: PlannedSession[]
  add:      (session: Omit<PlannedSession, 'id'>) => void
  update:   (id: string, patch: Partial<Omit<PlannedSession, 'id'>>) => void
  remove:   (id: string) => void
  setAll:   (sessions: PlannedSession[]) => void
  loadFromCloud: () => Promise<void>
}

function sync(sessions: PlannedSession[]) {
  saveWeekPlan(sessions)
}

/** Ordena por dia da semana para a grade sair sempre na mesma sequência. */
function sorted(sessions: PlannedSession[]): PlannedSession[] {
  return [...sessions].sort((a, b) => a.weekday - b.weekday)
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      sessions: [],

      add: session => {
        const next = sorted([...get().sessions, { ...session, id: Math.random().toString(36).slice(2) }])
        set({ sessions: next })
        sync(next)
      },

      update: (id, patch) => {
        const next = sorted(get().sessions.map(s => (s.id === id ? { ...s, ...patch } : s)))
        set({ sessions: next })
        sync(next)
      },

      remove: id => {
        const next = get().sessions.filter(s => s.id !== id)
        set({ sessions: next })
        sync(next)
      },

      setAll: sessions => set({ sessions: sorted(sessions) }),

      loadFromCloud: async () => {
        const cloud = await getWeekPlan()
        if (cloud !== null) set({ sessions: sorted(cloud) })
      },
    }),
    {
      name: 'week_plan',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
