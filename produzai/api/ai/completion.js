// Non-streaming AI completions: macros estimation, PDF diet parsing,
// onboarding plan generation, daily reflection, and weekly review.
// All calls are authenticated via Firebase ID token and use the server-side
// ANTHROPIC_API_KEY — never exposed to the browser.

import { verifyToken } from './_auth.js'
import { rateLimit } from './_rateLimit.js'

async function callClaude({ model, maxTokens, system, messages, apiKey, outputConfig }) {
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
      ...(outputConfig ? { output_config: outputConfig } : {}),
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
    model: 'claude-haiku-4-5-20251001',
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
    model: 'claude-haiku-4-5-20251001',
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
    model: 'claude-sonnet-4-6',
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
/** Duração típica por tipo — o palpite quando nem o texto nem a imagem dizem o tempo. */
const WORKOUT_DEFAULT_DURATION = {
  Corrida: 40, Caminhada: 40, Academia: 60, Ciclismo: 60, Natação: 45, Futebol: 60, Outro: 45,
}
/** Espelha MAX_EXERCISES de src/lib/exercises.ts — o cliente saneia de novo ao salvar. */
const WORKOUT_MAX_EXERCISES = 40

/**
 * A planilha escreve "27,5" e o modelo às vezes devolve assim, como texto.
 * Só aceita número puro: "5X5" e "PB" viram NaN (e depois 0) em vez de virarem
 * carga inventada — carga errada no histórico estraga a progressão.
 */
function toNumber(raw) {
  if (typeof raw === 'number') return raw
  if (typeof raw !== 'string') return NaN
  const cleaned = raw.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN
}

/** Corta no último espaço antes do limite, para não partir palavra ao meio. */
function clampText(raw, max) {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

/** Poda a lista antes de devolver: nome obrigatório, campos curtos, teto de linhas. */
function normalizeExercises(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    // Uma linha de planilha emenda exercício e prescrição, então o nome tem folga.
    const name = clampText(item.name, 90)
    if (!name) continue
    const sets = Math.round(toNumber(item.sets))
    const loadKg = toNumber(item.loadKg)
    const note = clampText(item.note, 80)
    out.push({
      name,
      sets: Number.isFinite(sets) && sets > 0 ? Math.min(sets, 20) : 0,
      reps: clampText(item.reps, 32),
      loadKg: Number.isFinite(loadKg) && loadKg > 0 ? Math.min(Math.round(loadKg * 2) / 2, 500) : 0,
      ...(note ? { note } : {}),
    })
    if (out.length >= WORKOUT_MAX_EXERCISES) break
  }
  return out
}

/** Aceita só "YYYY-MM-DD" real e nunca no futuro; qualquer outra coisa vira `today`. */
function normalizeWorkoutDate(raw, today) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today
  const [y, m, d] = raw.split('-').map(Number)
  const parsed = new Date(y, m - 1, d)
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return today
  return raw > today ? today : raw
}

