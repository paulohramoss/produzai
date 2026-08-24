import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  uid: string
  displayName: string
  xp: number
  streakDays: number
  weeklyWorkouts: number
  weeklyXP: number
  weekKey: string      // ISO week key e.g. "2026-W24"
  monthlyWorkouts: number
  monthKey: string     // "2026-08" — alimenta a meta coletiva do clube
  inviteCode: string   // uid.slice(0,6).toUpperCase() — for friend lookup
  updatedAt: number
}

export async function upsertLeaderboard(entry: LeaderboardEntry) {
  try {
    fireWrite(setDoc(doc(db, 'leaderboard', entry.uid), entry, { merge: true }), 'upsertLeaderboard')
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
  if (!getDbUid()) return []
  try {
    const snap = await getDoc(dataRef('friends'))
    return snap.exists() ? ((snap.data().uids as string[]) ?? []) : []
  } catch (e) { logDbError('getFriends', e); return [] }
}

export async function addFriend(friendUid: string): Promise<void> {
  if (!getDbUid()) return
  const existing = await getFriends()
  if (existing.includes(friendUid)) return
  fireWrite(setDoc(dataRef('friends'), { uids: [...existing, friendUid] }), 'addFriend')
}

export async function removeFriend(friendUid: string): Promise<void> {
  if (!getDbUid()) return
  const existing = await getFriends()
  fireWrite(setDoc(dataRef('friends'), { uids: existing.filter(u => u !== friendUid) }), 'removeFriend')
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

// ── Desafio ───────────────────────────────────────────────────────────────────
// challenges/{challengeId}/entries/{uid} — um placar por desafio, que morre
// junto com ele.
//
// ESTE MÓDULO SÓ LÊ. A escrita é exclusiva do servidor (api/challenge/sync.js),
// e as regras do Firestore negam qualquer escrita vinda do cliente. O motivo
// está no cabeçalho daquele arquivo: o placar precisa do relógio do servidor
// para valer alguma coisa, porque os treinos que o alimentam são gravados pelo
// próprio usuário e ele pode inventá-los.

export interface ChallengeEntry {
  uid: string
  displayName: string
  /** Dias confirmados pelo servidor dentro da janela do desafio. */
  daysDone: number
  /** Os dias em si, "YYYY-MM-DD" em ordem crescente. */
  confirmedDays?: string[]
  /** Último dia que contou — desempate por quem chegou primeiro. */
  lastDay: string
  updatedAt: number
}

export async function getChallengeLeaderboard(challengeId: string): Promise<ChallengeEntry[]> {
  try {
    const { getDocs, collection, query, orderBy, limit } = await import('firebase/firestore')
    const q = query(
      collection(db, 'challenges', challengeId, 'entries'),
      orderBy('daysDone', 'desc'),
      limit(20),
    )
    const snap = await getDocs(q)
    // Empate em dias vai para quem fechou primeiro — o `orderBy` composto
    // exigiria índice, e 20 itens ordenam de graça aqui.
    return snap.docs
      .map(d => d.data() as ChallengeEntry)
      .sort((a, b) => b.daysDone - a.daysDone || a.lastDay.localeCompare(b.lastDay))
  } catch (e) { logDbError('getChallengeLeaderboard', e); return [] }
}

// ── Clube ─────────────────────────────────────────────────────────────────────
// Um clube é um grupo fechado com meta coletiva — não é feed nem rede social.
// Todos os membros veem o MESMO número somado, o que é justamente o que a lista
// de amigos (que é assimétrica, cada um com a sua) não consegue entregar.

export interface Club {
  id: string
  name: string
  ownerUid: string
  memberUids: string[]
  /** Treinos somados que o clube quer fechar no mês. */
  monthlyGoal: number
  createdAt: number
}

/** Limite de membros — mantém a leitura do progresso em N getDoc previsíveis. */
export const CLUB_MAX_MEMBERS = 30

function clubRef(id: string) {
  return doc(db, 'clubs', id)
}

/** Código curto e legível, usado como id do documento e como convite. */
function newClubId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // sem I/O/0/1
  let out = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export async function createClub(name: string, monthlyGoal: number): Promise<Club | null> {
  if (!getDbUid()) return null
  const club: Club = {
    id: newClubId(),
    name: name.trim().slice(0, 40),
    ownerUid: getDbUid(),
    memberUids: [getDbUid()],
    monthlyGoal,
    createdAt: Date.now(),
  }
  // Não espera o servidor confirmar: com o cache persistente ligado, a promise
  // de uma escrita só resolve quando o Firestore responde, e offline ela nunca
  // resolve — o botão ficaria travado em "..." para sempre. O documento já
  // existe localmente na linha seguinte e sobe sozinho quando a rede volta.
  fireWrite(setDoc(clubRef(club.id), club), 'createClub')
  fireWrite(setDoc(dataRef('club'), { clubId: club.id }), 'saveClubRef')
  return club
}

export async function getClub(id: string): Promise<Club | null> {
  try {
    const snap = await getDoc(clubRef(id.toUpperCase()))
    return snap.exists() ? (snap.data() as Club) : null
  } catch (e) { logDbError('getClub', e); return null }
}

/** Id do clube em que este usuário está, se houver. */
export async function getMyClubId(): Promise<string | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('club'))
    return snap.exists() ? ((snap.data().clubId as string) ?? null) : null
  } catch (e) { logDbError('getMyClubId', e); return null }
}

export type JoinClubResult =
  | { ok: true; club: Club }
  | { ok: false; reason: 'not-found' | 'full' | 'already-in' | 'error' }

export async function joinClub(id: string): Promise<JoinClubResult> {
  if (!getDbUid()) return { ok: false, reason: 'error' }
  const code = id.trim().toUpperCase()
  const club = await getClub(code)
  if (!club) return { ok: false, reason: 'not-found' }
  if (club.memberUids.includes(getDbUid())) {
    fireWrite(setDoc(dataRef('club'), { clubId: club.id }), 'saveClubRef')
    return { ok: false, reason: 'already-in' }
  }
  if (club.memberUids.length >= CLUB_MAX_MEMBERS) return { ok: false, reason: 'full' }

  try {
    const { arrayUnion, updateDoc } = await import('firebase/firestore')
    // `arrayUnion` e não uma lista montada aqui: dois atletas entrando ao mesmo
    // tempo com a lista que cada um leu apagariam um ao outro.
    fireWrite(updateDoc(clubRef(code), { memberUids: arrayUnion(getDbUid()) }), 'joinClub')
    fireWrite(setDoc(dataRef('club'), { clubId: code }), 'saveClubRef')
    return { ok: true, club: { ...club, memberUids: [...club.memberUids, getDbUid()] } }
  } catch (e) { logDbError('joinClub', e); return { ok: false, reason: 'error' } }
}

export async function leaveClub(id: string): Promise<void> {
  if (!getDbUid()) return
  try {
    const { arrayRemove, updateDoc } = await import('firebase/firestore')
    fireWrite(updateDoc(clubRef(id), { memberUids: arrayRemove(getDbUid()) }), 'leaveClub')
  } catch (e) { logDbError('leaveClub', e) }
  fireWrite(setDoc(dataRef('club'), { clubId: null }), 'clearClubRef')
}

/** Só o dono muda a meta — evita o membro baixar a régua no dia 28. */
export async function updateClubGoal(id: string, monthlyGoal: number): Promise<void> {
  try {
    const { updateDoc } = await import('firebase/firestore')
    fireWrite(updateDoc(clubRef(id), { monthlyGoal }), 'updateClubGoal')
  } catch (e) { logDbError('updateClubGoal', e) }
}
