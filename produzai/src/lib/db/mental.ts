import { getDoc, setDoc } from 'firebase/firestore'
import { fireWrite, getDbUid, logDbError, monthlyRef, subRef } from './client'

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
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(subRef('mental', date))
    return snap.exists() ? (snap.data() as MentalEntry) : null
  } catch (e) { logDbError('getMental', e); return null }
}

export async function saveMental(date: string, data: MentalEntry) {
  if (!getDbUid()) return
  const ym = date.slice(0, 7)
  // MentalEntry is always a complete object, so top-level merge is safe
  fireWrite(setDoc(monthlyRef('mentalMonthly', ym), { [date]: data }, { merge: true }), 'saveMental/monthly')
  fireWrite(setDoc(subRef('mental', date), data), 'saveMental/individual')
}

export async function getMentalHistory(dates: string[]): Promise<Record<string, MentalEntry>> {
  if (!getDbUid() || dates.length === 0) return {}
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