async function handleParseWorkout(payload, apiKey) {
  const { transcript, image, today } = payload ?? {}
  const described = String(transcript ?? '').trim()
  const hasImage = Boolean(image?.data) && WORKOUT_IMAGE_TYPES.includes(image?.mediaType)
  // Sem texto e sem imagem não há o que extrair.
  if (!described && !hasImage) return null

  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(String(today)) ? today : new Date().toISOString().slice(0, 10)

  const system = `Você extrai dados estruturados de um treino a partir de português brasileiro — texto falado/digitado, uma foto, ou os dois juntos.

A foto pode ser:
- print de relógio esportivo, painel de esteira ou tela do Strava/Garmin Connect;
- foto de uma PLANILHA ou PRESCRIÇÃO de treino (tabela com lista de exercícios, séries, repetições e cargas), inclusive foto de tela de computador, torta, com reflexo ou parcialmente cortada.

Responda APENAS com JSON puro, sem markdown, sem crases, sem texto antes ou depois, no formato exato:
{"type":"string","name":"string","date":"YYYY-MM-DD","durationMin":number,"dist":number,"effort":number,"hr":number,"exercises":[{"name":"string","sets":number,"reps":"string","loadKg":number,"note":"string"}]}

Regra geral: PREENCHA TODOS OS CAMPOS. Nunca devolva campo vazio ou nulo — quando o dado não estiver explícito, deduza o valor mais provável a partir do restante do que foi enviado.

- "type": exatamente um destes valores: ${WORKOUT_TYPES.join(', ')}. Planilha de musculação/força/preventivos com exercícios e cargas = "Academia", mesmo que o título cite outro esporte. Treino de campo com bola = "Futebol".
- "name": nome curto e específico do treino. Se a imagem tiver título ou identificação (ex: "TREINO A", "Preventivos futebol", "Semana 01"), use-a — ex: "Treino A — Preventivos futebol". Sem título, gere um nome a partir do tipo e do conteúdo (ex: "Treino de pernas", "Corrida matinal").
- "date": data do treino. Hoje é ${hoje}. Converta expressões relativas ("hoje", "ontem", "sexta passada") e datas escritas na imagem (ex: "03/8" no ano corrente vira ${hoje.slice(0, 4)}-08-03). Se a imagem mostrar um PERÍODO de programa (ex: "início 03/8 até 18/09"), isso é a validade do plano e NÃO a data da sessão: use ${hoje}. Sem qualquer indício, use ${hoje}. Nunca devolva data futura.
- "durationMin": duração em minutos. Converta horas. Numa planilha de força, estime pela carga de trabalho: conte os exercícios e multiplique as séries por ~2,5 min (execução + pausa), somando aquecimento e o HIIT/condicionamento quando aparecerem. Sem qualquer base, use a duração típica do tipo (Academia 60, Corrida 40, Futebol 60).
- "dist": distância em km. 0 quando não se aplica (musculação, futebol). Converta milhas para km.
- "effort": esforço percebido de 1 a 5 (1=leve, 2=moderado, 3=intenso, 4=muito intenso, 5=máximo). Deduza do ritmo, da FC, do volume de séries, da presença de HIIT ou de palavras como "acelerado", "sem pausa", "carga alta". Na dúvida use 3.
- "hr": frequência cardíaca média em bpm. Só preencha se aparecer de fato (visor, relógio, fala); caso contrário 0 — não invente FC a partir de uma planilha.
- "exercises": UMA ENTRADA POR EXERCÍCIO, na ordem em que aparecem, quando houver lista de exercícios (planilha, prescrição, ou fala do tipo "fiz supino 3x10 com 40kg"). Array vazio [] em treino de cardio puro. Máximo ${WORKOUT_MAX_EXERCISES} entradas.
  - "name": nome do exercício como está escrito, sem a prescrição junto — "Cadeira extensora", "Agachamento taça + panturrilha", "Supino reto máquina". Corrija apenas caixa e acento ("MESA FLEXORA" vira "Mesa flexora").
  - "sets": número de séries (coluna "SÉRIES"). 0 se não houver.
  - "reps": repetições como texto, do jeito que a planilha diz — "15", "10 a 12", "20 cada perna", "30s", "20x". "" se não houver.
  - "loadKg": carga em kg, só quando for número (27,5 vira 27.5). Use 0 para peso corporal, para carga não informada e para siglas ("PB", "5X5") — nesse caso ponha o texto original em "note". Não confunda a coluna de carga com a de séries ou repetições.
  - "note": observação daquela linha que não cabe nos outros campos — "sem pausa", "acelerado", "carga alta + cadência baixa", "PB". "" quando não houver.
  - Uma linha que descreve duas coisas emendadas ("ABD supra 15 repetições + 30s prancha ventral") é UM exercício só, com o texto inteiro no nome.
- Numa planilha, ignore o que não descreve a sessão: cabeçalhos de coluna, nomes de professor, numeração de semanas, legendas, alternâncias tipo "ÍMPAR/PARES" (mantenha essas como parte do nome do exercício se estiverem coladas nele).
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

  // Ler planilha fotografada é OCR denso: só o texto vai no modelo rápido.
  const text = hasImage
    ? await callClaude({
        model: 'claude-opus-5',
        // Uma planilha cheia sai com ~20 linhas de exercício; o raciocínio do
        // modelo divide esse teto com a resposta, daí a folga.
        maxTokens: 8192,
        outputConfig: { effort: 'medium' },
        system,
        messages: [{ role: 'user', content }],
        apiKey,
      })
    : await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 1536,
        system,
        messages: [{ role: 'user', content }],
        apiKey,
      })
  if (!text) return null
  const raw = extractJSON(text)
  if (!raw) return null

  const type = WORKOUT_TYPES.includes(raw.type) ? raw.type : 'Outro'
  return {
    type,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Atividade',
    date: normalizeWorkoutDate(raw.date, hoje),
    durationMin: Math.max(1, Math.round(Number(raw.durationMin) || WORKOUT_DEFAULT_DURATION[type])),
    dist: Math.max(0, Number(raw.dist) || 0),
    effort: Math.min(5, Math.max(1, Math.round(Number(raw.effort) || 3))),
    hr: Math.max(0, Math.round(Number(raw.hr) || 0)),
    exercises: normalizeExercises(raw.exercises),
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
    model: 'claude-haiku-4-5-20251001',
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
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    system,
    messages: [{ role: 'user', content: weekSummary }],
    apiKey,
  })
  if (!text) return null
  return extractJSON(text)
}

async function handleWorkoutSummary(payload, apiKey) {
  const { briefing, userName, weekContext } = payload ?? {}
  if (!briefing) return null

  const system = `Você é o Coach IA do The Rise Plan analisando UM treino específico${userName ? ` de ${userName}` : ''}.
Os números abaixo já foram calculados a partir dos dados reais do relógio/GPS — sua função é interpretá-los, não recalculá-los.

Responda APENAS com JSON puro, sem markdown, sem crases, sem texto antes ou depois, no formato exato:
{"verdict":"string","headline":"string","reading":"string","highlights":["string"],"watchouts":["string"],"nextStep":"string"}

Regras:
- "verdict": exatamente um destes: "excelente", "solido", "regular", "alerta" — o julgamento geral da execução do treino
- "headline": uma frase curta (máx. 10 palavras) que resume o treino, tipo manchete
- "reading": 2-3 frases interpretando o que os números dizem sobre a execução. Cite números reais. Explique o PORQUÊ, não repita a tabela
- "highlights": 1-3 pontos positivos concretos e específicos
- "watchouts": 0-2 pontos de atenção. Tom técnico e de observação, nunca culpa. Se não houver nada relevante, devolva lista vazia
- "nextStep": 1 recomendação concreta para o PRÓXIMO treino, coerente com o que aconteceu neste
- Interprete a deriva cardíaca assim: abaixo de 5% = boa durabilidade aeróbica; 5-10% = base ainda em construção; acima de 10% = o esforço foi longo/intenso demais para a base atual
- Interprete a distribuição de zonas com a lógica 80/20: rodagem fácil deve ficar majoritariamente em Z1-Z2; se um treino que era para ser leve teve muito Z3+, aponte isso
- Se faltarem dados (sem FC, sem GPS), diga o que não dá para avaliar em vez de inventar
- Responda em português brasileiro
- NÃO use markdown, comece a resposta direto com {`

  const prompt = weekContext ? `${briefing}\n\n## Contexto da semana\n${weekContext}` : briefing

  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    system,
    messages: [{ role: 'user', content: prompt }],
    apiKey,
  })
  if (!text) return null
  return extractJSON(text)
}

