// Barrel dos módulos de db/ — ponto de entrada único para os 28 importadores.
//
// As funções estão sendo movidas para src/lib/db/*.ts, um domínio por vez. Este
// arquivo re-exporta tudo, então nenhum importador precisa mudar e o que ainda
// não foi movido continua morando aqui embaixo.
//
// O uid da sessão vive em db/client.ts e em nenhum outro lugar — o que ainda
// está neste arquivo lê pelo mesmo `getDbUid()` que os módulos já extraídos.

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import type { PlannedSession } from './weekPlan'
import { forgetChallengeEntry } from './challengeApi'
import { dataRef, logDbError, fireWrite, getDbUid } from './db/client'
import { getProfile } from './db/profile'
import { getMyClubId } from './db/social'

export { setDbUid } from './db/client'
export { type ProgressPhoto, getProgressPhotos, saveProgressPhotos } from './db/media'
export { getCycle, saveCycle } from './db/cycle'
export { type CoachShareWorkout, type CoachShareDay, type CoachShareSnapshot, saveCoachShare, getCoachShare, deleteCoachShare } from './db/coach'
export { type CoachConversationsRead, getCoachConversations, saveCoachConversations } from './db/coach'
export { type LeaderboardEntry, upsertLeaderboard, getLeaderboard } from './db/social'
export { getFriends, addFriend, removeFriend, lookupByInviteCode, getFriendLeaderboard } from './db/social'
export { type ChallengeEntry, getChallengeLeaderboard } from './db/social'
export { type Club, type JoinClubResult, CLUB_MAX_MEMBERS, createClub, getClub, getMyClubId, joinClub, leaveClub, updateClubGoal } from './db/social'
export { type TrainingJournalEntry, getJournalEntry, saveJournalEntry, getJournalHistory } from './db/journal'
export { type WeeklyReview, getWeeklyReviews, saveWeeklyReview } from './db/journal'
export { type JournalInsight, getJournalInsights, saveJournalInsight } from './db/journal'
export { type MentalEntry, getMental, saveMental, getMentalHistory } from './db/mental'
export { type Habit, type FocusItem, type ReadinessEntry, type DailyData, getDaily, saveDaily, getDailyHistory } from './db/daily'
export { type HabitDef, getHabitDefs, saveHabitDefs } from './db/daily'
export { getDiet, saveDiet, type HydrationSettings, getHydration, saveHydration } from './db/diet'
export { type UserProfile, type ActivityLevel, getProfile, saveProfile } from './db/profile'
export { type WeightEntry, getWeightLog, saveWeightLog } from './db/profile'
export { getWorkouts, saveWorkouts } from './db/workouts'

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
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('projects'))
    return snap.exists() ? ((snap.data().items as Project[]) ?? []) : null
  } catch (e) { logDbError('getProjects', e); return null }
}

export async function saveProjects(projects: Project[]) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('projects'), { items: projects }), 'saveProjects')
}

// ── Plano da semana ──────────────────────────────────────────────────────────
// Grade fixa por dia da semana que se repete — ver lib/weekPlan.ts.

export async function getWeekPlan(): Promise<PlannedSession[] | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('weekPlan'))
    return snap.exists() ? ((snap.data().items as PlannedSession[]) ?? []) : null
  } catch (e) { logDbError('getWeekPlan', e); return null }
}

export async function saveWeekPlan(items: PlannedSession[]) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('weekPlan'), { items }), 'saveWeekPlan')
}

// ── Preferências de lembrete ─────────────────────────────────────────────────
// Ficam na nuvem (e não só no localStorage) porque o cron de push precisa
// saber a que horas avisar cada usuário — ver api/push/cron.js.

