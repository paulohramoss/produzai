import type { ManualWorkout } from '../store/useWorkoutStore'
import type { StravaStreams } from './workoutAnalysis'
import { friendlyDate, calcPace, formatDuration } from './performance'

export interface StravaStatus {
  connected: boolean
  athlete?: { id: number; name: string; profile?: string }
  scope?: string
  expires_at?: number
  expires_in?: number
}

export async function getStravaStatus(): Promise<StravaStatus> {
  try {
    const res = await fetch('/api/strava/status')
    if (!res.ok) return { connected: false }
    return await res.json()
  } catch {
    return { connected: false }
  }
}

/** Navega o browser inteiro para o fluxo OAuth do Strava (precisa dos cookies de sessão). */
export function goToStravaConnect() {
  window.location.href = '/api/strava/connect'
}

export async function disconnectStrava(): Promise<boolean> {
  try {
    const res = await fetch('/api/strava/disconnect', { method: 'POST' })
    return res.ok
  } catch {
    return false
  }
}

export interface RawStravaActivity {
  id: number
  name: string
  type: string
  sport_type?: string
  distance: number // metros
  moving_time: number // segundos
  start_date_local: string
  average_heartrate?: number
  calories?: number
  total_elevation_gain?: number
}

export async function fetchStravaActivities(page = 1, perPage = 50): Promise<RawStravaActivity[]> {
  const res = await fetch(`/api/strava/activities?page=${page}&per_page=${perPage}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(data.error || `Strava API error: ${res.status}`)
  }
  return res.json()
}

/** Detalhe + streams de uma atividade. `streams` vem null quando a atividade não tem série temporal. */
export async function fetchStravaActivityDetail(
  stravaId: number,
): Promise<{ activity: RawStravaActivity; streams: StravaStreams | null } | null> {
  try {
    const res = await fetch(`/api/strava/activity?id=${stravaId}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const TYPE_MAP: Record<string, string> = {
  Run: 'Corrida', VirtualRun: 'Corrida', TrailRun: 'Corrida',
  Walk: 'Caminhada', Hike: 'Caminhada',
  Ride: 'Ciclismo', VirtualRide: 'Ciclismo', GravelRide: 'Ciclismo', MountainBikeRide: 'Ciclismo', EBikeRide: 'Ciclismo',
  Swim: 'Natação',
  WeightTraining: 'Academia', Workout: 'Academia', Crossfit: 'Academia', StairStepper: 'Academia', Elliptical: 'Academia',
  Soccer: 'Futebol',
}

function mapActivityType(activity: RawStravaActivity): string {
  return TYPE_MAP[activity.sport_type ?? ''] ?? TYPE_MAP[activity.type] ?? 'Outro'
}

/** Converte uma atividade do Strava para o formato interno de treino, marcada com a origem. */
export function stravaActivityToWorkout(activity: RawStravaActivity): Omit<ManualWorkout, 'id'> {
  const distKm = Math.round((activity.distance / 1000) * 100) / 100
  const durationMin = Math.max(1, Math.round(activity.moving_time / 60))
  const rawDate = activity.start_date_local.slice(0, 10)

  return {
    type: mapActivityType(activity),
    name: activity.name || 'Atividade Strava',
    rawDate,
    date: friendlyDate(rawDate),
    dist: distKm,
    pace: calcPace(durationMin, distKm),
    time: formatDuration(durationMin),
    cal: Math.round(activity.calories ?? 0),
    hr: Math.round(activity.average_heartrate ?? 0),
    elev: Math.round(activity.total_elevation_gain ?? 0),
    source: 'strava',
    stravaId: activity.id,
  }
}
