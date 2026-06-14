import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import type { ChatMessage } from '../lib/anthropic'

interface CoachState {
  messages: ChatMessage[]
  setMessages: (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  clear: () => void
}

export const useCoachStore = create<CoachState>()(
  persist(
    set => ({
      messages: [],
      setMessages: update => set(s => ({
        messages: typeof update === 'function' ? update(s.messages) : update,
      })),
      clear: () => set({ messages: [] }),
    }),
    {
      name: 'coach_messages',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
      // Don't persist attachment payloads (can be several MB each) — keep only metadata.
      partialize: state => ({
        ...state,
        messages: state.messages.map(m => m.attachment
          ? { ...m, attachment: { ...m.attachment, data: '' } }
          : m),
      }),
    },
  ),
)
