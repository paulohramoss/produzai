import {
  STRAVA_API_URL,
  STRAVA_SESSION_COOKIE,
  clearCookie,
  ensureFreshSession,
  getSession,
  getSessionCookie,
  handleApiError,
  refreshSession,
  sendJson,
} from './_shared.js'

function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

async function fetchActivities(session, req) {
  const perPage = boundedInt(req.query.per_page, 50, 1, 100)
  const page = boundedInt(req.query.page, 1, 1, 1000)
  const url = new URL(`${STRAVA_API_URL}/athlete/activities`)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))

  return fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const existingSession = getSession(req)
    if (!existingSession?.refresh_token) {
      return sendJson(res, 401, { error: 'Strava account not connected' }, [
        clearCookie(STRAVA_SESSION_COOKIE, req),
      ])
    }

    let session = await ensureFreshSession(existingSession)
    let response = await fetchActivities(session, req)

    if (response.status === 401) {
      session = await refreshSession(session)
      response = await fetchActivities(session, req)
    }

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: data.message || `Strava API error: ${response.status}`,
        data,
      }, [getSessionCookie(session, req)])
    }

    return sendJson(res, 200, data, [getSessionCookie(session, req)])
  } catch (error) {
    return handleApiError(res, error)
  }
}
