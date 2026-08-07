import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { ManualWorkout } from '../store/useWorkoutStore'
import type { WebDietData } from '../store/useWebDietStore'
import type { CoachConversation } from '../store/useCoachStore'
import type { AthleteProfile } from './athleteProfile'
import type { WorkoutAnalysis } from './workoutAnalysis'
import type { WorkoutSummaryResult } from './anthropic'
import type { TrainingPlan } from './plan'
import type { CoachSnapshot } from './coachSnapshot'

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

/**
 * Remove chaves com valor `undefined`.
 *
 * O Firestore REJEITA o documento inteiro se qualquer campo for `undefined`
 * (a instância não usa `ignoreUndefinedProperties`). Como as escritas ficam
 * dentro de try/catch, isso não estoura na tela — simplesmente nada é salvo,
 * que é o pior dos dois mundos. Campos opcionais montados a partir de
 * formulários (`campoVazio || undefined`) caem exatamente nesse caso.
 */
function stripUndefined<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as Partial<T>
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
  try {
    await setDoc(dataRef('profile'), stripUndefined(data), { merge: true })
  } catch (e) { logDbError('saveProfile', e) }
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

// ── Athlete profile (fisiologia) ─────────────────────────────────────────────

export async function getAthleteProfile(): Promise<AthleteProfile | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('athlete'))
    return snap.exists() ? (snap.data() as AthleteProfile) : null
  } catch (e) { logDbError('getAthleteProfile', e); return null }
}

export async function saveAthleteProfile(data: Partial<AthleteProfile>) {
  if (!currentUid) return
  try {
    await setDoc(dataRef('athlete'), stripUndefined(data), { merge: true })
  } catch (e) { logDbError('saveAthleteProfile', e) }
}

// ── Workout insights (análise + resumo de IA por treino) ─────────────────────
// Ficam em subcoleção, um doc por treino: o documento `workouts` já carrega a
// lista inteira e estouraria o limite de 1 MiB se acumulasse parciais e texto.

export interface WorkoutInsight {
  workoutId: string
  analysis: WorkoutAnalysis
  /** Ausente quando o usuário ainda não pediu a leitura da IA. */
  summary?: WorkoutSummaryResult
  generatedAt: number
}

export async function getWorkoutInsight(workoutId: string): Promise<WorkoutInsight | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(subRef('workoutInsights', workoutId))
    return snap.exists() ? (snap.data() as WorkoutInsight) : null
  } catch (e) { logDbError('getWorkoutInsight', e); return null }
}

export async function saveWorkoutInsight(insight: WorkoutInsight) {
  if (!currentUid) return
  try {
    await setDoc(subRef('workoutInsights', insight.workoutId), insight)
  } catch (e) { logDbError('saveWorkoutInsight', e) }
}

// ── Coach snapshot (coaching proativo) ───────────────────────────────────────
// Publicado pelo cliente, lido pelo cron. Ver `coachSnapshot.ts`.

export async function saveCoachSnapshot(snapshot: CoachSnapshot) {
  if (!currentUid) return
  try {
    await setDoc(dataRef('coachSnapshot'), snapshot as unknown as Record<string, unknown>)
  } catch (e) { logDbError('saveCoachSnapshot', e) }
}

/**
 * Liga o id de atleta do Strava ao uid, em coleção própria.
 * O webhook do Strava só recebe o id do atleta — sem este mapeamento não há
 * como saber de quem é a atividade que acabou de chegar.
 */
export async function linkStravaAthlete(athleteId: number) {
  if (!currentUid) return
  try {
    await setDoc(doc(db, 'stravaAthletes', String(athleteId)), {
      uid: currentUid,
      linkedAt: Date.now(),
    })
  } catch (e) { logDbError('linkStravaAthlete', e) }
}

export async function unlinkStravaAthlete(athleteId: number) {
  try {
    await deleteDoc(doc(db, 'stravaAthletes', String(athleteId)))
  } catch (e) { logDbError('unlinkStravaAthlete', e) }
}

