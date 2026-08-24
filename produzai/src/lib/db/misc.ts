import { deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import type { PlannedSession } from '../weekPlan'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

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
