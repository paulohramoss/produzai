import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore'
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
// Monthly aggregation: users/{uid}/dailyMonthly/{yyyy-MM}
// Reduces 35 getDoc calls to 1-2 reads for the Insights history window.
function monthlyRef(sub: 'dailyMonthly' | 'mentalMonthly', ym: string) {
  return doc(db, 'users', currentUid, sub, ym)
}

function logDbError(fn: string, err: unknown) {
  console.error(`[db] ${fn}:`, err)
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  onboardingDone: boolean
  createdAt?: number
  consentAt?: number   // Unix ms — when the user accepted the privacy policy
  goals?: string[]
  values?: string[]
  onboardingSummary?: string
}

export async function getProfile(): Promise<UserProfile | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('profile'))
    return snap.exists() ? (snap.data() as UserProfile) : null
  } catch (e) { logDbError('getProfile', e); return null }
}

export async function saveProfile(data: Partial<UserProfile>) {
  if (!currentUid) return
  try { await setDoc(dataRef('profile'), data, { merge: true }) } catch (e) { logDbError('saveProfile', e) }
}

// ── Workouts ─────────────────────────────────────────────────────────────────

export async function getWorkouts(): Promise<ManualWorkout[] | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('workouts'))
    return snap.exists() ? ((snap.data().items as ManualWorkout[]) ?? []) : null
  } catch (e) { logDbError('getWorkouts', e); return null }
}

export async function saveWorkouts(workouts: ManualWorkout[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('workouts'), { items: workouts }) } catch (e) { logDbError('saveWorkouts', e) }
}

// ── Diet ─────────────────────────────────────────────────────────────────────

export async function getDiet(): Promise<WebDietData | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('diet'))
    return snap.exists() ? (snap.data() as WebDietData) : null
  } catch (e) { logDbError('getDiet', e); return null }
}

export async function saveDiet(data: WebDietData | null) {
  if (!currentUid || !data) return
  try { await setDoc(dataRef('diet'), data) } catch (e) { logDbError('saveDiet', e) }
}

// ── Daily (hábitos + foco) ────────────────────────────────────────────────────

export interface Habit { id: string; icon: string; label: string; done: boolean }
export interface FocusItem { id: string; text: string; done: boolean }
export interface DailyData { habits?: Habit[]; focus?: FocusItem[]; waterMl?: number }

export async function getDaily(date: string): Promise<DailyData | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(subRef('daily', date))
    return snap.exists() ? (snap.data() as DailyData) : null
  } catch (e) { logDbError('getDaily', e); return null }
}

export async function saveDaily(date: string, data: Partial<DailyData>) {
  if (!currentUid) return
  const ym = date.slice(0, 7)
  const mRef = monthlyRef('dailyMonthly', ym)
  // Build dot-notation keys so partial writes don't overwrite sibling fields
  // e.g. { 'waterMl': 500 } becomes { '2026-06-16.waterMl': 500 } in the monthly doc
  const dotData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) dotData[`${date}.${k}`] = v
  }
  try {
    await updateDoc(mRef, dotData)
  } catch {
    // Doc doesn't exist yet for this month — create it
    try { await setDoc(mRef, { [date]: data }) } catch (e) { logDbError('saveDaily/monthly-create', e) }
  }
  // Keep writing individual doc during transition so existing reads still work
  try { await setDoc(subRef('daily', date), data, { merge: true }) } catch (e) { logDbError('saveDaily/individual', e) }
}

export async function getDailyHistory(dates: string[]): Promise<Record<string, DailyData>> {
  if (!currentUid || dates.length === 0) return {}
  try {
    // 35 days spans at most 2 calendar months → 1-2 reads instead of 35
    const months = [...new Set(dates.map(d => d.slice(0, 7)))]
    const snaps = await Promise.all(months.map(ym => getDoc(monthlyRef('dailyMonthly', ym))))
    const result: Record<string, DailyData> = {}
    for (const snap of snaps) {
      if (snap.exists()) Object.assign(result, snap.data() as Record<string, DailyData>)
    }
    // Fall back to individual docs for dates not yet in monthly docs (pre-migration data)
    const missing = dates.filter(d => !result[d])
    if (missing.length > 0) {
      await Promise.all(missing.map(async d => {
        const e = await getDaily(d)
        if (e) result[d] = e
      }))
    }
    return result
  } catch (e) { logDbError('getDailyHistory', e); return {} }
}

// ── Mental ───────────────────────────────────────────────────────────────────

