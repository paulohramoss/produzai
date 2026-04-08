import { create } from 'zustand'
import type { Page, Habit, Transaction, Investment, Goal, Event, ChatMessage } from '../types'
import {
  habits as initHabits,
  transactions as initTransactions,
  investments as initInvestments,
  goals as initGoals,
  events as initEvents,
  initialMessages,
  userProfile as initProfile,
} from '../data/mockData'

interface AppState {
  currentPage: Page
  setPage: (p: Page) => void

  profile: typeof initProfile

  habits: Habit[]
  toggleHabit: (id: string, dayIndex: number) => void

  transactions: Transaction[]
  addTransaction: (t: Omit<Transaction, 'id'>) => void

  investments: Investment[]

  goals: Goal[]

  events: Event[]
  toggleEvent: (id: string) => void

  messages: ChatMessage[]
  addMessage: (m: ChatMessage) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  setPage: (p) => set({ currentPage: p }),

  profile: initProfile,

  habits: initHabits,
  toggleHabit: (id, dayIndex) =>
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id
          ? {
              ...h,
              completedDays: h.completedDays.map((v, i) => (i === dayIndex ? !v : v)),
            }
          : h
      ),
    })),

  transactions: initTransactions,
  addTransaction: (t) =>
    set((s) => ({
      transactions: [{ ...t, id: `t${Date.now()}` }, ...s.transactions],
    })),

  investments: initInvestments,

  goals: initGoals,

  events: initEvents,
  toggleEvent: (id) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
    })),

  messages: initialMessages,
  addMessage: (m) =>
    set((s) => ({ messages: [...s.messages, m] })),
}))
