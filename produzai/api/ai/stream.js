// SSE proxy: receives chat messages + context from the client, builds the system
// prompt server-side (keeping TRAINING_KNOWLEDGE and the Anthropic key off the
// browser), and pipes the Anthropic streaming response back to the client.

import { verifyToken } from './_auth.js'
import { rateLimit } from './_rateLimit.js'
import { COACH_STATIC_PROMPT, buildSystemPrompt, onboardingSystemPrompt } from './_prompts.js'

/** Teto de turnos por requisição — conversa real não chega perto. */
const MAX_MESSAGES = 80

/** Teto do corpo serializado: cobre o anexo de 5 MB do cliente em base64 e sobra. */
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024

const WORKOUT_TYPES = ['Corrida', 'Caminhada', 'Academia', 'Ciclismo', 'Natação', 'Futebol', 'Outro']

// Ferramenta do Coach: quando o usuário conta que treinou, o registro acontece
// no próprio chat. A execução é do cliente (o histórico de treinos vive no
// navegador/Firestore do usuário) — aqui só declaramos o contrato.
const COACH_TOOLS = [
  {
    name: 'registrar_treino',
    description:
      'Registra um treino que o usuário disse ter feito. Use SEMPRE que ele relatar uma atividade concluída ' +
      '(ex: "corri 8km em 45min", "fiz perna hoje", "joguei bola 1 hora"), mesmo sem todos os dados — estime o que faltar. ' +
      'Não use para treinos futuros, planos ou sugestões, nem para atividades que ele apenas cogitou fazer.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: WORKOUT_TYPES,
          description: 'Tipo da atividade, o mais próximo do que foi relatado',
        },
        name: {
          type: 'string',
          description: 'Nome curto do treino (ex: "Corrida matinal", "Treino de pernas")',
        },
        durationMin: {
          type: 'integer',
          description: 'Duração em minutos. Se não informada, estime pelo tipo e distância',
        },
        dist: {
          type: 'number',
          description: 'Distância em km. Use 0 quando não se aplica (ex: musculação)',
        },
        effort: {
          type: 'integer',
          description: 'Esforço percebido: 1=leve, 2=moderado, 3=intenso, 4=muito intenso, 5=máximo. Use 2 se não der para saber',
        },
        hr: {
          type: 'integer',
          description: 'Frequência cardíaca média em bpm. Use 0 se não mencionada',
        },
        date: {
          type: 'string',
          description: 'Data do treino em YYYY-MM-DD. Omita para hoje; use a data correta se ele disser "ontem", "sábado" etc.',
        },
      },
      required: ['type', 'name', 'durationMin'],
    },
  },
]

function toApiMessages(messages) {
  return messages.map(m => {
    // Resultado das ferramentas executadas no cliente — volta como turno de usuário.
    if (Array.isArray(m.toolResults) && m.toolResults.length > 0) {
      return {
        role: 'user',
        content: m.toolResults.map(r => ({
          type: 'tool_result',
          tool_use_id: r.id,
          content: String(r.content ?? ''),
          ...(r.isError ? { is_error: true } : {}),
        })),
      }
    }

    // Turno do assistente que pediu ferramentas: o texto (se houver) vem antes dos blocos tool_use.
    if (Array.isArray(m.toolUses) && m.toolUses.length > 0) {
      const blocks = []
      if (m.content?.trim()) blocks.push({ type: 'text', text: m.content.trim() })
      for (const t of m.toolUses) {
        blocks.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input ?? {} })
      }
      return { role: m.role, content: blocks }
    }

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
  const rl = await rateLimit(`stream:${user.localId}`, { limit: 20, windowMs: 60_000 })
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

  // Teto de payload. O cliente já limita anexo a 5 MB e conversa a poucas
  // dezenas de mensagens, mas o cliente não é a defesa: sem isto, uma
  // requisição forjada dentro do rate limit (20/min) manda centenas de turnos e
  // gasta tokens nossos à vontade. Os números são folgados para o uso real.
  if (messages.length > MAX_MESSAGES) {
    return res.status(413).json({ error: 'Conversa longa demais. Comece uma nova conversa.' })
  }
  if (JSON.stringify(messages).length > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ error: 'Mensagem grande demais. Reduza o anexo e tente de novo.' })
  }

  const isOnboarding = context?.type === 'onboarding'

  // O `system` vai em DOIS blocos, e a ordem é o ponto todo: primeiro a parte
  // que nunca muda (persona + base de conhecimento + regras), marcada para
  // cache; depois o contexto do usuário, que muda a cada mensagem. Assim o
  // trecho caro é escrito no cache uma vez e relido a ~10% do preço nos turnos
  // seguintes da conversa, em vez de ser cobrado inteiro toda vez.
  //
  // O onboarding não entra nisso: o prompt dele é curto demais para alcançar o
  // mínimo de cache (~1024 tokens) e a conversa é de poucos turnos.
  const system = isOnboarding
    ? onboardingSystemPrompt(context.userName)
    : [
        {
          type: 'text',
          text: COACH_STATIC_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        { type: 'text', text: buildSystemPrompt(context) },
      ]

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
        model: 'claude-sonnet-5',
        max_tokens: 8192,
        stream: true,
        system,
        // O onboarding é só conversa — registrar treino só faz sentido no Coach.
        ...(isOnboarding ? {} : { tools: COACH_TOOLS }),
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
