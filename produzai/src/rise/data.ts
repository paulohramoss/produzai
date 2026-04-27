export const C = {
  bg: "#0C0C0C", card: "#141414", card2: "#1C1C1C", card3: "#222",
  border: "#252525", border2: "#2E2E2E",
  text: "#F0F0F0", muted: "#666", muted2: "#999",
  orange: "#F97316", od: "rgba(249,115,22,.11)",
  green: "#22C55E", blue: "#60A5FA", purple: "#A78BFA", pink: "#F472B6",
  red: "#EF4444",
  strava: "#FC4C02", webdiet: "#00A651",
}

export type Page =
  | "dashboard" | "hoje" | "treino" | "dieta" | "agenda"
  | "projetos" | "mental" | "biblioteca"
  | "integracoes" | "strava" | "webdiet" | "coach"
  // ProduzAI pages
  // | "chat" | "habits" | "finance" | "calendar" | "investments" | "goals" | "reports" | "settings"

//export const PRODUZAI_PAGES: Page[] = ["chat", "habits", "finance", "calendar", "investments", "goals", "reports", "settings"]

export interface NavItem {
  id: Page
  icon: string
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
  { label: "INÍCIO", items: [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "hoje", icon: "☀️", label: "Hoje" },
  ]},
  { label: "EXECUÇÃO", items: [
    { id: "treino", icon: "🏋", label: "Treino" },
    { id: "dieta", icon: "🥗", label: "Dieta" },
    { id: "agenda", icon: "📅", label: "Agenda" },
  ]},
  { label: "CRESCIMENTO", items: [
    { id: "projetos", icon: "🎯", label: "Projetos" },
    { id: "mental", icon: "🧠", label: "Mental" },
    { id: "biblioteca", icon: "📚", label: "Biblioteca" },
  ]},
  { label: "DADOS EXTERNOS", items: [
    { id: "integracoes", icon: "🔗", label: "Integrações" },
    { id: "strava", icon: "🏃", label: "Strava", color: C.strava, badge: true },
    { id: "webdiet", icon: "🥗", label: "WebDiet", color: C.webdiet, badge: true },
  ]},
  { label: "SUPORTE", items: [
    { id: "coach", icon: "🤖", label: "Coach IA" },
  ]},
  // { label: "PRODUZAI", items: [
  //   { id: "chat", icon: "💬", label: "Nexus IA" },
  //   { id: "habits", icon: "✅", label: "Hábitos" },
  //   { id: "finance", icon: "💰", label: "Financeiro" },
  //   { id: "calendar", icon: "📆", label: "Calendário" },
  //   { id: "investments", icon: "📈", label: "Investimentos" },
  //   { id: "goals", icon: "⭐", label: "Sonhos" },
  //   { id: "reports", icon: "📊", label: "Relatórios" },
  //   { id: "settings", icon: "⚙️", label: "Configurações" },
  // ]},
]
