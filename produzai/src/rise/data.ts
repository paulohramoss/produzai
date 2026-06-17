import {
  LayoutDashboard, Sun, Dumbbell, Utensils, CalendarDays,
  Target, Brain, BookOpen, TrendingUp, Bot, Images, History,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Design tokens ────────────────────────────────────────────────────────────
// C mirrors the CSS vars declared in index.css (:root).
// Use C in inline styles; use var(--rise-*) in className-based styles.
// Keep hex values here so alpha variants like `${C.orange}33` stay valid.
export const C = {
  bg:      '#0C0C0C',
  card:    '#141414',
  card2:   '#1C1C1C',
  card3:   '#222222',
  border:  '#252525',
  border2: '#2E2E2E',
  text:    '#F0F0F0',
  muted:   '#666666',
  muted2:  '#999999',
  orange:  '#F97316',
  od:      'rgba(249,115,22,.11)',
  green:   '#22C55E',
  blue:    '#60A5FA',
  purple:  '#A78BFA',
  pink:    '#F472B6',
  red:     '#EF4444',
  running: '#FC4C02',
}

export type Page =
  | 'dashboard' | 'hoje' | 'historico' | 'treino' | 'dieta' | 'agenda'
  | 'projetos' | 'mental' | 'biblioteca' | 'coach' | 'galeria' | 'perfil' | 'insights'

export interface NavItem {
  id: Page
  icon: LucideIcon
  label: string
  color?: string
  badge?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export interface Activity {
  type: string
  name: string
  date: string
  dist: number
  pace: string
  time: string
  cal: number
  hr: number
  elev: number
}

export interface Zone { z: string; pct: number; c: string }

export const NAV_GROUPS: NavGroup[] = [
  { label: 'INÍCIO', items: [
    { id: 'dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'hoje',       icon: Sun,             label: 'Hoje' },
    { id: 'historico',  icon: History,         label: 'Histórico' },
  ]},
  { label: 'EXECUÇÃO', items: [
    { id: 'treino',  icon: Dumbbell,    label: 'Treino' },
    { id: 'dieta',   icon: Utensils,    label: 'Dieta' },
    { id: 'agenda',  icon: CalendarDays, label: 'Agenda' },
  ]},
  { label: 'CRESCIMENTO', items: [
    { id: 'projetos',   icon: Target,      label: 'Projetos' },
    { id: 'mental',     icon: Brain,       label: 'Mental' },
    { id: 'biblioteca', icon: BookOpen,    label: 'Biblioteca' },
    { id: 'insights',   icon: TrendingUp,  label: 'Insights' },
  ]},
  { label: 'SUPORTE', items: [
    { id: 'coach',   icon: Bot,    label: 'Coach' },
    { id: 'galeria', icon: Images, label: 'Galeria' },
  ]},
]
