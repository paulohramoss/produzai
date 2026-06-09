import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { ManualWorkout } from '../store/useWorkoutStore'
import type { WebDietData } from '../store/useWebDietStore'

let currentUid = ''
export function setDbUid(uid: string) { currentUid = uid }

// Paths: users/{uid}/data/{docName}  ou  users/{uid}/{sub}/{docId}
function dataRef(name: string) {
  return doc(db, 'users', currentUid, 'data', name)
}
function subRef(sub: string, id: string) {
  return doc(db, 'users', currentUid, sub, id)
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  onboardingDone: boolean
  createdAt?: number
}

export async function getProfile(): Promise<UserProfile | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('profile'))
    return snap.exists() ? (snap.data() as UserProfile) : null
  } catch { return null }
}

export async function saveProfile(data: Partial<UserProfile>) {
  if (!currentUid) return
  try { await setDoc(dataRef('profile'), data, { merge: true }) } catch { /* silent */ }
}

// ── Workouts ─────────────────────────────────────────────────────────────────

export async function getWorkouts(): Promise<ManualWorkout[] | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('workouts'))
    return snap.exists() ? ((snap.data().items as ManualWorkout[]) ?? []) : null
  } catch { return null }
}

export async function saveWorkouts(workouts: ManualWorkout[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('workouts'), { items: workouts }) } catch { /* silent */ }
}

// ── Diet ─────────────────────────────────────────────────────────────────────

export async function getDiet(): Promise<WebDietData | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('diet'))
    return snap.exists() ? (snap.data() as WebDietData) : null
  } catch { return null }
}

export async function saveDiet(data: WebDietData | null) {
  if (!currentUid || !data) return
  try { await setDoc(dataRef('diet'), data) } catch { /* silent */ }
}

// ── Daily (hábitos + foco) ────────────────────────────────────────────────────

export interface Habit { id: string; icon: string; label: string; done: boolean }
export interface FocusItem { id: string; text: string; done: boolean }
export interface DailyData { habits?: Habit[]; focus?: FocusItem[] }

export async function getDaily(date: string): Promise<DailyData | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(subRef('daily', date))
    return snap.exists() ? (snap.data() as DailyData) : null
  } catch { return null }
}

export async function saveDaily(date: string, data: DailyData) {
  if (!currentUid) return
  try { await setDoc(subRef('daily', date), data) } catch { /* silent */ }
}

// ── Mental ───────────────────────────────────────────────────────────────────

export interface MentalEntry {
  mood: number
  energy: number
  gratitude: [string, string, string]
  note: string
}

export async function getMental(date: string): Promise<MentalEntry | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(subRef('mental', date))
    return snap.exists() ? (snap.data() as MentalEntry) : null
  } catch { return null }
}

export async function saveMental(date: string, data: MentalEntry) {
  if (!currentUid) return
  try { await setDoc(subRef('mental', date), data) } catch { /* silent */ }
}

export async function getMentalHistory(dates: string[]): Promise<Record<string, MentalEntry>> {
  const result: Record<string, MentalEntry> = {}
  await Promise.all(dates.map(async d => {
    const e = await getMental(d)
    if (e) result[d] = e
  }))
  return result
}

// ── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string
  category: 'saude' | 'trabalho' | 'pessoal' | 'aprendizado'
  progress: number
  priority: 'alta' | 'media' | 'baixa'
  dueDate: string
}

export async function getProjects(): Promise<Project[] | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('projects'))
    return snap.exists() ? ((snap.data().items as Project[]) ?? []) : null
  } catch { return null }
}

export async function saveProjects(projects: Project[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('projects'), { items: projects }) } catch { /* silent */ }
}

// ── Books ────────────────────────────────────────────────────────────────────

export interface Book {
  id: string
  title: string
  author: string
  category: string
  pages: number
  pagesRead: number
  status: 'lendo' | 'quero' | 'pausado' | 'concluido'
  rating: number
}

export async function getBooks(): Promise<Book[] | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('books'))
    return snap.exists() ? ((snap.data().items as Book[]) ?? []) : null
  } catch { return null }
}

export async function saveBooks(books: Book[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('books'), { items: books }) } catch { /* silent */ }
}

// ── Habit definitions ─────────────────────────────────────────────────────────

export interface HabitDef { id: string; icon: string; label: string }

export async function getHabitDefs(): Promise<HabitDef[] | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('habitDefs'))
    return snap.exists() ? ((snap.data().items as HabitDef[]) ?? []) : null
  } catch { return null }
}

export async function saveHabitDefs(defs: HabitDef[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('habitDefs'), { items: defs }) } catch { /* silent */ }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  uid: string
  displayName: string
  xp: number
  streakDays: number
  weeklyWorkouts: number
  updatedAt: number
}

export async function upsertLeaderboard(entry: LeaderboardEntry) {
  try {
    await setDoc(doc(db, 'leaderboard', entry.uid), entry, { merge: true })
  } catch { /* silent */ }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const { getDocs, collection, query, orderBy, limit } = await import('firebase/firestore')
    const q = query(collection(db, 'leaderboard'), orderBy('xp', 'desc'), limit(10))
    const snap = await getDocs(q)
    return snap.docs.map(d => d.data() as LeaderboardEntry)
  } catch { return [] }
}

// ── Progress photos ───────────────────────────────────────────────────────────

export interface ProgressPhoto {
  id: string
  url: string
  date: string
  weight?: number
  caption: string
}

export async function getProgressPhotos(): Promise<ProgressPhoto[]> {
  if (!currentUid) return []
  try {
    const snap = await getDoc(dataRef('progress'))
    return snap.exists() ? ((snap.data().items as ProgressPhoto[]) ?? []) : []
  } catch { return [] }
}

export async function saveProgressPhotos(photos: ProgressPhoto[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('progress'), { items: photos }) } catch { /* silent */ }
}
