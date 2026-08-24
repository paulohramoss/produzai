import { getDoc, setDoc } from 'firebase/firestore'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

// ── Progress photos ───────────────────────────────────────────────────────────

export interface ProgressPhoto {
  id: string
  url: string
  date: string
  weight?: number
  caption: string
}

export async function getProgressPhotos(): Promise<ProgressPhoto[]> {
  if (!getDbUid()) return []
  try {
    const snap = await getDoc(dataRef('progress'))
    return snap.exists() ? ((snap.data().items as ProgressPhoto[]) ?? []) : []
  } catch (e) { logDbError('getProgressPhotos', e); return [] }
}

export async function saveProgressPhotos(photos: ProgressPhoto[]) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('progress'), { items: photos }), 'saveProgressPhotos')
}