// ── Training plan ────────────────────────────────────────────────────────────

export async function getTrainingPlan(): Promise<TrainingPlan | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('trainingPlan'))
    return snap.exists() ? (snap.data() as TrainingPlan) : null
  } catch (e) { logDbError('getTrainingPlan', e); return null }
}

export async function saveTrainingPlan(plan: TrainingPlan) {
  if (!currentUid) return
  try { await setDoc(dataRef('trainingPlan'), plan) } catch (e) { logDbError('saveTrainingPlan', e) }
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
  sleepHours?: number
  /** VFC (rMSSD) medida ao acordar, em ms. Só faz sentido comparada à própria base. */
  hrvMs?: number
  /** FC de repouso medida ao acordar, em bpm. */
  restingHr?: number
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

// ── Coach conversations ──────────────────────────────────────────────────────
// O histórico do Coach é espelhado no Firestore para que nunca dependa apenas do
// localStorage (que some ao limpar o navegador, trocar de aparelho ou navegar
// anônimo). É a fonte durável; o localStorage é só o cache local.

/** `items: null` = o documento ainda não existe. `ok: false` = falha de leitura
 *  (rede/permissão) — nesse caso o chamador NÃO deve sobrescrever a nuvem. */
export type CoachConversationsRead =
  | { ok: true; items: CoachConversation[] | null }
  | { ok: false }

export async function getCoachConversations(): Promise<CoachConversationsRead> {
  if (!currentUid) return { ok: false }
  try {
    const snap = await getDoc(dataRef('coachConversations'))
    return { ok: true, items: snap.exists() ? ((snap.data().items as CoachConversation[]) ?? []) : null }
  } catch (e) { logDbError('getCoachConversations', e); return { ok: false } }
}

// Um documento acima de 1 MiB é rejeitado inteiro pelo Firestore — o que
// perderia TODAS as conversas de uma vez. Guardamos folga sobre esse limite.
const COACH_DOC_MAX_BYTES = 900_000

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

export async function saveCoachConversations(conversations: CoachConversation[]) {
  if (!currentUid) return

  // O base64 dos anexos (vários MB) nunca vai para o Firestore — só o nome e o
  // tipo, o suficiente para a bolha continuar mostrando o arquivo depois.
  // Campos `undefined` são rejeitados pelo Firestore, por isso montamos o
  // objeto explicitamente em vez de espalhar a mensagem original.
  let items = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: c.messages.map(m => m.attachment
        ? {
            role: m.role,
            content: m.content,
            attachment: { name: m.attachment.name, mediaType: m.attachment.mediaType, data: '' },
          }
        : { role: m.role, content: m.content }),
    }))

  // Válvula de segurança: se ainda assim estourar, corta as conversas mais
  // antigas apenas da cópia na nuvem — o histórico completo continua local.
  while (items.length > 1 && byteLength(JSON.stringify(items)) > COACH_DOC_MAX_BYTES) {
    items = items.slice(0, -1)
  }

  try { await setDoc(dataRef('coachConversations'), { items }) } catch (e) { logDbError('saveCoachConversations', e) }
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
    'coachConversations', 'athlete', 'trainingPlan', 'coachSnapshot',
  ]

  await Promise.all(
    DATA_DOCS.map(name =>
      deleteDoc(doc(db, 'users', uid, 'data', name)).catch(() => {}),
    ),
  )

  const SUBCOLLECTIONS = ['daily', 'mental', 'dailyMonthly', 'mentalMonthly', 'workoutInsights']
  const snaps = await Promise.all(
    SUBCOLLECTIONS.map(name => getDocs(collection(db, 'users', uid, name)).catch(() => null)),
  )

  await Promise.all([
    ...snaps.flatMap(snap => (snap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {}))),
    deleteDoc(doc(db, 'leaderboard', uid)).catch(() => {}),
  ])
}
