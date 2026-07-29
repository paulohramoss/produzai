import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { userStorage } from '../lib/userStorage'
import { saveCoachConversations } from '../lib/db'
import type { ChatMessage } from '../lib/anthropic'

export interface CoachConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

interface CoachState {
  conversations: CoachConversation[]
  activeId: string | null
  startNew: () => string
  setActive: (id: string) => void
  setMessages: (id: string, update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  removeConversation: (id: string) => void
  /** Funde o histórico vindo da nuvem com o que já existe localmente (união — nada é descartado). */
  mergeConversations: (incoming: CoachConversation[]) => void
}

const TITLE_MAX = 42

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user' && m.content.trim())
  if (!firstUser) return 'Nova conversa'
  const text = firstUser.content.trim()
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text
}

function makeConversation(messages: ChatMessage[] = []): CoachConversation {
  const now = Date.now()
  return {
    id: Math.random().toString(36).slice(2),
    title: deriveTitle(messages),
    messages,
    createdAt: now,
    updatedAt: now,
  }
}

interface LegacyState {
  messages?: ChatMessage[]
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,

      startNew: () => {
        const conv = makeConversation()
        set(s => ({ conversations: [conv, ...s.conversations], activeId: conv.id }))
        return conv.id
      },

      setActive: id => set({ activeId: id }),

      setMessages: (id, update) => {
        set(s => ({
          conversations: s.conversations.map(c => {
            if (c.id !== id) return c
            const messages = typeof update === 'function' ? update(c.messages) : update
            return { ...c, messages, updatedAt: Date.now(), title: deriveTitle(messages) }
          }),
        }))
        // Espelha na nuvem a cada mensagem — o histórico não pode depender só do
        // localStorage. Escrita imediata (sem debounce) para que fechar a aba no
        // meio da conversa não perca nada.
        saveCoachConversations(get().conversations)
      },

      removeConversation: id => {
        const { conversations, activeId } = get()
        const next = conversations.filter(c => c.id !== id)
        set({ conversations: next, activeId: activeId === id ? (next[0]?.id ?? null) : activeId })
        saveCoachConversations(next)
      },

      mergeConversations: incoming => {
        const byId = new Map<string, CoachConversation>()
        for (const c of get().conversations) byId.set(c.id, c)
        for (const remote of incoming) {
          const local = byId.get(remote.id)
          if (!local) { byId.set(remote.id, remote); continue }
          // Em conflito, fica o lado mais completo: o mais recente e, em empate
          // de horário, o que tiver mais mensagens.
          const remoteWins = remote.updatedAt > local.updatedAt
            || (remote.updatedAt === local.updatedAt && remote.messages.length > local.messages.length)
          byId.set(remote.id, remoteWins ? remote : local)
        }
        const conversations = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
        set(s => ({
          conversations,
          // Mantém a sessão que estava aberta; se ela não existir mais, abre a mais recente.
          activeId: s.activeId && byId.has(s.activeId) ? s.activeId : (conversations[0]?.id ?? null),
        }))
      },
    }),
    {
      name: 'coach_messages',
      storage: createJSONStorage(() => userStorage),
      skipHydration: true,
      version: 2,
      migrate: (persisted, version): CoachState => {
        if (version >= 2) return persisted as CoachState
        const legacy = persisted as LegacyState
        if (legacy?.messages?.length) {
          const conv = makeConversation(legacy.messages)
          return { conversations: [conv], activeId: conv.id } as unknown as CoachState
        }
        return { conversations: [], activeId: null } as unknown as CoachState
      },
      // Don't persist attachment payloads (can be several MB each) — keep only metadata.
      partialize: state => ({
        ...state,
        conversations: state.conversations.map(c => ({
          ...c,
          messages: c.messages.map(m => m.attachment
            ? { ...m, attachment: { ...m.attachment, data: '' } }
            : m),
        })),
      }),
    },
  ),
)