const SESSION_KINDS = ['easy', 'long', 'quality', 'strength', 'rest', 'race']
const PACE_KEYS = ['easy', 'marathon', 'threshold', 'interval', 'repetition']

async function handleTrainingPlan(payload, apiKey) {
  const { briefing, startDate, days = 14, userName } = payload ?? {}
  if (!briefing || !startDate) return null

  const system = `Você é o Coach IA do The Rise Plan montando um bloco de ${days} dias de treino${userName ? ` para ${userName}` : ''}.
Os números do atleta abaixo (condicionamento, fadiga, forma, carga, ritmos) já foram calculados dos dados reais dele — use-os, não invente outros.

Responda APENAS com JSON puro, sem markdown, sem crases, sem texto antes ou depois, no formato exato:
{"focus":"string","sessions":[{"date":"YYYY-MM-DD","kind":"string","title":"string","description":"string","targetMin":number,"targetKm":number,"targetPaceKey":"string","why":"string"}]}

Regras:
- Gere EXATAMENTE ${days} dias corridos, começando em ${startDate}, um objeto por dia, sem pular nem repetir data
- "kind": exatamente um de ${SESSION_KINDS.join(', ')}
- "targetPaceKey": exatamente um de ${PACE_KEYS.join(', ')}, ou omita quando não se aplica (força, descanso)
- "targetKm": omita quando não se aplica (força, descanso, ou treino guiado por tempo)
- Em dia de descanso use kind "rest", targetMin 0 e uma descrição do que fazer de recuperação (sono, mobilidade, caminhada leve)
- "description": instrução concreta e executável — aquecimento, blocos, recuperação entre blocos, volta à calma. Nada de "corra confortável" solto
- "why": uma frase dizendo o que ESSA sessão treina e por que está nesse dia
- "focus": uma frase resumindo a intenção do bloco inteiro
- RESPEITE os dias disponíveis informados: fora deles, use "rest" ou uma sessão bem curta
- Distribua a intensidade em 80/20: a grande maioria do volume em ritmo fácil, no máximo 2 sessões de qualidade por semana, nunca em dias consecutivos
- Progrida o volume no máximo 10% por semana em relação à carga atual do atleta
- Se a forma (TSB) estiver muito negativa ou o ACWR alto, comece o bloco com uma semana mais leve antes de progredir
- Se houver prova marcada, oriente o bloco para ela e reduza o volume nos últimos 7 dias antes dela
- Responda em português brasileiro
- NÃO use markdown, comece a resposta direto com {`

  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    maxTokens: 8192,
    system,
    messages: [{ role: 'user', content: briefing }],
    apiKey,
  })
  if (!text) return null

  const raw = extractJSON(text)
  if (!raw || !Array.isArray(raw.sessions)) return null

  // Normaliza no servidor: o cliente confia neste formato para renderizar e
  // para as regras de adaptação, então nada mal formado pode passar.
  const sessions = raw.sessions
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(String(s?.date ?? '')))
    .map(s => {
      const kind = SESSION_KINDS.includes(s.kind) ? s.kind : 'easy'
      const targetMin = kind === 'rest' ? 0 : Math.max(0, Math.round(Number(s.targetMin) || 30))
      const targetKm = Number(s.targetKm)
      return {
        date: s.date,
        kind,
        title: String(s.title ?? '').trim() || 'Sessão',
        description: String(s.description ?? '').trim(),
        targetMin,
        why: String(s.why ?? '').trim(),
        ...(Number.isFinite(targetKm) && targetKm > 0 ? { targetKm: Math.round(targetKm * 10) / 10 } : {}),
        ...(PACE_KEYS.includes(s.targetPaceKey) ? { targetPaceKey: s.targetPaceKey } : {}),
      }
    })

  if (sessions.length === 0) return null

  return { focus: String(raw.focus ?? '').trim() || 'Bloco de treino', sessions }
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
  const rl = rateLimit(`completion:${user.localId}`, { limit: 30, windowMs: 60_000 })
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' })
  }

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
    else if (type === 'workout-summary') result = await handleWorkoutSummary(payload, apiKey)
    else if (type === 'training-plan') result = await handleTrainingPlan(payload, apiKey)
    else return res.status(400).json({ error: `Unknown type: ${type}` })

    return res.status(200).json({ result })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
