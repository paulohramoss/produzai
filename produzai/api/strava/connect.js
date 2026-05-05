import {
  STRAVA_STATE_COOKIE,
  clearCookie,
  getBaseUrl,
  getCredentials,
  getRequestedScopes,
  handleApiError,
  serializeCookie,
  shouldUseSecureCookies,
} from './_shared.js'
import crypto from 'node:crypto'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { clientId } = getCredentials()
    const baseUrl = getBaseUrl(req)
    const state = crypto.randomBytes(24).toString('base64url')
    const redirectUri = `${baseUrl}/api/strava/callback`
    const authUrl = new URL('https://www.strava.com/oauth/authorize')

    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('approval_prompt', 'auto')
    authUrl.searchParams.set('scope', getRequestedScopes())
    authUrl.searchParams.set('state', state)

    res.setHeader('Set-Cookie', [
      serializeCookie(STRAVA_STATE_COOKIE, state, {
        maxAge: 10 * 60,
        secure: shouldUseSecureCookies(req),
      }),
      clearCookie('strava_tokens', req),
    ])
    res.statusCode = 302
    res.setHeader('Location', authUrl.toString())
    return res.end()
  } catch (error) {
    return handleApiError(res, error)
  }
}
