// Barrel dos módulos de db/ — ponto de entrada único para os 28 importadores.
//
// As funções estão sendo movidas para src/lib/db/*.ts, um domínio por vez. Este
// arquivo re-exporta tudo, então nenhum importador precisa mudar e o que ainda
// não foi movido continua morando aqui embaixo.
//
// O uid da sessão vive em db/client.ts e em nenhum outro lugar — o que ainda
// está neste arquivo lê pelo mesmo `getDbUid()` que os módulos já extraídos.

import { doc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { forgetChallengeEntry } from './challengeApi'
import { getProfile } from './db/profile'
import { getMyClubId } from './db/social'

export { setDbUid } from './db/client'
export { type Project, getProjects, saveProjects } from './db/misc'
export { getWeekPlan, saveWeekPlan } from './db/misc'
export { type ReminderPrefs, getReminderPrefs, saveReminderPrefs } from './db/misc'
export { type Book, getBooks, saveBooks } from './db/misc'
export { savePushSubscription, getPushSubscription, deletePushSubscription } from './db/misc'
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
