// GET /api/strava/activity?id=123456
// Detalhe de UMA atividade + os streams (série temporal) dela. O endpoint de
// listagem (`activities.js`) só devolve o resumo — sem streams não há como
// calcular zonas, splits por km nem desacoplamento aeróbico.

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

// Mais que isso não melhora a análise e só engorda a resposta.
const STREAM_KEYS = 'time,heartrate,velocity_smooth,distance,altitude,cadence'

function fetchDetail(session, id) {
  return fetch(`${STRAVA_API_URL}/activities/${id}?include_all_efforts=false`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}

function fetchStreams(session, id) {
  const url = new URL(`${STRAVA_API_URL}/activities/${id}/streams`)
  url.searchParams.set('keys', STREAM_KEYS)
  url.searchParams.set('key_by_type', 'true')
  return fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = String(req.query.id || '').trim()
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid activity id' })
  }

  try {
    const existingSession = getSession(req)
    if (!existingSession?.refresh_token) {
      return sendJson(res, 401, { error: 'Strava account not connected' }, [
        clearCookie(STRAVA_SESSION_COOKIE, req),
      ])
    }

    let session = await ensureFreshSession(existingSession)
    let detailRes = await fetchDetail(session, id)

    if (detailRes.status === 401) {
      session = await refreshSession(session)
      detailRes = await fetchDetail(session, id)
    }

    const detail = await detailRes.json().catch(() => ({}))
    if (!detailRes.ok) {
      return sendJson(res, detailRes.status, {
        error: detail.message || `Strava API error: ${detailRes.status}`,
        data: detail,
      }, [getSessionCookie(session, req)])
    }

    // Streams podem faltar (atividade manual, sem GPS, sem cinta) — nesse caso
    // a análise ainda roda com o que o resumo tem, então não é erro fatal.
    let streams = null
    try {
      const streamsRes = await fetchStreams(session, id)
      if (streamsRes.ok) streams = await streamsRes.json()
    } catch { /* segue sem streams */ }

    return sendJson(res, 200, { activity: detail, streams }, [getSessionCookie(session, req)])
  } catch (error) {
    return handleApiError(res, error)
  }
}
