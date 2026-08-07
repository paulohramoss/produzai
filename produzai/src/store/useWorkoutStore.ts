import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { saveWorkouts } from '../lib/db'
import type { EffortLevel } from '../lib/calories'
import type { Exercise } from '../lib/strength'

export interface ManualWorkout {
  id: string
  type: string
  name: string
  rawDate: string  // "YYYY-MM-DD" for week filtering
  date: string     // friendly display label
  dist: number     // km (0 if not applicable)
  pace: string
  time: string
  cal: number
  hr: number
  elev: number
  effort?: EffortLevel
  source?: 'manual' | 'strava'
  stravaId?: number
  /** Exercícios com séries × reps × carga — o que distância e pace não medem. */
  exercises?: Exercise[]
}

interface WorkoutState {
  workouts: ManualWorkout[]
  add:    (w: Omit<ManualWorkout, 'id'>) => void
  /** Mescla atividades importadas (ex: Strava), ignorando as que já foram importadas (por stravaId). Retorna quantas foram adicionadas. */
  addMany: (items: Omit<ManualWorkout, 'id'>[]) => number
  remove: (id: string) => void
  setAll: (workouts: ManualWorkout[]) => void
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      workouts: [],
      add: w => {
        const next = [{ ...w, id: Math.random().toString(36).slice(2) }, ...get().workouts]
        set({ workouts: next })
        saveWorkouts(next)
      },
      addMany: items => {
        const existing = get().workouts
        const knownStravaIds = new Set(existing.filter(w => w.stravaId != null).map(w => w.stravaId))
        const toAdd = items.filter(w => w.stravaId == null || !knownStravaIds.has(w.stravaId))
        if (toAdd.length === 0) return 0
        const withIds = toAdd.map(w => ({ ...w, id: Math.random().toString(36).slice(2) }))
        const next = [...withIds, ...existing].sort((a, b) => b.rawDate.localeCompare(a.rawDate))
        set({ workouts: next })
        saveWorkouts(next)
        return toAdd.length
      },
      remove: id => {
        const next = get().workouts.filter(w => w.id !== id)
        set({ workouts: next })
        saveWorkouts(next)
      },
      setAll: workouts => set({ workouts }),
    }),
    {
      name: 'manual_workouts',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
