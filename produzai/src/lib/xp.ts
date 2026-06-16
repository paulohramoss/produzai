import type { ManualWorkout } from '../store/useWorkoutStore'

// ── Week utilities ─────────────────────────────────────────────────────────────

export function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function getWeekWorkouts(workouts: ManualWorkout[]): ManualWorkout[] {
  const now = new Date()
  const day = now.getDay() || 7
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - day + 1)
  weekStart.setHours(0, 0, 0, 0)
  return workouts.filter(w => {
    const [y, m, d] = w.rawDate.split('-').map(Number)
    return new Date(y, m - 1, d) >= weekStart
  })
}

// ── XP formula (anti-cheat) ───────────────────────────────────────────────────
// Cap: max 2 workouts per calendar day count for XP.
// Quality bonuses for calorie burn and distance reward real effort over volume.

const MAX_PER_DAY = 2

function workoutXP(w: ManualWorkout): number {
  let xp = 100
  if (w.cal >= 500) xp += 75
  else if (w.cal >= 300) xp += 50
  else if (w.cal >= 150) xp += 25
  if (w.dist >= 10) xp += 50
  else if (w.dist >= 5) xp += 30
  return xp
}

export function computeXP(workouts: ManualWorkout[]): number {
  const byDate = new Map<string, ManualWorkout[]>()
  for (const w of workouts) {
    if (!byDate.has(w.rawDate)) byDate.set(w.rawDate, [])
    byDate.get(w.rawDate)!.push(w)
  }
  let total = 0
  for (const day of byDate.values()) {
    for (const w of day.slice(0, MAX_PER_DAY)) total += workoutXP(w)
  }
  return total
}

// ── Streak ────────────────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeStreak(workouts: ManualWorkout[]): number {
  if (workouts.length === 0) return 0
  const dates = new Set(workouts.map(w => w.rawDate))
  const cur = new Date()
  cur.setHours(0, 0, 0, 0)
  // If no workout today, count back from yesterday
  if (!dates.has(toLocalISO(cur))) cur.setDate(cur.getDate() - 1)
  let streak = 0
  while (dates.has(toLocalISO(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

// ── Badges ────────────────────────────────────────────────────────────────────

export interface Badge {
  id: string
  icon: string
  name: string
  desc: string
  earnedAt: number | null
}

const BADGE_DEFS: Omit<Badge, 'earnedAt'>[] = [
  { id: 'first-blood',     icon: '🔥', name: 'Primeiro Passo',   desc: 'Registrou o primeiro treino' },
  { id: 'week-warrior',    icon: '⚡', name: '7 Dias Seguidos',   desc: 'Sequência de 7 dias de treino' },
  { id: 'iron-will',       icon: '🏆', name: 'Vontade de Ferro',  desc: 'Sequência de 30 dias de treino' },
  { id: 'centurion',       icon: '💯', name: 'Centurião',         desc: '100 treinos registrados' },
  { id: 'variety-pack',    icon: '🎯', name: 'Atleta Completo',   desc: '5 tipos de atividade diferentes' },
  { id: 'calorie-crusher', icon: '💪', name: 'Incinerador',       desc: 'Queimou 10.000 kcal no total' },
  { id: 'distance-king',   icon: '🏃', name: 'Maratonista',       desc: 'Acumulou 100km de distância' },
]

export function computeBadges(workouts: ManualWorkout[], streak: number): Badge[] {
  const totalCal = workouts.reduce((s, w) => s + w.cal, 0)
  const totalDist = workouts.reduce((s, w) => s + w.dist, 0)
  const uniqueTypes = new Set(workouts.map(w => w.type)).size
  return BADGE_DEFS.map(def => {
    let earned = false
    switch (def.id) {
      case 'first-blood':     earned = workouts.length >= 1;   break
      case 'week-warrior':    earned = streak >= 7;            break
      case 'iron-will':       earned = streak >= 30;           break
      case 'centurion':       earned = workouts.length >= 100; break
      case 'variety-pack':    earned = uniqueTypes >= 5;       break
      case 'calorie-crusher': earned = totalCal >= 10000;      break
      case 'distance-king':   earned = totalDist >= 100;       break
    }
    return { ...def, earnedAt: earned ? Date.now() : null }
  })
}
