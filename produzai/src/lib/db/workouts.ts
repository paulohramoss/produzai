import { getDoc, setDoc } from 'firebase/firestore'
import type { ManualWorkout } from '../../store/useWorkoutStore'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

export async function getWorkouts(): Promise<ManualWorkout[] | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('workouts'))
    return snap.exists() ? ((snap.data().items as ManualWorkout[]) ?? []) : null
  } catch (e) { logDbError('getWorkouts', e); return null }
}

export async function saveWorkouts(workouts: ManualWorkout[]) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('workouts'), { items: workouts }), 'saveWorkouts')
}
