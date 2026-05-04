export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { code, refresh_token } = payload

  if (!code && !refresh_token) {
    return res.status(400).json({ error: 'code or refresh_token required' })
  }

  const clientId = process.env.STRAVA_CLIENT_ID || process.env.VITE_STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET || process.env.VITE_STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Missing Strava credentials',
      detail: 'Configure STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in server environment.',
    })
  }

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: code ? 'authorization_code' : 'refresh_token',
    ...(code ? { code } : { refresh_token }),
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    return res.status(response.status).json(data)
  } catch {
    return res.status(500).json({ error: 'Token exchange failed' })
  }
}
