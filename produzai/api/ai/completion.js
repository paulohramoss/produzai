// Non-streaming AI completions: macros estimation, PDF diet parsing,
// onboarding plan generation, daily reflection, and weekly review.
// All calls are authenticated via Firebase ID token and use the server-side
// ANTHROPIC_API_KEY — never exposed to the browser.

import { verifyToken } from './_auth.js'
import { rateLimit } from './_rateLimit.js'
import { blockIfUnpaid } from '../_entitlement.js'

async function callClaude({ model, maxTokens, system, messages, apiKey }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    }),
  })
  if (!res.ok) return null
  const body = await res.json()
  return body.content?.find(c => c.type === 'text')?.text?.trim() ?? null
}

function extractJSON(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) { try { return JSON.parse(match[0]) } catch { /* fall through */ } }
  return null
}

// ── Per-type handlers ─────────────────────────────────────────────────────────

async function handleMacros(payload, apiKey) {
  const { items } = payload ?? {}
  if (!Array.isArray(items) || items.length === 0) return null

  const text = await callClaude({
    model: 'claude-haiku-4-5',
    maxTokens: 128,
    apiKey,
    messages: [
      {
        role: 'user',
        content: `Estime os macronutrientes TOTAIS desta refeição. Retorne APENAS JSON puro sem markdown:
{"cal":number,"prot":number,"carb":number,"fat":number}

Alimentos:
${items.join('\n')}

Arredonde para inteiros. Use estimativas realistas para porções brasileiras típicas.`,
      },
    ],
  })
  if (!text) return null
  return extractJSON(text)
}

async function handlePdfDiet(payload, apiKey) {
  const { pdfBase64 } = payload ?? {}
  if (!pdfBase64) return null

  const text = await callClaude({
    model: 'claude-haiku-4-5',
    maxTokens: 4096,
    apiKey,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: `Analise este plano alimentar. Retorne APENAS JSON puro, sem markdown, sem crases, sem texto antes ou depois.

Formato exato:
{"goals":{"cal":0,"prot":0,"carb":0,"fat":0},"meals":[{"time":"HH:MM","name":"string","cal":0,"prot":0,"carb":0,"fat":0,"items":["string"]}]}

Regras:
- Se houver múltiplas opções para uma refeição (Opção 1, Opção 2...), inclua APENAS a Opção 1 de cada refeição
- Se macro não estiver no PDF, use 0
- Horários sem valor: café manhã 07:00, lanche manhã 10:00, almoço 12:00, lanche tarde 15:30, jantar 19:00, ceia 21:30
- items = alimentos daquela refeição
- goals = soma dos macros de todas as refeições se não estiver explícito
- NÃO use markdown, NÃO use crases, comece a resposta direto com {`,
          },
        ],
      },
    ],
  })
  if (!text) return null
  const raw = extractJSON(text)
  if (!raw) return null
  return {
    ...raw,
    meals: (raw.meals ?? []).map(m => ({
      ...m,
      id: Math.random().toString(36).slice(2),
      done: false,
      items: m.items ?? [],
    })),
  }
}

async function handleOnboardingPlan(payload, apiKey) {
  const { conversation = [], userName } = payload ?? {}

  const system = `Você é o motor de geração de planos do The Rise Plan.
${userName ? `O nome do usuário é ${userName}.` : ''}
Com base na conversa de onboarding abaixo, gere o sistema inicial do usuário.

Responda APENAS com JSON puro, sem markdown, sem crases, sem texto antes ou depois, no formato exato:
{"summary":"string","goals":["string"],"values":["string"],"habits":[{"icon":"emoji","label":"string","why":"string"}],"focusSuggestion":"string","macros":{"cal":0,"prot":0,"carb":0,"fat":0}}

Regras:
- "summary": mensagem calorosa de boas-vindas (2-3 frases), citando algo específico que a pessoa contou
- "goals": 2-4 objetivos identificados na conversa, frases curtas e concretas
- "values": 2-4 valores pessoais por trás desses objetivos (ex: "saúde", "liberdade", "disciplina", "família", "crescimento")
- "habits": 4-6 hábitos diários sugeridos. Cada um com: "icon" = um único emoji relevante, "label" = nome curto (até 4 palavras), "why" = 1 frase conectando o hábito a um valor/objetivo específico que a pessoa mencionou — esse "why" será mostrado ao usuário sempre que ele não cumprir o hábito, então deve ser pessoal e motivador, nunca genérico
- "focusSuggestion": 1 sugestão concreta de prioridade para o primeiro dia, curta
- "macros": SOMENTE se a pessoa mencionou objetivos relacionados a peso, nutrição, dieta ou composição corporal — estimativa razoável de calorias/proteína/carbo/gordura diárias. Se não houver indício, omita esse campo inteiramente
- Responda em português brasileiro
- NÃO use markdown, comece a resposta direto com {`

  const messages = [
    ...conversation.map(m => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content:
        'Gere agora meu plano inicial completo no formato JSON especificado, com base em tudo que conversamos.',
    },
  ]

  const text = await callClaude({
    model: 'claude-sonnet-5',
    maxTokens: 2048,
    system,
    messages,
    apiKey,
  })
  if (!text) return null
  return extractJSON(text)
}

