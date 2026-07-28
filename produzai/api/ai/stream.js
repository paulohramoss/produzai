// SSE proxy: receives chat messages + context from the client, builds the system
// prompt server-side (keeping TRAINING_KNOWLEDGE and the Anthropic key off the
// browser), and pipes the Anthropic streaming response back to the client.

import { verifyToken } from './_auth.js'
import { rateLimit } from './_rateLimit.js'
import { buildSystemPrompt, onboardingSystemPrompt } from './_prompts.js'

function toApiMessages(messages) {
  return messages.map(m => {
    if (!m.attachment?.data) {
      return {
        role: m.role,
        content:
          m.content.trim() ||
          'Anexo enviado anteriormente (não disponível nesta sessão).',
      }
    }
    const isPdf = m.attachment.mediaType === 'application/pdf'
    return {
      role: m.role,
      content: [
        {
          type: isPdf ? 'document' : 'image',
          source: {
            type: 'base64',
            media_type: m.attachment.mediaType,
            data: m.attachment.data,
          },
        },
        {
          type: 'text',
          text: m.content.trim() || 'Analise meu treino e me dê seu feedback.',
        },
      ],
    }
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Rate limit per user to guard against token-cost abuse. Streaming replies
  // are heavier and longer than completions, so the window is a bit tighter.
  const rl = rateLimit(`stream:${user.localId}`, { limit: 20, windowMs: 60_000 })
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' })
  }

  const { messages, context } = req.body ?? {}
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const systemPrompt =
    context?.type === 'onboarding'
      ? onboardingSystemPrompt(context.userName)
      : buildSystemPrompt(context)

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        stream: true,
        system: systemPrompt,
        messages: toApiMessages(messages),
      }),
    })

    if (!anthropicRes.ok) {
      let msg = `Erro ${anthropicRes.status}`
      try {
        const body = await anthropicRes.json()
        if (body.error?.message) msg = body.error.message
      } catch { /* noop */ }
      res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`)
      res.end()
      return
    }

    const reader = anthropicRes.body.getReader()
    const dec = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(dec.decode(value, { stream: true }))
    }

    res.end()
  } catch (e) {
    res.write(
      `data: ${JSON.stringify({ type: 'error', error: e.message || 'Erro desconhecido' })}\n\n`,
    )
    res.end()
  }
}
