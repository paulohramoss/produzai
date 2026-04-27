const BASE_URL = 'https://www.strava.com/api/v3'
const STORAGE_KEY = 'strava_tokens'

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: number // Unix timestamp in seconds
  athlete_id?: number
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

// ─── Token management ────────────────────────────────────────────────────────

export function getTokens(): StravaTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setTokens(t: StravaTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasValidTokens(): boolean {
  return !!getTokens()?.access_token
}

function isExpired(): boolean {
  const t = getTokens()
  if (!t) return true
  return Date.now() / 1000 >= t.expires_at - 300 // 5-min buffer
}

// Seeds tokens from VITE_ env vars on first boot (idempotent)
export function bootstrapTokensFromEnv(): void {
  if (hasValidTokens()) return
  const access = import.meta.env.VITE_STRAVA_ACCESS_TOKEN as string | undefined
  const refresh = import.meta.env.VITE_STRAVA_REFRESH_TOKEN as string | undefined
  if (access && refresh) {
    setTokens({
      access_token: access,
      refresh_token: refresh,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // optimistic: 1h
    })
  }
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getAuthUrl(): string {
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID as string
  const redirectUri =
    (import.meta.env.VITE_STRAVA_REDIRECT_URI as string | undefined) ||
    window.location.origin
  return (
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&approval_prompt=auto` +
    `&scope=activity:read_all,read`
  )
}

// ─── Shared token endpoint caller ────────────────────────────────────────────
// Tries the Vercel serverless proxy first (production + `vercel dev`).
// If it returns 404 (plain `npm run dev`), falls back to calling Strava
// directly using VITE_STRAVA_CLIENT_SECRET from the local .env — acceptable
// for personal dev use since .env is gitignored.

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id: number }
  message?: string
}

async function callTokenEndpoint(
  params: { code: string } | { refresh_token: string },
): Promise<TokenResponse> {
  // 1. Try serverless proxy
  const proxyRes = await fetch('/api/strava/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => null)

  if (proxyRes && proxyRes.status !== 404) {
    if (!proxyRes.ok) throw new Error(`Token endpoint error: ${proxyRes.status}`)
    return proxyRes.json() as Promise<TokenResponse>
  }

  // 2. Dev fallback: call Strava directly (needs VITE_STRAVA_CLIENT_SECRET in .env)
  const secret = import.meta.env.VITE_STRAVA_CLIENT_SECRET as string | undefined
  if (!secret) {
    throw new Error(
      'Em dev sem vercel dev: adicione VITE_STRAVA_CLIENT_SECRET ao .env ou execute `vercel dev`.',
    )
  }

  const body = {
    client_id: import.meta.env.VITE_STRAVA_CLIENT_ID as string,
    client_secret: secret,
    grant_type: 'code' in params ? 'authorization_code' : 'refresh_token',
    ...params,
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Strava token error: ${res.status}`)
  }
  return res.json() as Promise<TokenResponse>
}

export async function exchangeCode(code: string): Promise<StravaTokens> {
  const data = await callTokenEndpoint({ code })
  if (!data.access_token) throw new Error(data.message || 'No access token returned')
  const tokens: StravaTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete?.id,
  }
  setTokens(tokens)
  return tokens
}

// ─── Internal HTTP ───────────────────────────────────────────────────────────

async function refreshTokens(): Promise<string> {
  const current = getTokens()
  if (!current?.refresh_token) throw new Error('No refresh token stored')
  const data = await callTokenEndpoint({ refresh_token: current.refresh_token })
  setTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: current.athlete_id,
  })
  return data.access_token
}

async function getAccessToken(): Promise<string> {
  if (isExpired()) return refreshTokens()
  return getTokens()!.access_token
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    // Force-refresh and retry once
    const newToken = await refreshTokens()
    const retry = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${newToken}` },
    })
    if (!retry.ok) throw new Error(`Strava API error: ${retry.status}`)
    return retry.json() as Promise<T>
  }
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json() as Promise<T>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const day = d.getDay() || 7 // Sun→7
  d.setDate(d.getDate() - day + 1) // Mon
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

// ─── Main data fetch ─────────────────────────────────────────────────────────

export async function fetchStravaData(): Promise<StravaData> {
  const raw = await apiFetch<RawActivity[]>('/athlete/activities?per_page=50')

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

  // Best 5k / 10k estimated from avg pace × target distance
  let best5k = Infinity,
    best10k = Infinity
  raw.filter(isRun).forEach(a => {
    if (!a.distance || !a.moving_time) return
    const sPerKm = a.moving_time / (a.distance / 1000)
    if (a.distance >= 4900) best5k = Math.min(best5k, sPerKm * 5)
    if (a.distance >= 9900) best10k = Math.min(best10k, sPerKm * 10)
  })

  // Recent activities (last 3)
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

  // HR zone distribution (approximate from avg HR of recent activities)
  const zoneLabels = ['Z1 Fácil', 'Z2 Base', 'Z3 Tempo', 'Z4 Limiar', 'Z5 VO2max']
  const zoneColors = ['#60A5FA', '#22C55E', '#F97316', '#F97316', '#EF4444']
  const zoneThresholds = [60, 70, 80, 90, 101] // % of assumed max HR 185
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
    counts.forEach((c, i) => {
      counts[i] = total > 0 ? Math.round((c / total) * 100) : 0
    })
  } else {
    const defaults = [18, 35, 28, 14, 5]
    defaults.forEach((v, i) => (counts[i] = v))
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