const WORKOUT_TYPES = ['Corrida', 'Caminhada', 'Academia', 'Ciclismo', 'Natação', 'Futebol', 'Outro']
const WORKOUT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

async function handleParseWorkout(payload, apiKey) {
  const { transcript, image } = payload ?? {}
  const described = String(transcript ?? '').trim()
  const hasImage = Boolean(image?.data) && WORKOUT_IMAGE_TYPES.includes(image?.mediaType)
  // Sem texto e sem imagem não há o que extrair.
  if (!described && !hasImage) return null

  const system = `Você extrai dados estruturados de um treino descrito em português brasileiro — por texto falado/digitado ou por uma foto (print de relógio esportivo, painel de esteira, tela de app de corrida, ou foto do visor de um aparelho).

Responda APENAS com JSON puro, sem markdown, sem crases, sem texto antes ou depois, no formato exato:
{"type":"string","name":"string","durationMin":number,"dist":number,"effort":number,"hr":number}

Regras:
- "type": exatamente um destes valores: ${WORKOUT_TYPES.join(', ')} — escolha o mais próximo do que foi descrito
- "name": nome curto para o treino (ex: "Corrida matinal", "Treino de pernas"); se não houver nome específico, gere um razoável a partir do tipo
- "durationMin": duração em minutos (converta horas se falado em horas); se não mencionado, estime com base no tipo e na distância, ou use 30
- "dist": distância em km (0 se não aplicável, ex: musculação). Se a tela mostrar milhas, converta para km
- "effort": grau de esforço percebido de 1 a 5 (1=leve, 2=moderado, 3=intenso, 4=muito intenso, 5=máximo); se não mencionado, deduza do ritmo/FC ou use 3
- "hr": frequência cardíaca média em bpm, 0 se não mencionado
- Se for uma imagem, leia os números do visor: tempo, distância, pace/velocidade e frequência cardíaca média. Ignore dados que não sejam do treino
- NÃO use markdown, comece a resposta direto com {`

  const content = []
  if (hasImage) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.data },
    })
  }
  content.push({
    type: 'text',
    text: described || 'Extraia os dados deste treino a partir da imagem.',
  })

  const text = await callClaude({
    model: 'claude-haiku-4-5',
    maxTokens: 512,
    system,
    messages: [{ role: 'user', content }],
    apiKey,
  })
  if (!text) return null
  const raw = extractJSON(text)
  if (!raw) return null

  return {
    type: WORKOUT_TYPES.includes(raw.type) ? raw.type : 'Outro',
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Atividade',
    durationMin: Math.max(1, Math.round(Number(raw.durationMin) || 30)),
    dist: Math.max(0, Number(raw.dist) || 0),
    effort: Math.min(5, Math.max(1, Math.round(Number(raw.effort) || 3))),
    hr: Math.max(0, Math.round(Number(raw.hr) || 0)),
  }
}

