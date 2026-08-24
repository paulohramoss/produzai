import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { forgetChallengeEntry } from '../challengeApi'
import { getProfile } from './profile'
import { getMyClubId } from './social'

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
