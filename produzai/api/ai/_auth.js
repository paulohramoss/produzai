// Verifies Firebase ID tokens via the Identity Platform REST API.
// No firebase-admin SDK required — uses the public web API key to call
// the accounts:lookup endpoint, which validates the JWT and returns user info.

export async function verifyToken(req) {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '')
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const apiKey = process.env.FIREBASE_API_KEY
  if (!apiKey) {
    // Dev fallback: if FIREBASE_API_KEY is not set, skip verification.
    // Remove this branch before going to production with real users.
    return { localId: 'dev', email: 'dev@local' }
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0] ?? null
  } catch {
    return null
  }
}
