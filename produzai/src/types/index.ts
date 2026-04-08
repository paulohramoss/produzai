export type Page = 'dashboard' | 'chat' | 'habits' | 'finance' | 'calendar' | 'investments' | 'goals' | 'reports' | 'settings'

export interface Habit {
  id: string
  name: string
  icon: string
  completedDays: boolean[]   // 30 dias
  streak: number
  xp: number
  frequency: 'daily' | 'weekly'
}

export interface Transaction {
  id: string
  description: string
  amount: number
  category: string
  type: 'income' | 'expense'
  date: string
  card?: string
}

export interface Investment {
  id: string
  name: string
  category: 'fixed' | 'variable' | 'crypto' | 'real_estate'
  invested: number
  current: number
  return: number
}

export interface Goal {
  id: string
  title: string
  description: string
  targetAmount: number
  currentAmount: number
  deadline: string
  imageUrl?: string
  category: string
}

export interface Event {
  id: string
  title: string
  date: string
  time: string
  type: 'work' | 'health' | 'finance' | 'personal'
  done: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface UserProfile {
  name: string
  avatar: string
  xp: number
  level: number
  streak: number
  rank: number
}
