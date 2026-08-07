import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import type { ManualWorkout } from '../store/useWorkoutStore'
import type { WebDietData } from '../store/useWebDietStore'
import type { CoachConversation } from '../store/useCoachStore'
import type { PlannedSession } from './weekPlan'

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

// Com o cache persistente ligado, a promise de uma escrita só resolve quando o
// SERVIDOR confirma — offline ela fica pendente indefinidamente. O dado já está
// salvo localmente e sobe sozinho quando a rede volta, então esperar por essa
// promise só travaria a interface. Disparamos e registramos a falha, se houver.
function fireWrite(p: Promise<unknown>, fn: string): void {
  p.catch(e => logDbError(fn, e))
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  onboardingDone: boolean
  createdAt?: number
  consentAt?: number   // Unix ms — when the user accepted the privacy policy
  goals?: string[]
  values?: string[]
  onboardingSummary?: string
  /** Peso atual em kg — entra na fórmula MET do gasto calórico e no TDEE. */
  weightKg?: number
  /** Altura em cm. */
  heightCm?: number
  /** Data de nascimento "YYYY-MM-DD" — guardamos a data, não a idade, para não envelhecer errado. */
  birthDate?: string
  /** Sexo biológico — a fórmula de Mifflin-St Jeor usa constantes diferentes. */
  sex?: 'masculino' | 'feminino'
  /** Nível de atividade fora dos treinos registrados — multiplicador do TDEE. */
  activityLevel?: ActivityLevel
}

export type ActivityLevel = 'sedentario' | 'leve' | 'moderado' | 'intenso' | 'atleta'

export async function getProfile(): Promise<UserProfile | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('profile'))
    return snap.exists() ? (snap.data() as UserProfile) : null
  } catch (e) { logDbError('getProfile', e); return null }
}

export async function saveProfile(data: Partial<UserProfile>) {
  if (!currentUid) return
  fireWrite(setDoc(dataRef('profile'), data, { merge: true }), 'saveProfile')
}

// ── Weight log ───────────────────────────────────────────────────────────────
// Uma pesagem por dia (a última do dia vence). Guardado num documento só, como
// os demais: o volume é baixo (uma entrada por dia) e a leitura vira 1 read.

export interface WeightEntry {
  /** "YYYY-MM-DD" no fuso local. */
  date: string
  kg: number
}

/** Quantas pesagens mantemos — ~2 anos de registro diário. */
const WEIGHT_LOG_MAX = 730

export async function getWeightLog(): Promise<WeightEntry[]> {
  if (!currentUid) return []
  try {
    const snap = await getDoc(dataRef('weightLog'))
    return snap.exists() ? ((snap.data().items as WeightEntry[]) ?? []) : []
  } catch (e) { logDbError('getWeightLog', e); return [] }
}

export async function saveWeightLog(entries: WeightEntry[]) {
  if (!currentUid) return
  const items = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-WEIGHT_LOG_MAX)
  fireWrite(setDoc(dataRef('weightLog'), { items }), 'saveWeightLog')
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
  fireWrite(setDoc(dataRef('workouts'), { items: workouts }), 'saveWorkouts')
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
  fireWrite(setDoc(dataRef('diet'), data), 'saveDiet')
}

// ── Daily (hábitos + foco) ────────────────────────────────────────────────────

export interface Habit { id: string; icon: string; label: string; done: boolean }
export interface FocusItem { id: string; text: string; done: boolean }

/** Check-in de prontidão da manhã — quatro toques que dizem como o corpo acordou. */
export interface ReadinessEntry {
  /** Horas dormidas (aceita meia hora: 7.5). */
  sleepHours: number
  /** Qualidade do sono, 1 (péssima) a 5 (ótima). */
  sleepQuality: number
  /** Dor muscular / DOMS, 1 (nenhuma) a 5 (muita). */
  soreness: number
  /** Disposição para treinar hoje, 1 (zero) a 5 (de sobra). */
  drive: number
  /** FC de repouso em bpm — opcional, só quem mede de manhã preenche. */
  restingHr?: number
  /** Unix ms do registro. */
  loggedAt: number
}

export interface DailyData {
  habits?: Habit[]
  focus?: FocusItem[]
  waterMl?: number
  readiness?: ReadinessEntry
}

