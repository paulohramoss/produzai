export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, refresh_token } = req.body || {}

  if (!code && !refresh_token) {
    return res.status(400).json({ error: 'code or refresh_token required' })
  }

  const body = {
    client_id: process.env.VITE_STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: code ? 'authorization_code' : 'refresh_token',
    ...(code ? { code } : { refresh_token }),
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch {
    return res.status(500).json({ error: 'Token exchange failed' })
  }
}
