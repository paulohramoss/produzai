import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { saveWorkouts } from '../lib/db'

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
}

interface WorkoutState {
  workouts: ManualWorkout[]
  add:    (w: Omit<ManualWorkout, 'id'>) => void
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