async function handleReflection(payload, apiKey) {
  const {
    habitsDone = 0,
    habitsTotal = 0,
    focusDone = 0,
    focusTotal = 0,
    mood = 0,
    energy = 0,
    userName,
  } = payload ?? {}

  const system = `Você é um coach reflexivo e gentil do The Rise Plan.
Gere UMA ÚNICA pergunta metacognitiva curta (máx. 20 palavras) para o check-in noturno do usuário, em português brasileiro, baseada nos dados do dia dele.
A pergunta deve convidar à reflexão real, não ser genérica tipo "como foi seu dia".
Responda APENAS com a pergunta, sem aspas, sem explicações, sem markdown.`

  const prompt = `Dados de hoje${userName ? ` de ${userName}` : ''}:
- Hábitos concluídos: ${habitsDone}/${habitsTotal}
- Prioridades concluídas: ${focusDone}/${focusTotal}
- Humor: ${mood > 0 ? `${mood}/5` : 'não registrado'}
- Energia: ${energy > 0 ? `${energy}/5` : 'não registrada'}`

  const text = await callClaude({
    model: 'claude-haiku-4-5',
    maxTokens: 100,
    system,
    messages: [{ role: 'user', content: prompt }],
    apiKey,
  })
  if (!text) return null
  return text.replace(/^["'""]+|["'""]+$/g, '').trim()
}

async function handleWeeklyReview(payload, apiKey) {
  const { weekSummary } = payload ?? {}
  if (!weekSummary) return null

  const system = `Você é o Coach IA do The Rise Plan, gerando a revisão semanal do usuário.
Com base no resumo de dados da semana abaixo, gere uma revisão estruturada em português brasileiro.

Responda APENAS com JSON puro, sem markdown, sem crases, sem texto antes ou depois, no formato exato:
{"summary":"string","wins":["string"],"slips":["string"],"question":"string","adjustment":"string"}

Regras:
- "summary": 2-3 frases resumindo a semana, tom direto e encorajador, citando números reais quando fizer sentido
- "wins": 2-4 vitórias específicas e concretas (cite hábitos, dias, números)
- "slips": 1-3 pontos de atenção/deslizes — tom de observação, NUNCA de culpa ou cobrança
- "question": 1 pergunta reflexiva para o usuário pensar sobre a próxima semana
- "adjustment": 1 sugestão concreta e pequena de ajuste para a próxima semana
- NÃO use markdown, comece a resposta direto com {`

  const text = await callClaude({
    model: 'claude-sonnet-5',
    maxTokens: 1024,
    system,
    messages: [{ role: 'user', content: weekSummary }],
    apiKey,
  })
  if (!text) return null
  return extractJSON(text)
}

const RISK_LEVELS = ['baixo', 'moderado', 'alto']

async function handleJournalInsights(payload, apiKey) {
  const { journalSummary } = payload ?? {}
  if (!journalSummary || !String(journalSummary).trim()) return null

  const system = `Você é um assistente de bem-estar do The Rise Plan, analisando o diário de treino do usuário — relatos de sentimentos, dores, motivação e cansaço — junto com o volume e a frequência de treinos recentes.

Seu objetivo é identificar sinais de possível sobrecarga física ou mental para ajudar o usuário a ajustar o treino a tempo. Você NÃO é terapeuta nem médico e NÃO deve fazer diagnóstico clínico.

Responda APENAS com JSON puro, sem markdown, sem crases, sem texto antes ou depois, no formato exato:
{"riskLevel":"baixo|moderado|alto","summary":"string","signals":["string"],"recommendation":"string"}

Regras:
- "riskLevel": "baixo" se os relatos indicam energia e motivação estáveis; "moderado" se há sinais recorrentes de cansaço, dor ou queda de motivação; "alto" se há sinais fortes ou repetidos de exaustão, dor persistente, burnout ou sofrimento emocional relevante
- "summary": 2-3 frases resumindo o que o diário revela sobre o estado físico e mental do usuário nesse período — tom acolhedor, direto, nunca alarmista
- "signals": 2-5 sinais concretos observados nos relatos (cite o que foi dito, ex: "menção a dor no joelho em 3 dos últimos 5 registros")
- "recommendation": 1-2 frases com uma sugestão prática — pode incluir ajuste no treino (descanso, redução de volume, troca de modalidade); se riskLevel for "alto" ou houver sinais de sofrimento emocional relevante, inclua com gentileza a sugestão de conversar com um profissional (médico, fisioterapeuta ou psicólogo)
- NÃO faça diagnóstico médico ou psicológico, apenas observe padrões e sugira cautela
- Responda em português brasileiro
- NÃO use markdown, comece a resposta direto com {`

  const text = await callClaude({
    model: 'claude-sonnet-5',
    maxTokens: 768,
    system,
    messages: [{ role: 'user', content: journalSummary }],
    apiKey,
  })
  if (!text) return null
  const raw = extractJSON(text)
  if (!raw) return null

  return {
    riskLevel: RISK_LEVELS.includes(raw.riskLevel) ? raw.riskLevel : 'baixo',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    signals: Array.isArray(raw.signals) ? raw.signals.filter(s => typeof s === 'string') : [],
    recommendation: typeof raw.recommendation === 'string' ? raw.recommendation : '',
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Rate limit per user to guard against token-cost abuse.
  const rl = await rateLimit(`completion:${user.localId}`, { limit: 30, windowMs: 60_000 })
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' })
  }

  // Assinatura em dia — checada DEPOIS do limitador (mais barata de negar) e
  // ANTES da chamada ao modelo, que é o que custa dinheiro de verdade. O paywall
  // da tela não protege nada aqui: este endpoint responde a qualquer `fetch`.
  if (await blockIfUnpaid(req, res, user)) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' })
  }

  const { type, payload } = req.body ?? {}

  try {
    let result = null

    if (type === 'macros')           result = await handleMacros(payload, apiKey)
    else if (type === 'pdf-diet')    result = await handlePdfDiet(payload, apiKey)
    else if (type === 'onboarding-plan') result = await handleOnboardingPlan(payload, apiKey)
    else if (type === 'parse-workout') result = await handleParseWorkout(payload, apiKey)
    else if (type === 'reflection')  result = await handleReflection(payload, apiKey)
    else if (type === 'weekly-review') result = await handleWeeklyReview(payload, apiKey)
    else if (type === 'journal-insights') result = await handleJournalInsights(payload, apiKey)
    else return res.status(400).json({ error: `Unknown type: ${type}` })

    return res.status(200).json({ result })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
