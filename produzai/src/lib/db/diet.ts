import { getDoc, setDoc } from 'firebase/firestore'
import type { WebDietData } from '../../store/useWebDietStore'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

// ── Diet ─────────────────────────────────────────────────────────────────────

export async function getDiet(): Promise<WebDietData | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('diet'))
    return snap.exists() ? (snap.data() as WebDietData) : null
  } catch (e) { logDbError('getDiet', e); return null }
}

export async function saveDiet(data: WebDietData | null) {
  if (!getDbUid() || !data) return
  fireWrite(setDoc(dataRef('diet'), data), 'saveDiet')
}

// ── Hydration ────────────────────────────────────────────────────────────────

export interface HydrationSettings { goalMl: number }

export async function getHydration(): Promise<HydrationSettings | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('hydration'))
    return snap.exists() ? (snap.data() as HydrationSettings) : null
  } catch (e) { logDbError('getHydration', e); return null }
}

export async function saveHydration(data: HydrationSettings) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('hydration'), data), 'saveHydration')
}
