import {
  STRAVA_STATE_COOKIE,
  clearCookie,
  exchangeStravaToken,
  getBaseUrl,
  getSessionCookie,
  hasActivityReadScope,
  parseCookies,
} from './_shared.js'

function redirectToApp(req, res, status) {
  const baseUrl = getBaseUrl(req)
  res.statusCode = 302
  res.setHeader('Location', `${baseUrl}/?strava=${encodeURIComponent(status)}`)
  return res.end()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cookies = parseCookies(req)
  const expectedState = cookies[STRAVA_STATE_COOKIE]
  const { code, state, scope, error } = req.query

  if (error) {
    res.setHeader('Set-Cookie', clearCookie(STRAVA_STATE_COOKIE, req))
    return redirectToApp(req, res, error === 'access_denied' ? 'denied' : 'error')
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    res.setHeader('Set-Cookie', clearCookie(STRAVA_STATE_COOKIE, req))
    return redirectToApp(req, res, 'invalid_state')
  }

  try {
    const data = await exchangeStravaToken({
      grant_type: 'authorization_code',
      code,
    })
    const acceptedScope = data.scope || scope || ''

    if (!hasActivityReadScope(acceptedScope)) {
      res.setHeader('Set-Cookie', clearCookie(STRAVA_STATE_COOKIE, req))
      return redirectToApp(req, res, 'missing_scope')
    }

    const athlete = data.athlete || {}
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: athlete.id,
      athlete_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' '),
      profile: athlete.profile_medium || athlete.profile,
      scope: acceptedScope,
      connected_at: Math.floor(Date.now() / 1000),
    }

    res.setHeader('Set-Cookie', [
      clearCookie(STRAVA_STATE_COOKIE, req),
      getSessionCookie(session, req),
    ])
    return redirectToApp(req, res, 'connected')
  } catch (err) {
    console.error('Strava OAuth callback failed:', err)
    res.setHeader('Set-Cookie', clearCookie(STRAVA_STATE_COOKIE, req))
    return redirectToApp(req, res, 'error')
  }
}
