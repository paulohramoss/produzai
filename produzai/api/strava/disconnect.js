import {
  STRAVA_SESSION_COOKIE,
  clearCookie,
  getSession,
  sendJson,
} from './_shared.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = getSession(req)

  if (session?.access_token) {
    await fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: session.access_token }).toString(),
    }).catch(() => null)
  }

  return sendJson(res, 200, { ok: true, connected: false }, [
    clearCookie(STRAVA_SESSION_COOKIE, req),
    clearCookie('strava_tokens', req),
  ])
}
