import crypto from 'node:crypto'

export const STRAVA_API_URL = 'https://www.strava.com/api/v3'
export const STRAVA_SESSION_COOKIE = 'rise_strava_session'
export const STRAVA_STATE_COOKIE = 'rise_strava_state'

const ONE_DAY = 60 * 60 * 24

export function sanitizeEnv(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '')
}

export function getCredentials() {
  const clientId = sanitizeEnv(process.env.STRAVA_CLIENT_ID || process.env.VITE_STRAVA_CLIENT_ID)
  const clientSecret = sanitizeEnv(process.env.STRAVA_CLIENT_SECRET)

  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('Missing Strava credentials'), {
      statusCode: 500,
      detail: 'Configure STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in the server environment.',
    })
  }

  if (!/^\d+$/.test(clientId)) {
    throw Object.assign(new Error('Invalid Strava client id format'), {
      statusCode: 500,
      detail: 'STRAVA_CLIENT_ID must be numeric.',
    })
  }

  return { clientId, clientSecret }
}

export function getBaseUrl(req) {
  const configured = sanitizeEnv(process.env.STRAVA_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL)
  if (configured) {
    const withProtocol = configured.startsWith('http') ? configured : `https://${configured}`
    return withProtocol.replace(/\/+$/, '')
  }

  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`.replace(/\/+$/, '')
}

export function getRequestedScopes() {
  const configured = sanitizeEnv(process.env.STRAVA_SCOPES)
  return configured || 'read,activity:read'
}

export function parseScopes(scope) {
  return new Set(
    String(scope || '')
      .split(/[,\s]+/)
      .map(item => item.trim())
      .filter(Boolean),
  )
}

export function hasActivityReadScope(scope) {
  const scopes = parseScopes(scope)
  return scopes.has('activity:read') || scopes.has('activity:read_all')
}

export function parseCookies(req) {
  const header = req.headers.cookie || ''
  return Object.fromEntries(
    header
      .split(';')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        const index = item.indexOf('=')
        if (index === -1) return [item, '']
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))]
      }),
  )
}

export function serializeCookie(name, value, options = {}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${options.path || '/'}`,
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.secure !== false) parts.push('Secure')
  return parts.join('; ')
}

export function shouldUseSecureCookies(req) {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
  const proto = String(req?.headers?.['x-forwarded-proto'] || '')
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false
  return proto === 'https' || Boolean(process.env.VERCEL)
}

export function clearCookie(name, req) {
  return serializeCookie(name, '', { maxAge: 0, secure: shouldUseSecureCookies(req) })
}

function getCookieSecret() {
  const secret = sanitizeEnv(process.env.STRAVA_COOKIE_SECRET || process.env.STRAVA_CLIENT_SECRET)
  if (!secret) {
    throw Object.assign(new Error('Missing Strava cookie secret'), {
      statusCode: 500,
      detail: 'Configure STRAVA_COOKIE_SECRET or STRAVA_CLIENT_SECRET.',
    })
  }
  return crypto.createHash('sha256').update(secret).digest()
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url')
}

export function encryptSession(payload) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getCookieSecret(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [base64Url(iv), base64Url(tag), base64Url(encrypted)].join('.')
}

export function decryptSession(value) {
  if (!value) return null

  try {
    const [ivRaw, tagRaw, encryptedRaw] = String(value).split('.')
    if (!ivRaw || !tagRaw || !encryptedRaw) return null

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getCookieSecret(),
      Buffer.from(ivRaw, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ])
    return JSON.parse(decrypted.toString('utf8'))
  } catch {
    return null
  }
}

export function getSession(req) {
  const cookies = parseCookies(req)
  return decryptSession(cookies[STRAVA_SESSION_COOKIE])
}

export function getSessionCookie(session, req) {
  return serializeCookie(STRAVA_SESSION_COOKIE, encryptSession(session), {
    maxAge: ONE_DAY * 90,
    secure: shouldUseSecureCookies(req),
  })
}

export async function exchangeStravaToken(params) {
  const { clientId, clientSecret } = getCredentials()
  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    ...params,
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(
      Object.entries(body).map(([key, value]) => [key, String(value)]),
    ).toString(),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw Object.assign(new Error(data.message || `Strava token error: ${response.status}`), {
      statusCode: response.status,
      data,
    })
  }

  return data
}

export async function refreshSession(session) {
  if (!session?.refresh_token) {
    throw Object.assign(new Error('Missing Strava refresh token'), { statusCode: 401 })
  }

  const data = await exchangeStravaToken({
    grant_type: 'refresh_token',
    refresh_token: session.refresh_token,
  })

  return {
    ...session,
    access_token: data.access_token,
    refresh_token: data.refresh_token || session.refresh_token,
    expires_at: data.expires_at,
    scope: data.scope || session.scope,
  }
}

export async function ensureFreshSession(session) {
  const expiresAt = Number(session?.expires_at || 0)
  const shouldRefresh = !expiresAt || Date.now() / 1000 >= expiresAt - 300
  return shouldRefresh ? refreshSession(session) : session
}

export function sendJson(res, statusCode, payload, cookies = []) {
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  return res.status(statusCode).json(payload)
}

export function handleApiError(res, error) {
  const statusCode = error?.statusCode || 500
  return sendJson(res, statusCode, {
    error: error?.message || 'Strava request failed',
    detail: error?.detail,
    data: error?.data,
  })
}
