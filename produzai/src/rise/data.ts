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

export const STRAVA = {
  lastSync: "Hoje 06:58",
  weekKm: 28.9, weekRuns: 3, weekCal: 1892, weekElev: 246,
  monthKm: 98.4, monthGoal: 120,
  pr5k: "24:10", pr10k: "50:32",
  activities: [
    { type: "Corrida", name: "Corrida matinal", date: "Hoje 06:42", dist: 8.3, pace: "5'12\"", time: "43:10", cal: 512, hr: 158, elev: 84 },
    { type: "Corrida", name: "Treino intervalado", date: "Ontem 07:15", dist: 6.1, pace: "4'48\"", time: "29:14", cal: 380, hr: 172, elev: 42 },
    { type: "Ciclismo", name: "Ciclismo fim de semana", date: "Sáb 08:00", dist: 34.2, pace: "22km/h", time: "1h33", cal: 820, hr: 144, elev: 310 },
  ] as Activity[],
  zones: [
    { z: "Z1 Fácil", pct: 18, c: "#60A5FA" },
    { z: "Z2 Base", pct: 35, c: "#22C55E" },
    { z: "Z3 Tempo", pct: 28, c: "#F97316" },
    { z: "Z4 Limiar", pct: 14, c: "#F97316" },
    { z: "Z5 VO2max", pct: 5, c: "#EF4444" },
  ] as Zone[],
}

export interface MealItem {
  time: string; name: string; cal: number
  prot: number; carb: number; fat: number
  done: boolean; items: string[]
}

export const WEBDIET = {
  lastSync: "Hoje 08:00",
  nutritionist: "Dra. Ana Souza",
  plan: [
    { time: "07:00", name: "Café da manhã", cal: 520, prot: 35, carb: 60, fat: 14, done: true, items: ["3 ovos mexidos", "Aveia 60g", "Banana"] },
    { time: "10:00", name: "Lanche manhã", cal: 280, prot: 28, carb: 22, fat: 10, done: true, items: ["Whey 1 scoop", "Maçã", "Castanha 30g"] },
    { time: "13:00", name: "Almoço", cal: 680, prot: 55, carb: 72, fat: 12, done: false, items: ["Frango 200g", "Arroz integral 80g", "Brócolis"] },
    { time: "16:00", name: "Pré-treino", cal: 380, prot: 32, carb: 44, fat: 5, done: false, items: ["Batata doce 150g", "Frango 150g"] },
    { time: "20:00", name: "Jantar", cal: 560, prot: 48, carb: 38, fat: 20, done: false, items: ["Salmão 180g", "Quinoa 60g", "Legumes"] },
  ] as MealItem[],
  macros: {
    cal: { cur: 800, goal: 2420 },
    prot: { cur: 63, goal: 205 },
    carb: { cur: 82, goal: 278 },
    fat: { cur: 24, goal: 68 },
  },
}

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
