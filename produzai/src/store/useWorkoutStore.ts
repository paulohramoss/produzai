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
  /** Como o treino foi, em texto livre: sensação, clima, o que travou. */
  notes?: string
  /** Dor sentida no treino, 1 (leve) a 5 (forte). Ausente = nada a relatar. */
  painLevel?: number
  /** Onde doeu — "joelho direito", "lombar". Só faz sentido com painLevel. */
  painArea?: string
}

/** Dor a partir daqui é sinal de lesão, não de treino puxado. */
export const INJURY_PAIN_LEVEL = 4

interface WorkoutState {
  workouts: ManualWorkout[]
  add:    (w: Omit<ManualWorkout, 'id'>) => void
  /** Mescla atividades importadas (ex: Strava), ignorando as que já foram importadas (por stravaId). Retorna quantas foram adicionadas. */
  addMany: (items: Omit<ManualWorkout, 'id'>[]) => number
  /** Corrige um treino já registrado, preservando id e origem (manual/Strava). */
  update: (id: string, patch: Omit<ManualWorkout, 'id'>) => void
  remove: (id: string) => void
  setAll: (workouts: ManualWorkout[]) => void
}

/**
 * O Firestore rejeita `undefined`. Campos opcionais que o usuário apagou na
 * edição (nota, dor, exercícios) precisam sumir do objeto, não virar undefined.
 */
function stripUndefined<Item extends object>(obj: Item): Item {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Item
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
      update: (id, patch) => {
        const existing = get().workouts.find(w => w.id === id)
        if (!existing) return
        // A origem não é editável: um treino importado do Strava continua sendo
        // dele mesmo depois de corrigido, senão a próxima sincronização duplica.
        const merged = stripUndefined({
          ...patch,
          id,
          ...(existing.source ? { source: existing.source } : {}),
          ...(existing.stravaId != null ? { stravaId: existing.stravaId } : {}),
        })
        const next = get().workouts
          .map(w => (w.id === id ? merged : w))
          .sort((a, b) => b.rawDate.localeCompare(a.rawDate))
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
