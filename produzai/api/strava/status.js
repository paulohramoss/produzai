import {
  STRAVA_SESSION_COOKIE,
  clearCookie,
  getSession,
  sendJson,
} from './_shared.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = getSession(req)

  if (!session?.refresh_token) {
    return sendJson(res, 200, { connected: false }, [clearCookie(STRAVA_SESSION_COOKIE, req)])
  }

  return sendJson(res, 200, {
    connected: true,
    athlete: {
      id: session.athlete_id,
      name: session.athlete_name,
      profile: session.profile,
    },
    scope: session.scope,
    expires_at: session.expires_at,
    expires_in: Math.max(0, Number(session.expires_at || 0) - Math.floor(Date.now() / 1000)),
  })
}
