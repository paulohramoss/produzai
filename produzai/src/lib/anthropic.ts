import type { ManualWorkout } from '../store/useWorkoutStore';
import type { WebDietData, WebDietMeal } from '../store/useWebDietStore';
import type { HabitDef } from '../store/useHabitsStore';
import { TRAINING_KNOWLEDGE } from '../rise/data/coachKnowledge';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

export function hasApiKey(): boolean {
  return !!API_KEY && API_KEY !== 'sua-chave-aqui';
}

export interface ChatAttachment {
  name: string;
  mediaType: string;
  data: string; // base64, no "data:" prefix
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachment?: ChatAttachment;
}

function toApiMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    // Attachments are stripped (data: '') before being persisted to storage,
    // so rehydrated history may carry a reference with no actual file data.
    if (!m.attachment?.data) {
      return {
        role: m.role,
        content:
          m.content.trim() ||
          'Anexo enviado anteriormente (não disponível nesta sessão).',
      };
    }
    const isPdf = m.attachment.mediaType === 'application/pdf';
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
    };
  });
}

function extractJSON<T>(text: string): T | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

async function callClaude(opts: {
  model: string;
  maxTokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string | null> {
  if (!hasApiKey()) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        messages: opts.messages,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return (body.content.find((c) => c.type === 'text')?.text ?? '').trim();
  } catch {
    return null;
  }
}

export async function streamCoach(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        stream: true,
        system: systemPrompt,
        messages: toApiMessages(messages),
      }),
    });

    if (!res.ok) {
      let msg = `Erro HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) msg = body.error.message;
      } catch {
        /* noop */
      }
      onError(msg);
      return;
    }

    const reader = res.body!.getReader();
    const dec = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw) as {
            type: string;
            delta?: { type: string; text: string };
          };
          if (
            ev.type === 'content_block_delta' &&
            ev.delta?.type === 'text_delta'
          ) {
            onChunk(ev.delta.text);
          }
        } catch {
          /* skip malformed */
        }
      }
    }

    onDone();
  } catch (e) {
    onError((e as Error).message ?? 'Erro desconhecido');
  }
}

export async function estimateMealMacros(
  items: string[],
): Promise<{ cal: number; prot: number; carb: number; fat: number } | null> {
  if (!API_KEY || API_KEY === 'sua-chave-aqui' || items.length === 0)
    return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
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
    }),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  let text = (body.content.find((c) => c.type === 'text')?.text ?? '').trim();
  text = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(text) as {
      cal: number;
      prot: number;
      carb: number;
      fat: number;
    };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match)
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    return null;
  }
}

export async function parsePdfDiet(
  pdfBase64: string,
): Promise<WebDietData | null> {
  if (!API_KEY || API_KEY === 'sua-chave-aqui') return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
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
    }),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    stop_reason?: string;
  };
  let text = (body.content.find((c) => c.type === 'text')?.text ?? '').trim();

  // strip markdown code fences if model ignores instructions
  text = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  function hydrate(raw: WebDietData): WebDietData {
    return {
      ...raw,
      meals: (raw.meals ?? []).map((m: WebDietMeal) => ({
        ...m,
        id: Math.random().toString(36).slice(2),
        done: false,
        items: m.items ?? [],
      })),
    };
  }

  try {
    return hydrate(JSON.parse(text) as WebDietData);
  } catch {
    // extract first complete JSON object
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return hydrate(JSON.parse(match[0]) as WebDietData);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

export function buildSystemPrompt(data: {
  workouts: ManualWorkout[];
  weekWorkouts: ManualWorkout[];
  wd: WebDietData | null;
  habitDefs: HabitDef[];
  userName?: string;
}): string {
  const { workouts, weekWorkouts, wd, habitDefs, userName } = data;

  const weekKm =
    Math.round(weekWorkouts.reduce((s, w) => s + w.dist, 0) * 10) / 10;
  const weekCal = weekWorkouts.reduce((s, w) => s + w.cal, 0);

  const doneMeals = wd?.meals.filter((m) => m.done) ?? [];
  const calConsumed = doneMeals.reduce((s, m) => s + m.cal, 0);
  const protConsumed = doneMeals.reduce((s, m) => s + m.prot, 0);

  const nutrition = wd
    ? `- Meta calórica: ${wd.goals.cal} kcal/dia
- Consumido hoje: ${calConsumed} kcal (${wd.goals.cal > 0 ? Math.round((calConsumed / wd.goals.cal) * 100) : 0}% da meta)
- Proteína: ${protConsumed}g de ${wd.goals.prot}g (meta)
- Carboidratos meta: ${wd.goals.carb}g | Gordura meta: ${wd.goals.fat}g
- Refeições marcadas hoje: ${doneMeals.length}/${wd.meals.length}`
    : '- Dieta não configurada pelo usuário';

  const habitsSection =
    habitDefs.length > 0
      ? habitDefs.map((h) => `  • ${h.icon} ${h.label}`).join('\n')
      : '  Sem hábitos configurados';

  return `Você é o Coach IA do Rise Plan, um assistente pessoal de saúde, performance e desenvolvimento humano.
O usuário se chama ${userName || 'Atleta'}.

## Dados reais do usuário (hoje)

### Histórico de treinos
- Total de treinos registrados: ${workouts.length}
- Treinos esta semana: ${weekWorkouts.length}${weekWorkouts.length > 0 ? ` — ${weekWorkouts.map((w) => `${w.name} (${w.time})`).join(', ')}` : ''}
- Distância esta semana: ${weekKm > 0 ? weekKm + 'km' : 'não registrada'}
- Calorias queimadas esta semana: ${weekCal > 0 ? weekCal + ' kcal' : 'não registrado'}

### Nutrição de hoje
${nutrition}

### Hábitos do usuário
${habitsSection}

${TRAINING_KNOWLEDGE}

## Como se comportar
- Responda SEMPRE em português brasileiro
- Seja direto, motivador e específico — use os dados reais acima para personalizar
- Aja como personal trainer + nutricionista ao mesmo tempo
- Respostas objetivas: 2-4 parágrafos no máximo, EXCETO quando o usuário pedir um plano completo, periodização, cronograma de treinos ou algo similar — nesses casos pode ser mais longo e estruturado (com seções, semanas, dias), sem cortar informação por causa de tamanho
- Use marcadores (•) para listas, não use markdown pesado
- Quando falar de números, use os dados reais do usuário
- Se o usuário não tiver dados suficientes, incentive-o a registrar mais
- Ao sugerir treinos, planos semanais ou progressões, baseie-se na metodologia da seção "Base de conhecimento de treinamento" acima, adaptando ao nível e objetivo do usuário`;
}

// ── Onboarding conversacional ────────────────────────────────────────────────

export function onboardingSystemPrompt(userName?: string): string {
  return `Você é o assistente de boas-vindas do The Rise Plan, um app de performance pessoal (treino, dieta, hábitos, mente).
${userName ? `O nome do usuário é ${userName}.` : ''}

Sua missão é fazer uma ENTREVISTA curta e calorosa para entender a pessoa antes de montar o sistema dela — em vez de jogar um formulário vazio na cara dela.

Como conduzir:
- Faça UMA OU DUAS perguntas por vez, nunca uma lista longa
- Pergunte sobre: (1) objetivos atuais (saúde, carreira, projetos pessoais), (2) rotina do dia (trabalho, treino, sono, horários), (3) valores — o que realmente importa pra essa pessoa por trás desses objetivos (ex: liberdade, saúde, disciplina, família, autoestima)
- Seja breve, humano, use o nome da pessoa quando souber
- Não use markdown pesado, nada de listas numeradas longas
- Depois de 2-3 trocas, você já deve ter informação suficiente — sinalize isso dizendo algo como "já tenho uma boa ideia do seu momento, quando quiser é só clicar em 'Gerar meu plano'"
- Nunca gere o plano final dentro da conversa normal — isso é feito em uma chamada separada
- Responda SEMPRE em português brasileiro, em 1-3 frases curtas por mensagem`;
}

export interface OnboardingPlan {
  summary: string;
  goals: string[];
  values: string[];
  habits: Array<{ icon: string; label: string; why: string }>;
  focusSuggestion: string;
  macros?: { cal: number; prot: number; carb: number; fat: number };
}

export async function generateOnboardingPlan(
  conversation: ChatMessage[],
  userName?: string,
): Promise<OnboardingPlan | null> {
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
- NÃO use markdown, comece a resposta direto com {`;

  const messages = [
    ...conversation.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user' as const,
      content:
        'Gere agora meu plano inicial completo no formato JSON especificado, com base em tudo que conversamos.',
    },
  ];

  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    system,
    messages,
  });
  if (!text) return null;
  return extractJSON<OnboardingPlan>(text);
}

