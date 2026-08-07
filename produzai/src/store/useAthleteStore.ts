import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { getAthleteProfile, saveAthleteProfile } from '../lib/db'
import { EMPTY_ATHLETE, type AthleteProfile } from '../lib/athleteProfile'

interface AthleteState {
  profile: AthleteProfile
  update: (patch: Partial<AthleteProfile>) => void
  setAll: (profile: AthleteProfile) => void
  loadFromCloud: () => Promise<void>
}

export const useAthleteStore = create<AthleteState>()(
  persist(
    (set, get) => ({
      profile: EMPTY_ATHLETE,
      update: patch => {
        // Chaves `undefined` são descartadas na escrita (o Firestore as rejeita),
        // então aplicá-las no estado local faria a memória divergir da nuvem
        // até o próximo reload. Descarta nos dois lados.
        const defined = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        ) as Partial<AthleteProfile>
        set({ profile: { ...get().profile, ...defined } })
        saveAthleteProfile(defined)
      },
      setAll: profile => set({ profile }),
      loadFromCloud: async () => {
        const cloud = await getAthleteProfile()
        if (cloud) set({ profile: { ...EMPTY_ATHLETE, ...cloud } })
        else await useAthleteStore.persist.rehydrate()
      },
    }),
    {
      name: 'athlete_profile',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
    },
  ),
)