export interface ReminderPrefs {
  enabled: boolean
  /** Lembrete geral da manhã, "HH:MM". */
  morning: string | null
  /** Nudge do fim da noite quando o dia não foi registrado, "HH:MM". */
  eveningNudge: string | null
  /** Aviso quando a sequência está prestes a quebrar, "HH:MM". */
  streakAlert: string | null
  /** Horário por hábito: { [habitId]: "HH:MM" }. */
  habitTimes: Record<string, string>
  /** Fuso do usuário, para o servidor disparar na hora local certa. */
  timeZoneOffsetMin?: number
}

export async function getReminderPrefs(): Promise<ReminderPrefs | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('reminderPrefs'))
    return snap.exists() ? (snap.data() as ReminderPrefs) : null
  } catch (e) { logDbError('getReminderPrefs', e); return null }
}

export async function saveReminderPrefs(prefs: ReminderPrefs) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('reminderPrefs'), prefs), 'saveReminderPrefs')
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
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('books'))
    return snap.exists() ? ((snap.data().items as Book[]) ?? []) : null
  } catch (e) { logDbError('getBooks', e); return null }
}

export async function saveBooks(books: Book[]) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('books'), { items: books }), 'saveBooks')
}

// ── Push subscription (Web Push VAPID) ───────────────────────────────────────

export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('pushSubscription'), sub as Record<string, unknown>), 'savePushSubscription')
}

export async function getPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('pushSubscription'))
    return snap.exists() ? (snap.data() as PushSubscriptionJSON) : null
  } catch (e) { logDbError('getPushSubscription', e); return null }
}

export async function deletePushSubscription(): Promise<void> {
  if (!getDbUid()) return
  try { await deleteDoc(dataRef('pushSubscription')) } catch (e) { logDbError('deletePushSubscription', e) }
}

// ── Account deletion (LGPD Art. 18, IV) ──────────────────────────────────────

export async function deleteAllUserData(uid: string): Promise<void> {
  const DATA_DOCS = [
    'profile', 'workouts', 'diet', 'projects', 'books',
    'habitDefs', 'progress', 'hydration', 'weeklyReviews', 'pushSubscription', 'friends',
    'coachConversations', 'weightLog', 'weekPlan', 'reminderPrefs', 'cycle', 'journalInsights',
    'club',
  ]

  // O resumo do treinador vive fora de users/{uid} e ficaria público para sempre
  // se não fosse apagado aqui. Lido ANTES do perfil sumir — é ele que tem o token.
  const shareToken = (await getProfile())?.coachShareToken
  if (shareToken) await deleteDoc(doc(db, 'coachShares', shareToken)).catch(() => {})

  // O clube também vive fora de users/{uid}: sem esta saída o uid apagado
  // continuaria contando na meta coletiva de um grupo que ele não integra mais.
  const clubId = await getMyClubId()
  if (clubId) {
    const { arrayRemove, updateDoc } = await import('firebase/firestore')
    await updateDoc(doc(db, 'clubs', clubId), { memberUids: arrayRemove(uid) }).catch(() => {})
  }

  await Promise.all(
    DATA_DOCS.map(name =>
      deleteDoc(doc(db, 'users', uid, 'data', name)).catch(() => {}),
    ),
  )

  const [dailySnap, mentalSnap, journalSnap, dailyMonthlySnap, mentalMonthlySnap, journalMonthlySnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'daily')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'mental')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'journal')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'dailyMonthly')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'mentalMonthly')).catch(() => null),
    getDocs(collection(db, 'users', uid, 'journalMonthly')).catch(() => null),
  ])

  await Promise.all([
    ...(dailySnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(mentalSnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(journalSnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(dailyMonthlySnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(mentalMonthlySnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    ...(journalMonthlySnap?.docs ?? []).map(({ ref }) => deleteDoc(ref).catch(() => {})),
    deleteDoc(doc(db, 'leaderboard', uid)).catch(() => {}),
    // A entrada no placar do desafio é do servidor: o cliente não tem permissão
    // de apagá-la e precisa pedir. Sem esta chamada o nome ficaria no ranking
    // de um usuário que já não existe.
    forgetChallengeEntry(),
  ])
}