export async function getDaily(date: string): Promise<DailyData | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(subRef('daily', date))
    return snap.exists() ? (snap.data() as DailyData) : null
  } catch (e) { logDbError('getDaily', e); return null }
}

export async function saveDaily(date: string, data: Partial<DailyData>) {
  if (!currentUid) return

  // `setDoc` com merge faz merge PROFUNDO de mapas, então gravar
  // { '2026-06-16': { waterMl: 500 } } preserva os hábitos e o foco do mesmo dia
  // — e funciona tanto se o documento do mês já existir quanto se não existir.
  // (O par updateDoc-com-dot-notation + setDoc-no-catch que havia aqui dependia
  // de uma rejeição vinda do servidor, que offline nunca chega.)
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v
  }
  if (Object.keys(clean).length === 0) return

  const ym = date.slice(0, 7)
  fireWrite(setDoc(monthlyRef('dailyMonthly', ym), { [date]: clean }, { merge: true }), 'saveDaily/monthly')
  // Documento individual mantido enquanto houver dados antigos lidos por ele.
  fireWrite(setDoc(subRef('daily', date), clean, { merge: true }), 'saveDaily/individual')
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
  fireWrite(setDoc(monthlyRef('mentalMonthly', ym), { [date]: data }, { merge: true }), 'saveMental/monthly')
  fireWrite(setDoc(subRef('mental', date), data), 'saveMental/individual')
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
  fireWrite(setDoc(dataRef('projects'), { items: projects }), 'saveProjects')
}

// ── Plano da semana ──────────────────────────────────────────────────────────
// Grade fixa por dia da semana que se repete — ver lib/weekPlan.ts.

export async function getWeekPlan(): Promise<PlannedSession[] | null> {
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('weekPlan'))
    return snap.exists() ? ((snap.data().items as PlannedSession[]) ?? []) : null
  } catch (e) { logDbError('getWeekPlan', e); return null }
}

export async function saveWeekPlan(items: PlannedSession[]) {
  if (!currentUid) return
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
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('reminderPrefs'))
    return snap.exists() ? (snap.data() as ReminderPrefs) : null
  } catch (e) { logDbError('getReminderPrefs', e); return null }
}

export async function saveReminderPrefs(prefs: ReminderPrefs) {
  if (!currentUid) return
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
  if (!currentUid) return null
  try {
    const snap = await getDoc(dataRef('books'))
    return snap.exists() ? ((snap.data().items as Book[]) ?? []) : null
  } catch (e) { logDbError('getBooks', e); return null }
}

export async function saveBooks(books: Book[]) {
  if (!currentUid) return
  fireWrite(setDoc(dataRef('books'), { items: books }), 'saveBooks')
}

// ── Habit definitions ─────────────────────────────────────────────────────────

export interface HabitDef {
  id: string
  icon: string
  label: string
  /** O "porquê" — intenção/valor por trás do hábito */
  why?: string
  createdAt?: number
  /**
   * Quantas vezes por semana o hábito vale. 7 (ou ausente) = diário; 1 a 6 = de
   * frequência, cobrado na semana e não no dia — dia de descanso planejado deixa
   * de contar como falha. Ver lib/streaks.ts.
   */
  targetPerWeek?: number
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
  fireWrite(setDoc(dataRef('habitDefs'), { items: defs }), 'saveHabitDefs')
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
  fireWrite(setDoc(dataRef('friends'), { uids: [...existing, friendUid] }), 'addFriend')
}

export async function removeFriend(friendUid: string): Promise<void> {
  if (!currentUid) return
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
  fireWrite(setDoc(dataRef('progress'), { items: photos }), 'saveProgressPhotos')
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
  fireWrite(setDoc(dataRef('hydration'), data), 'saveHydration')
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

  fireWrite(setDoc(dataRef('coachConversations'), { items }), 'saveCoachConversations')
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
    fireWrite(setDoc(dataRef('weeklyReviews'), { items: next }), 'saveWeeklyReview')
  } catch (e) { logDbError('saveWeeklyReview', e) }
}

// ── Push subscription (Web Push VAPID) ───────────────────────────────────────

export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  if (!currentUid) return
  fireWrite(setDoc(dataRef('pushSubscription'), sub as Record<string, unknown>), 'savePushSubscription')
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
    'coachConversations', 'weightLog', 'weekPlan', 'reminderPrefs',
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
