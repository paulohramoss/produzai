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
        const next = { ...get().profile, ...patch }
        set({ profile: next })
        saveAthleteProfile(patch)
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
