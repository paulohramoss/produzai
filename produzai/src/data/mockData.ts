import type { Habit, Transaction, Investment, Goal, Event, ChatMessage, UserProfile } from '../types'

export const userProfile: UserProfile = {
  name: 'Lucas Mendes',
  avatar: 'LM',
  xp: 4820,
  level: 12,
  streak: 14,
  rank: 7,
}

// 30 dias de histórico
const rand30 = (rate: number) => Array.from({ length: 30 }, () => Math.random() < rate)

export const habits: Habit[] = [
  { id: 'h1', name: 'Treinar', icon: '💪', completedDays: rand30(0.85), streak: 14, xp: 420, frequency: 'daily' },
  { id: 'h2', name: 'Ler 30 páginas', icon: '📚', completedDays: rand30(0.7), streak: 6, xp: 310, frequency: 'daily' },
  { id: 'h3', name: 'Dieta', icon: '🥗', completedDays: rand30(0.65), streak: 4, xp: 280, frequency: 'daily' },
  { id: 'h4', name: 'Beber 3L de água', icon: '💧', completedDays: rand30(0.9), streak: 21, xp: 510, frequency: 'daily' },
  { id: 'h5', name: 'Meditar', icon: '🧘', completedDays: rand30(0.55), streak: 3, xp: 190, frequency: 'daily' },
  { id: 'h6', name: 'Estudar', icon: '💡', completedDays: rand30(0.75), streak: 9, xp: 370, frequency: 'daily' },
  { id: 'h7', name: 'Planejar o dia', icon: '📋', completedDays: rand30(0.95), streak: 28, xp: 600, frequency: 'daily' },
]

export const transactions: Transaction[] = [
  { id: 't1',  description: 'Salário',          amount: 8500,   category: 'Renda',         type: 'income',  date: '2026-04-01' },
  { id: 't2',  description: 'Freela design',    amount: 1200,   category: 'Renda',         type: 'income',  date: '2026-04-05' },
  { id: 't3',  description: 'Mercado',          amount: 420.5,  category: 'Alimentação',   type: 'expense', date: '2026-04-02', card: 'Nubank' },
  { id: 't4',  description: 'Netflix',          amount: 49.9,   category: 'Assinaturas',   type: 'expense', date: '2026-04-03', card: 'C6 Bank' },
  { id: 't5',  description: 'Spotify',          amount: 29.9,   category: 'Assinaturas',   type: 'expense', date: '2026-04-03', card: 'Nubank' },
  { id: 't6',  description: 'Uber',             amount: 38.4,   category: 'Transporte',    type: 'expense', date: '2026-04-04', card: 'Nubank' },
  { id: 't7',  description: 'Academia',         amount: 99.9,   category: 'Saúde',         type: 'expense', date: '2026-04-04', card: 'Itaú' },
  { id: 't8',  description: 'Aluguel',          amount: 1800,   category: 'Moradia',       type: 'expense', date: '2026-04-05' },
  { id: 't9',  description: 'Restaurante',      amount: 87.6,   category: 'Alimentação',   type: 'expense', date: '2026-04-06', card: 'Nubank' },
  { id: 't10', description: 'iFood',            amount: 52.3,   category: 'Alimentação',   type: 'expense', date: '2026-04-07', card: 'Nubank' },
  { id: 't11', description: 'Curso online',     amount: 297,    category: 'Educação',      type: 'expense', date: '2026-04-06', card: 'C6 Bank' },
  { id: 't12', description: 'Farmácia',         amount: 63.8,   category: 'Saúde',         type: 'expense', date: '2026-04-07', card: 'Itaú' },
]

