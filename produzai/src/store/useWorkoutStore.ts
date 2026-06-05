import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'

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
  add: (w: Omit<ManualWorkout, 'id'>) => void
  remove: (id: string) => void
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    set => ({
      workouts: [],
      add: w =>
        set(s => ({
          workouts: [{ ...w, id: Math.random().toString(36).slice(2) }, ...s.workouts],
        })),
      remove: id => set(s => ({ workouts: s.workouts.filter(w => w.id !== id) })),
    }),
    {
      name: 'manual_workouts',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
