import { create } from 'zustand'
import { fetchStravaData, type StravaData } from '../services/strava'

interface StravaState {
  data: StravaData | null
  loading: boolean
  error: string | null
  load: () => Promise<void>
  clear: () => void
}

export const useStravaStore = create<StravaState>(set => ({
  data: null,
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const data = await fetchStravaData()
      set({ data, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },
  clear: () => set({ data: null, error: null }),
}))