// ── Reflexão diária ──────────────────────────────────────────────────────────

const FALLBACK_REFLECTION_QUESTIONS = [
  'O que te deu mais energia hoje, e como você pode ter mais disso amanhã?',
  'Qual foi o momento mais difícil do seu dia — e o que ele te ensinou sobre você?',
  'Se hoje fosse uma nota de 0 a 10, qual seria, e o que faria ela subir 1 ponto?',
  'O que você fez hoje que seu "eu" de daqui a um ano agradeceria?',
  'Teve algum momento hoje em que você se sentiu mais você mesmo? Como foi?',
  'O que você está evitando fazer, e o que isso te custa continuar evitando?',
  'Qual pequena decisão de hoje pode ter um impacto grande se você repetir ela amanhã?',
  'O que hoje te lembrou por que você está construindo esses hábitos?',
  'Se pudesse refazer uma hora do seu dia, qual seria e o que mudaria?',
  'O que está pesando na sua cabeça agora que ainda não foi dito em voz alta?',
  'Você se sentiu mais no controle ou mais reativo hoje? Por quê?',
  'Qual foi a coisa mais gentil que você fez por si mesmo hoje?',
];

export function fallbackReflectionQuestion(seed: number): string {
  const idx = ((seed % FALLBACK_REFLECTION_QUESTIONS.length) + FALLBACK_REFLECTION_QUESTIONS.length) % FALLBACK_REFLECTION_QUESTIONS.length;
  return FALLBACK_REFLECTION_QUESTIONS[idx];
}

