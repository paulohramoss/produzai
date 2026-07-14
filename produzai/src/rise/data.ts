import type { CSSProperties } from 'react'
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

// ── Scale tokens ─────────────────────────────────────────────────────────────
// Spacing / radius / type scale. Single source of truth for non-color design
// values; mirrored by the fontSize + borderRadius scales in tailwind.config.js.
// The scale intentionally covers every size in real use so inline styles can be
// tokenized WITHOUT changing pixels. Use: fontSize: T.text.md, borderRadius: T.radius.xl.
export const T = {
  space:  { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: {
    '2xs': 4, xs: 6, sm: 8, md: 10, lg: 12, xl: 14, '2xl': 16, '3xl': 18, '4xl': 20,
    pill: 999,
  },
  text: {
    '2xs': 9, xs: 10, sm: 11, base: 12, md: 13, lg: 14, xl: 15, '2xl': 16,
    '3xl': 18, '4xl': 20, '5xl': 22, '6xl': 26, '7xl': 32,
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
} as const

// ── Typography ───────────────────────────────────────────────────────────────
// Archivo is the display face (titles + signature numbers); Open Sans the body.
// The display look comes from the EXPANDED width axis (wdth 112) — spread
// `displayStyle` onto a heading/number and keep your own fontSize/weight/color.
export const F = {
  display: '"Archivo", "Open Sans", system-ui, sans-serif',
  body:    '"Open Sans", system-ui, sans-serif',
} as const

export const displayStyle: CSSProperties = {
  fontFamily: F.display,
  fontVariationSettings: '"wdth" 112',
  letterSpacing: '-0.015em',
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
