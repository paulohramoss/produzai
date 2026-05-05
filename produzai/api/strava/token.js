export default async function handler(req, res) {
  return res.status(410).json({
    error: 'Deprecated endpoint',
    detail: 'Use /api/strava/connect, /api/strava/callback, /api/strava/status and /api/strava/activities.',
  })
}
