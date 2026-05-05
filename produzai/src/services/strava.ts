const API_BASE = '/api/strava'

export interface StravaStatus {
  connected: boolean
  athlete?: {
    id?: number
    name?: string
    profile?: string
  }
  scope?: string
  expires_at?: number
  expires_in?: number
}

export interface StravaData {
  lastSync: string
  weekKm: number
  weekRuns: number
  weekCal: number
  weekElev: number
  monthKm: number
  monthGoal: number
  pr5k: string
  pr10k: string
  activities: Array<{
    type: string
    name: string
    date: string
    dist: number
    pace: string
    time: string
    cal: number
    hr: number
    elev: number
  }>
  zones: Array<{ z: string; pct: number; c: string }>
}

interface ApiErrorBody {
  error?: string
  detail?: string
  data?: { message?: string }
}

function getApiErrorMessage(status: number, body: ApiErrorBody | null): string {
  if (status === 401) return 'Strava não conectado. Autorize sua conta novamente.'
  if (status === 403) return 'O Strava não concedeu permissão para ler suas atividades.'
  if (status === 404) {
    return 'API local do Strava indisponível. Em desenvolvimento, execute com Vercel dev ou teste no deploy.'
  }
  return body?.error || body?.data?.message || `Erro na API do Strava: ${status}`
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  })
  const body = await response.json().catch(() => null) as ApiErrorBody | T | null

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response.status, body as ApiErrorBody | null))
  }

  if (body === null) {
    throw new Error(getApiErrorMessage(404, null))
  }

  return body as T
}

export function getConnectUrl(): string {
  return `${API_BASE}/connect`
}

export async function getStravaStatus(): Promise<StravaStatus> {
  return apiFetch<StravaStatus>('/status')
}

export async function disconnectStrava(): Promise<void> {
  await apiFetch<{ ok: boolean }>('/disconnect', { method: 'POST' })
}

export function getStravaRedirectStatus(): string | null {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('strava')
  if (!status) return null

  params.delete('strava')
  const nextSearch = params.toString()
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
  )
  return status
}

export function getStravaRedirectMessage(status: string | null): string | null {
  switch (status) {
    case 'connected':
      return 'Strava conectado com sucesso.'
    case 'denied':
      return 'Conexão cancelada no Strava.'
    case 'missing_scope':
      return 'Autorize a permissão de atividades para o dashboard conseguir sincronizar.'
    case 'invalid_state':
      return 'Não foi possível validar a sessão OAuth. Tente conectar novamente.'
    case 'error':
      return 'Não foi possível concluir a conexão com o Strava. Tente novamente.'
    default:
      return null
  }
}

// Helpers

function formatPace(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function weekStart(): Date {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function friendlyDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Hoje ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Ontem ${time}`
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${days[d.getDay()]} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
}

interface RawActivity {
  name: string
  sport_type: string
  type: string
  distance: number
  moving_time: number
  total_elevation_gain: number
  average_heartrate?: number
  calories?: number
  kilojoules?: number
  start_date: string
  average_speed: number
}

const isRun = (a: RawActivity) => a.type === 'Run' || a.sport_type === 'Run'
const isRide = (a: RawActivity) =>
  a.type === 'Ride' || a.sport_type === 'Ride' || a.sport_type === 'VirtualRide'

// Main data fetch

export async function fetchStravaData(): Promise<StravaData> {
  const raw = await apiFetch<RawActivity[]>('/activities?per_page=50')

  const ws = weekStart()
  const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const weekActs = raw.filter(a => new Date(a.start_date) >= ws)
  const monthActs = raw.filter(a => new Date(a.start_date) >= ms)

  const weekKm = weekActs.filter(isRun).reduce((s, a) => s + a.distance / 1000, 0)
  const weekRuns = weekActs.filter(isRun).length
  const weekCal = weekActs.reduce(
    (s, a) => s + (a.calories || Math.round((a.kilojoules || 0) * 0.239)),
    0,
  )
  const weekElev = weekActs.reduce((s, a) => s + a.total_elevation_gain, 0)
  const monthKm = monthActs.filter(isRun).reduce((s, a) => s + a.distance / 1000, 0)

  let best5k = Infinity
  let best10k = Infinity
  raw.filter(isRun).forEach(a => {
    if (!a.distance || !a.moving_time) return
    const sPerKm = a.moving_time / (a.distance / 1000)
    if (a.distance >= 4900) best5k = Math.min(best5k, sPerKm * 5)
    if (a.distance >= 9900) best10k = Math.min(best10k, sPerKm * 10)
  })

  const activities = raw.slice(0, 3).map(a => {
    const sPerKm = a.distance > 0 ? a.moving_time / (a.distance / 1000) : 0
    const type = isRun(a) ? 'Corrida' : isRide(a) ? 'Ciclismo' : 'Atividade'
    return {
      type,
      name: a.name,
      date: friendlyDate(a.start_date),
      dist: Math.round(a.distance / 100) / 10,
      pace: isRun(a) ? formatPace(sPerKm) : `${Math.round(a.average_speed * 3.6)}km/h`,
      time: formatDuration(a.moving_time),
      cal: a.calories || Math.round((a.kilojoules || 0) * 0.239),
      hr: Math.round(a.average_heartrate || 0),
      elev: Math.round(a.total_elevation_gain),
    }
  })

  const zoneLabels = ['Z1 Fácil', 'Z2 Base', 'Z3 Tempo', 'Z4 Limiar', 'Z5 VO2max']
  const zoneColors = ['#60A5FA', '#22C55E', '#F97316', '#F97316', '#EF4444']
  const zoneThresholds = [60, 70, 80, 90, 101]
  const maxHR = 185
  const hrActs = raw.slice(0, 15).filter(a => (a.average_heartrate || 0) > 0)
  const counts = [0, 0, 0, 0, 0]

  if (hrActs.length > 0) {
    hrActs.forEach(a => {
      const pct = ((a.average_heartrate || 0) / maxHR) * 100
      const idx = zoneThresholds.findIndex(t => pct < t)
      if (idx >= 0) counts[idx]++
    })
    const total = counts.reduce((a, b) => a + b, 0)
    counts.forEach((count, i) => {
      counts[i] = total > 0 ? Math.round((count / total) * 100) : 0
    })
  } else {
    const defaults = [18, 35, 28, 14, 5]
    defaults.forEach((value, i) => {
      counts[i] = value
    })
  }

  const zones = zoneLabels.map((z, i) => ({ z, pct: counts[i], c: zoneColors[i] }))
  const now = new Date()

  return {
    lastSync: `${now.toLocaleDateString('pt-BR', { weekday: 'short' })} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    weekKm: Math.round(weekKm * 10) / 10,
    weekRuns,
    weekCal,
    weekElev: Math.round(weekElev),
    monthKm: Math.round(monthKm * 10) / 10,
    monthGoal: 120,
    pr5k: best5k < Infinity ? formatDuration(Math.round(best5k)) : '—',
    pr10k: best10k < Infinity ? formatDuration(Math.round(best10k)) : '—',
    activities,
    zones,
  }
}