export interface MentalEntry {
  mood: number
  energy: number
  gratitude: [string, string, string]
  note: string
  reflectionQuestion?: string
  reflectionAnswer?: string
}

export async function getMental(date: string): Promise<MentalEntry | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(subRef('mental', date))
    return snap.exists() ? (snap.data() as MentalEntry) : null
  } catch (e) { logDbError('getMental', e); return null }
}

export async function saveMental(date: string, data: MentalEntry) {
  if (!currentUid) return
  const ym = date.slice(0, 7)
  // MentalEntry is always a complete object, so top-level merge is safe
  try { await setDoc(monthlyRef('mentalMonthly', ym), { [date]: data }, { merge: true }) } catch (e) { logDbError('saveMental/monthly', e) }
  try { await setDoc(subRef('mental', date), data) } catch (e) { logDbError('saveMental/individual', e) }
}

export async function getMentalHistory(dates: string[]): Promise<Record<string, MentalEntry>> {
  if (!currentUid || dates.length === 0) return {}
  try {
    const months = [...new Set(dates.map(d => d.slice(0, 7)))]
    const snaps = await Promise.all(months.map(ym => getDoc(monthlyRef('mentalMonthly', ym))))
    const result: Record<string, MentalEntry> = {}
    for (const snap of snaps) {
      if (snap.exists()) Object.assign(result, snap.data() as Record<string, MentalEntry>)
    }
    const missing = dates.filter(d => !result[d])
    if (missing.length > 0) {
      await Promise.all(missing.map(async d => {
        const e = await getMental(d)
        if (e) result[d] = e
      }))
    }
    return result
  } catch (e) { logDbError('getMentalHistory', e); return {} }
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
  } catch (e) { logDbError('getProjects', e); return null }
}

export async function saveProjects(projects: Project[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('projects'), { items: projects }) } catch (e) { logDbError('saveProjects', e) }
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
  } catch (e) { logDbError('getBooks', e); return null }
}

export async function saveBooks(books: Book[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('books'), { items: books }) } catch (e) { logDbError('saveBooks', e) }
}

// ── Habit definitions ─────────────────────────────────────────────────────────

export interface HabitDef {
  id: string
  icon: string
  label: string
  /** O "porquê" — intenção/valor por trás do hábito */
  why?: string
  createdAt?: number
}

export async function getHabitDefs(): Promise<HabitDef[] | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('habitDefs'))
    return snap.exists() ? ((snap.data().items as HabitDef[]) ?? []) : null
  } catch (e) { logDbError('getHabitDefs', e); return null }
}

export async function saveHabitDefs(defs: HabitDef[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('habitDefs'), { items: defs }) } catch (e) { logDbError('saveHabitDefs', e) }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  uid: string
  displayName: string
  xp: number
  streakDays: number
  weeklyWorkouts: number
  weeklyXP: number
  weekKey: string      // ISO week key e.g. "2026-W24"
  inviteCode: string   // uid.slice(0,6).toUpperCase() — for friend lookup
  updatedAt: number
}

export async function upsertLeaderboard(entry: LeaderboardEntry) {
  try {
    await setDoc(doc(db, 'leaderboard', entry.uid), entry, { merge: true })
  } catch (e) { logDbError('upsertLeaderboard', e) }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const { getDocs, collection, query, orderBy, limit } = await import('firebase/firestore')
    const q = query(collection(db, 'leaderboard'), orderBy('xp', 'desc'), limit(10))
    const snap = await getDocs(q)
    return snap.docs.map(d => d.data() as LeaderboardEntry)
  } catch (e) { logDbError('getLeaderboard', e); return [] }
}

// ── Friends ───────────────────────────────────────────────────────────────────

export async function getFriends(): Promise<string[]> {
  if (!currentUid) return []
  try {
    const snap = await getDoc(dataRef('friends'))
    return snap.exists() ? ((snap.data().uids as string[]) ?? []) : []
  } catch (e) { logDbError('getFriends', e); return [] }
}

export async function addFriend(friendUid: string): Promise<void> {
  if (!currentUid) return
  const existing = await getFriends()
  if (existing.includes(friendUid)) return
  try { await setDoc(dataRef('friends'), { uids: [...existing, friendUid] }) } catch (e) { logDbError('addFriend', e) }
}

export async function removeFriend(friendUid: string): Promise<void> {
  if (!currentUid) return
  const existing = await getFriends()
  try { await setDoc(dataRef('friends'), { uids: existing.filter(u => u !== friendUid) }) } catch (e) { logDbError('removeFriend', e) }
}

