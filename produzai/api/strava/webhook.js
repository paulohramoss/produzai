import crypto from 'node:crypto'
import { sanitizeEnv } from './_shared.js'

function parseSignature(header) {
  return Object.fromEntries(
    String(header || '')
      .split(',')
      .map(part => part.trim().split('='))
      .filter(([key, value]) => key && value),
  )
}

async function getRawBody(req) {
  if (typeof req.body === 'string') return req.body

  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body)
  }

  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function verifySignature(req) {
  const signingSecret = sanitizeEnv(process.env.STRAVA_WEBHOOK_SIGNING_SECRET)
  if (!signingSecret) return true

  const parts = parseSignature(req.headers['x-strava-signature'])
  const timestamp = Number(parts.t)
  const signature = parts.v1

  if (!timestamp || !signature) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false

  const body = await getRawBody(req)
  const expected = crypto
    .createHmac('sha256', signingSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  const received = Buffer.from(signature)
  const computed = Buffer.from(expected)
  return received.length === computed.length && crypto.timingSafeEqual(received, computed)
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const verifyToken = sanitizeEnv(process.env.STRAVA_WEBHOOK_VERIFY_TOKEN)
    const challenge = req.query['hub.challenge']
    const receivedToken = req.query['hub.verify_token']

    if (!verifyToken || receivedToken !== verifyToken || !challenge) {
      return res.status(403).json({ error: 'Invalid webhook verification token' })
    }

    return res.status(200).json({ 'hub.challenge': challenge })
  }

  if (req.method === 'POST') {
    if (!(await verifySignature(req))) {
      return res.status(401).json({ error: 'Invalid Strava signature' })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
