import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { getTrainingPlan, saveTrainingPlan } from '../lib/db'
import { adaptPlan, type AdaptContext, type TrainingPlan } from '../lib/plan'

interface PlanState {
  plan: TrainingPlan | null
  /** Mudanças aplicadas na última adaptação — a UI avisa o usuário e limpa. */
  lastChanges: string[]
  setPlan: (plan: TrainingPlan) => void
  clearPlan: () => void
  /** Roda as regras locais e persiste se algo mudou. */
  adapt: (ctx: AdaptContext) => void
  dismissChanges: () => void
  loadFromCloud: () => Promise<void>
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: null,
      lastChanges: [],

      setPlan: plan => {
        set({ plan, lastChanges: [] })
        saveTrainingPlan(plan)
      },

      clearPlan: () => set({ plan: null, lastChanges: [] }),

      adapt: ctx => {
        const current = get().plan
        if (!current) return
        const { plan, changes } = adaptPlan(current, ctx)
        // Só escreve quando algo de fato mudou — evita um write por render.
        if (JSON.stringify(plan) === JSON.stringify(current)) return
        set({ plan, lastChanges: changes })
        saveTrainingPlan(plan)
      },

      dismissChanges: () => set({ lastChanges: [] }),

      loadFromCloud: async () => {
        const cloud = await getTrainingPlan()
        if (cloud) set({ plan: cloud })
        else await usePlanStore.persist.rehydrate()
      },
    }),
    {
      name: 'training_plan',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
