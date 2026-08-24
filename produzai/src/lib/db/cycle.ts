import { getDoc, setDoc } from 'firebase/firestore'
import type { CycleData } from '../cycle'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

// ── Ciclo menstrual ──────────────────────────────────────────────────────────
// Dado sensível de saúde e sempre opt-in: o documento só existe depois que a
// usuária liga o acompanhamento. Ver lib/cycle.ts.

export async function getCycle(): Promise<CycleData | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('cycle'))
    return snap.exists() ? (snap.data() as CycleData) : null
  } catch (e) { logDbError('getCycle', e); return null }
}

export async function saveCycle(data: CycleData) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('cycle'), data), 'saveCycle')
}
