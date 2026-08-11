import { create } from 'zustand'
import { getCycle, saveCycle } from '../lib/db'
import {
  DEFAULT_CYCLE, normalizeCycle, observedCycleLength,
  CYCLE_LENGTH_RANGE, PERIOD_LENGTH_RANGE,
  type CycleData,
} from '../lib/cycle'

interface CycleState extends CycleData {
  loaded: boolean
  load:            () => Promise<void>
  setEnabled:      (enabled: boolean) => Promise<void>
  setLengths:      (avgLength: number, periodLength: number) => Promise<void>
  logPeriodStart:  (date: string) => Promise<void>
  removePeriodStart: (date: string) => Promise<void>
  reset:           () => void
}

// Diferente dos outros stores, o ciclo NÃO tem cache em localStorage: é dado de
// saúde sensível e opt-in, então vive só na nuvem e na memória da sessão.
export const useCycleStore = create<CycleState>((set, get) => {
  async function persist(next: CycleData) {
    set(next)
    await saveCycle(next)
  }

  function current(): CycleData {
    const s = get()
    return { enabled: s.enabled, avgLength: s.avgLength, periodLength: s.periodLength, starts: s.starts }
  }

  return {
    ...DEFAULT_CYCLE,
    loaded: false,

    load: async () => {
      const raw = await getCycle()
      set({ ...normalizeCycle(raw), loaded: true })
    },

    setEnabled: async (enabled) => {
      await persist({ ...current(), enabled })
    },

    setLengths: async (avgLength, periodLength) => {
      await persist(normalizeCycle({ ...current(), avgLength, periodLength }))
    },

    logPeriodStart: async (date) => {
      const s = current()
      if (s.starts.includes(date)) return
      const starts = [...s.starts, date].sort()
      // Com três ou mais ciclos registrados, o histórico real vale mais que o
      // número que a usuária digitou uma vez lá atrás.
      const observed = observedCycleLength(starts)
      await persist(normalizeCycle({ ...s, starts, avgLength: observed ?? s.avgLength }))
    },

    removePeriodStart: async (date) => {
      const s = current()
      await persist({ ...s, starts: s.starts.filter(d => d !== date) })
    },

    reset: () => set({ ...DEFAULT_CYCLE, loaded: false }),
  }
})

export { CYCLE_LENGTH_RANGE, PERIOD_LENGTH_RANGE }
