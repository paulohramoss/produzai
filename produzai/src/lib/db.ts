// Barrel dos módulos de db/ — ponto de entrada único para os 28 importadores.
//
// Nenhuma implementação mora aqui: tudo vive em src/lib/db/*.ts, separado por
// domínio. Este arquivo só re-exporta, então quem importa de 'lib/db' continua
// enxergando a mesma superfície de antes.
//
// O uid da sessão vive em db/client.ts e em nenhum outro lugar. Módulo novo
// nunca declara o próprio `currentUid`: importa `getDbUid()` de lá.

export { setDbUid } from './db/client'
export { deleteAllUserData } from './db/account'
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
