import { getDoc, setDoc } from 'firebase/firestore'
import { dataRef, fireWrite, getDbUid, logDbError, monthlyRef, subRef } from './client'

// ── Diário de treino ─────────────────────────────────────────────────────────

export interface TrainingJournalEntry {
  text: string
  updatedAt: number
}

export async function getJournalEntry(date: string): Promise<TrainingJournalEntry | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(subRef('journal', date))
    return snap.exists() ? (snap.data() as TrainingJournalEntry) : null
  } catch (e) { logDbError('getJournalEntry', e); return null }
}

export async function saveJournalEntry(date: string, data: TrainingJournalEntry) {
  if (!getDbUid()) return
  const ym = date.slice(0, 7)
  // TrainingJournalEntry is always a complete object, so top-level merge is safe
  fireWrite(setDoc(monthlyRef('journalMonthly', ym), { [date]: data }, { merge: true }), 'saveJournalEntry/monthly')
  fireWrite(setDoc(subRef('journal', date), data), 'saveJournalEntry/individual')
}

export async function getJournalHistory(dates: string[]): Promise<Record<string, TrainingJournalEntry>> {
  if (!getDbUid() || dates.length === 0) return {}
  try {
    const months = [...new Set(dates.map(d => d.slice(0, 7)))]
    const snaps = await Promise.all(months.map(ym => getDoc(monthlyRef('journalMonthly', ym))))
    const result: Record<string, TrainingJournalEntry> = {}
    for (const snap of snaps) {
      if (snap.exists()) Object.assign(result, snap.data() as Record<string, TrainingJournalEntry>)
    }
    const missing = dates.filter(d => !result[d])
    if (missing.length > 0) {
      await Promise.all(missing.map(async d => {
        const e = await getJournalEntry(d)
        if (e) result[d] = e
      }))
    }
    return result
  } catch (e) { logDbError('getJournalHistory', e); return {} }
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
  if (!getDbUid()) return []
  try {
    const snap = await getDoc(dataRef('weeklyReviews'))
    return snap.exists() ? ((snap.data().items as WeeklyReview[]) ?? []) : []
  } catch (e) { logDbError('getWeeklyReviews', e); return [] }
}

export async function saveWeeklyReview(review: WeeklyReview) {
  if (!getDbUid()) return
  try {
    const existing = await getWeeklyReviews()
    const next = [review, ...existing.filter(r => r.weekKey !== review.weekKey)].slice(0, 26)
    fireWrite(setDoc(dataRef('weeklyReviews'), { items: next }), 'saveWeeklyReview')
  } catch (e) { logDbError('saveWeeklyReview', e) }
}

// ── Diário de treino: insights ────────────────────────────────────────────────

export interface JournalInsight {
  weekKey: string      // "YYYY-Www" (ISO week)
  generatedAt: number
  riskLevel: 'baixo' | 'moderado' | 'alto'
  summary: string
  signals: string[]
  recommendation: string
}

export async function getJournalInsights(): Promise<JournalInsight[]> {
  if (!getDbUid()) return []
  try {
    const snap = await getDoc(dataRef('journalInsights'))
    return snap.exists() ? ((snap.data().items as JournalInsight[]) ?? []) : []
  } catch (e) { logDbError('getJournalInsights', e); return [] }
}

export async function saveJournalInsight(insight: JournalInsight) {
  if (!getDbUid()) return
  try {
    const existing = await getJournalInsights()
    const next = [insight, ...existing.filter(i => i.weekKey !== insight.weekKey)].slice(0, 26)
    fireWrite(setDoc(dataRef('journalInsights'), { items: next }), 'saveJournalInsight')
  } catch (e) { logDbError('saveJournalInsight', e) }
}
