import crypto from 'node:crypto'
import { sanitizeEnv } from './_shared.js'
import { getAdminDb, isAdminConfigured } from '../push/_firebase.js'
import { isPushConfigured, sendToUser } from '../push/_send.js'

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

    // O Strava reenvia o evento se não receber 200 rápido — responder primeiro
    // e notificar depois evita duplicatas por timeout.
    res.status(200).json({ ok: true })
    await notifyNewActivity(req.body).catch(err => {
      console.error('[strava/webhook] notify:', err.message)
    })
    return
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

/**
 * "Ele te chama primeiro": assim que a atividade chega do relógio, o app avisa
 * que já tem análise pronta — em vez de esperar o usuário lembrar de abrir.
 *
 * O webhook só traz o id do atleta no Strava, então o mapeamento
 * `stravaAthletes/{athleteId} → uid` (gravado quando o usuário conecta a conta)
 * é o que permite saber de quem é a atividade.
 */
async function notifyNewActivity(event) {
  if (event?.object_type !== 'activity' || event?.aspect_type !== 'create') return
  if (!isAdminConfigured() || !isPushConfigured()) return

  const athleteId = event.owner_id
  if (!athleteId) return

  const db = await getAdminDb()
  const linkSnap = await db.doc(`stravaAthletes/${athleteId}`).get()
  if (!linkSnap.exists) return

  const uid = linkSnap.data()?.uid
  if (!uid) return

  await sendToUser(db, uid, {
    title: '🏃 Treino sincronizado',
    body: 'Sua atividade chegou do Strava. Toque para ver a análise: zonas, deriva cardíaca e como ela se compara com as anteriores.',
    url: '/?page=treino',
  })
}