export const investments: Investment[] = [
  { id: 'i1', name: 'Tesouro Direto IPCA+',  category: 'fixed',       invested: 15000, current: 16200,  return: 8.0 },
  { id: 'i2', name: 'CDB Banco Inter 120%',  category: 'fixed',       invested: 8000,  current: 8560,   return: 7.0 },
  { id: 'i3', name: 'PETR4',                 category: 'variable',    invested: 5000,  current: 5800,   return: 16.0 },
  { id: 'i4', name: 'ITUB4',                 category: 'variable',    invested: 4000,  current: 4320,   return: 8.0 },
  { id: 'i5', name: 'MXRF11 (FII)',          category: 'real_estate', invested: 6000,  current: 6300,   return: 5.0 },
  { id: 'i6', name: 'Bitcoin',               category: 'crypto',      invested: 3000,  current: 4200,   return: 40.0 },
  { id: 'i7', name: 'Ethereum',              category: 'crypto',      invested: 2000,  current: 2480,   return: 24.0 },
]

export const goals: Goal[] = [
  { id: 'g1', title: 'Carro dos sonhos',  description: 'BMW Série 3 2025',        targetAmount: 250000, currentAmount: 62000,  deadline: '2028-12-01', category: 'Patrimônio'   },
  { id: 'g2', title: 'Reserva de emergência', description: '6x o gasto mensal',   targetAmount: 24000,  currentAmount: 18000,  deadline: '2026-08-01', category: 'Finanças'     },
  { id: 'g3', title: 'Intercâmbio',       description: 'Portugal por 3 meses',    targetAmount: 30000,  currentAmount: 8500,   deadline: '2027-03-01', category: 'Experiências' },
  { id: 'g4', title: 'Apartamento próprio', description: 'Entrada 20%',           targetAmount: 120000, currentAmount: 31000,  deadline: '2030-01-01', category: 'Patrimônio'   },
]

export const events: Event[] = [
  { id: 'e1', title: 'Consulta médica',       date: '2026-04-09', time: '09:00', type: 'health',   done: false },
  { id: 'e2', title: 'Reunião cliente',        date: '2026-04-09', time: '14:30', type: 'work',     done: false },
  { id: 'e3', title: 'Dentista',               date: '2026-04-10', time: '11:00', type: 'health',   done: false },
  { id: 'e4', title: 'Pagar fatura Nubank',    date: '2026-04-10', time: '08:00', type: 'finance',  done: false },
  { id: 'e5', title: 'Call com time',          date: '2026-04-11', time: '10:00', type: 'work',     done: false },
  { id: 'e6', title: 'Treino funcional',       date: '2026-04-11', time: '07:00', type: 'health',   done: false },
  { id: 'e7', title: 'Revisar metas mensais',  date: '2026-04-14', time: '18:00', type: 'personal', done: false },
]

export const initialMessages: ChatMessage[] = [
  {
    id: 'm0',
    role: 'assistant',
    content: 'Olá, Lucas! 👋 Sou o **Nexus**, seu assistente de produtividade e finanças. Posso te ajudar a planejar o dia, registrar gastos, revisar metas e muito mais. Como posso te ajudar hoje?',
    timestamp: '08:00',
  },
]

export const ranking = [
  { rank: 1,  name: 'Ana Paula',    xp: 9820, streak: 47, avatar: 'AP' },
  { rank: 2,  name: 'Rafael S.',    xp: 9210, streak: 38, avatar: 'RS' },
  { rank: 3,  name: 'Camila R.',    xp: 8750, streak: 31, avatar: 'CR' },
  { rank: 4,  name: 'Diego M.',     xp: 8100, streak: 29, avatar: 'DM' },
  { rank: 5,  name: 'Fernanda L.',  xp: 7640, streak: 25, avatar: 'FL' },
  { rank: 6,  name: 'Bruno T.',     xp: 6990, streak: 20, avatar: 'BT' },
  { rank: 7,  name: 'Lucas Mendes', xp: 4820, streak: 14, avatar: 'LM', isMe: true },
  { rank: 8,  name: 'Juliana N.',   xp: 4700, streak: 13, avatar: 'JN' },
  { rank: 9,  name: 'Thiago A.',    xp: 4510, streak: 11, avatar: 'TA' },
  { rank: 10, name: 'Priscila K.',  xp: 4200, streak: 9,  avatar: 'PK' },
]

// Gráfico progresso mensal
export const monthlyProgress = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  real: Math.round(55 + Math.random() * 40),
  meta: 75,
}))