export async function generateReflectionQuestion(ctx: {
  habitsDone: number;
  habitsTotal: number;
  focusDone: number;
  focusTotal: number;
  mood: number;
  energy: number;
  userName?: string;
}): Promise<string | null> {
  const system = `Você é um coach reflexivo e gentil do The Rise Plan.
Gere UMA ÚNICA pergunta metacognitiva curta (máx. 20 palavras) para o check-in noturno do usuário, em português brasileiro, baseada nos dados do dia dele.
A pergunta deve convidar à reflexão real, não ser genérica tipo "como foi seu dia".
Responda APENAS com a pergunta, sem aspas, sem explicações, sem markdown.`;

  const prompt = `Dados de hoje${ctx.userName ? ` de ${ctx.userName}` : ''}:
- Hábitos concluídos: ${ctx.habitsDone}/${ctx.habitsTotal}
- Prioridades concluídas: ${ctx.focusDone}/${ctx.focusTotal}
- Humor: ${ctx.mood > 0 ? `${ctx.mood}/5` : 'não registrado'}
- Energia: ${ctx.energy > 0 ? `${ctx.energy}/5` : 'não registrada'}`;

  const text = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 100,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  if (!text) return null;
  return text.replace(/^["'“”]+|["'“”]+$/g, '').trim();
}

// ── Revisão semanal ──────────────────────────────────────────────────────────

export interface WeeklyReviewResult {
  summary: string;
  wins: string[];
  slips: string[];
  question: string;
  adjustment: string;
}

export async function generateWeeklyReview(
  weekSummary: string,
): Promise<WeeklyReviewResult | null> {
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
- NÃO use markdown, comece a resposta direto com {`;

  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    system,
    messages: [{ role: 'user', content: weekSummary }],
  });
  if (!text) return null;
  return extractJSON<WeeklyReviewResult>(text);
}