export async function lookupByInviteCode(code: string): Promise<LeaderboardEntry | null> {
  try {
    const { getDocs, collection, query, where } = await import('firebase/firestore')
    const q = query(collection(db, 'leaderboard'), where('inviteCode', '==', code.toUpperCase()))
    const snap = await getDocs(q)
    if (snap.empty) return null
    return snap.docs[0].data() as LeaderboardEntry
  } catch (e) { logDbError('lookupByInviteCode', e); return null }
}

export async function getFriendLeaderboard(uids: string[]): Promise<LeaderboardEntry[]> {
  if (uids.length === 0) return []
  try {
    const results = await Promise.all(
      uids.map(uid =>
        getDoc(doc(db, 'leaderboard', uid)).then(s => (s.exists() ? s.data() as LeaderboardEntry : null)),
      ),
    )
    return results.filter((e): e is LeaderboardEntry => e !== null)
  } catch (e) { logDbError('getFriendLeaderboard', e); return [] }
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
  } catch (e) { logDbError('getProgressPhotos', e); return [] }
}

export async function saveProgressPhotos(photos: ProgressPhoto[]) {
  if (!currentUid) return
  try { await setDoc(dataRef('progress'), { items: photos }) } catch (e) { logDbError('saveProgressPhotos', e) }
}

// ── Hydration ────────────────────────────────────────────────────────────────

export interface HydrationSettings { goalMl: number }

export async function getHydration(): Promise<HydrationSettings | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('hydration'))
    return snap.exists() ? (snap.data() as HydrationSettings) : null
  } catch (e) { logDbError('getHydration', e); return null }
}

export async function saveHydration(data: HydrationSettings) {
  if (!currentUid) return
  try { await setDoc(dataRef('hydration'), data) } catch (e) { logDbError('saveHydration', e) }
}

// ── Weekly reviews ───────────────────────────────────────────────────────────

export interface WeeklyReview {
  weekKey: string      // "YYYY-Www" (ISO week)
  generatedAt: number
  summary: string
  wins: string[]
  slips: string[]
  question: string
  adjustment: string
}

export async function getWeeklyReviews(): Promise<WeeklyReview[]> {
  if (!currentUid) return []
  try {
    const snap = await getDoc(dataRef('weeklyReviews'))
    return snap.exists() ? ((snap.data().items as WeeklyReview[]) ?? []) : []
  } catch (e) { logDbError('getWeeklyReviews', e); return [] }
}

export async function saveWeeklyReview(review: WeeklyReview) {
  if (!currentUid) return
  try {
    const existing = await getWeeklyReviews()
    const next = [review, ...existing.filter(r => r.weekKey !== review.weekKey)].slice(0, 26)
    await setDoc(dataRef('weeklyReviews'), { items: next })
  } catch (e) { logDbError('saveWeeklyReview', e) }
}

// ── Push subscription (Web Push VAPID) ───────────────────────────────────────

export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  if (!currentUid) return
  try { await setDoc(dataRef('pushSubscription'), sub as Record<string, unknown>) } catch (e) { logDbError('savePushSubscription', e) }
}

export async function getPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('pushSubscription'))
    return snap.exists() ? (snap.data() as PushSubscriptionJSON) : null
  } catch (e) { logDbError('getPushSubscription', e); return null }
}

export async function deletePushSubscription(): Promise<void> {
  if (!currentUid) return
  try { await deleteDoc(dataRef('pushSubscription')) } catch (e) { logDbError('deletePushSubscription', e) }
}

// ── Account deletion (LGPD Art. 18, IV) ──────────────────────────────────────

export async function deleteAllUserData(uid: string): Promise<void> {
  const DATA_DOCS = [
    'profile', 'workouts', 'diet', 'projects', 'books',
    'habitDefs', 'progress', 'hydration', 'weeklyReviews', 'pushSubscription', 'friends',
  ]

  await Promise.all(
    DATA_DOCS.map(name =>
      deleteDoc(doc(db, 'users', uid, 'data', name)).catch(() => {}),
    ),
  )

  const [dailySnap, mentalSnap, dailyMonthlySnap, mentalMonthlySnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'daily')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'mental')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'dailyMonthly')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'mentalMonthly')).catch(() => null),
  ])

  await Promise.all([
    ...(dailySnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(mentalSnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(dailyMonthlySnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(mentalMonthlySnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    deleteDoc(doc(db, 'leaderboard', uid)).catch(() => {}),
  ])
}
