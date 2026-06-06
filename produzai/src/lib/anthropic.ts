import type { ManualWorkout } from '../store/useWorkoutStore'
import type { WebDietData } from '../store/useWebDietStore'
import type { HabitDef } from '../store/useHabitsStore'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

export function hasApiKey(): boolean {
  return !!API_KEY && API_KEY !== 'sua-chave-aqui'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages,
      }),
    })

    if (!res.ok) {
      let msg = `Erro HTTP ${res.status}`
      try {
        const body = await res.json() as { error?: { message?: string } }
        if (body.error?.message) msg = body.error.message
      } catch { /* noop */ }
      onError(msg)
      return
    }

    const reader = res.body!.getReader()
    const dec = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of dec.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const ev = JSON.parse(raw) as {
            type: string
            delta?: { type: string; text: string }
          }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            onChunk(ev.delta.text)
          }
        } catch { /* skip malformed */ }
      }
    }

    onDone()
  } catch (e) {
    onError((e as Error).message ?? 'Erro desconhecido')
  }
}

export function buildSystemPrompt(data: {
  workouts: ManualWorkout[]
  weekWorkouts: ManualWorkout[]
  wd: WebDietData | null
  habitDefs: HabitDef[]
  userName?: string
}): string {
  const { workouts, weekWorkouts, wd, habitDefs, userName } = data

  const weekKm  = Math.round(weekWorkouts.reduce((s, w) => s + w.dist, 0) * 10) / 10
  const weekCal = weekWorkouts.reduce((s, w) => s + w.cal, 0)

  const doneMeals = wd?.meals.filter(m => m.done) ?? []
  const calConsumed = doneMeals.reduce((s, m) => s + m.cal, 0)
  const protConsumed = doneMeals.reduce((s, m) => s + m.prot, 0)

  const nutrition = wd
    ? `- Meta calórica: ${wd.goals.cal} kcal/dia
- Consumido hoje: ${calConsumed} kcal (${wd.goals.cal > 0 ? Math.round(calConsumed / wd.goals.cal * 100) : 0}% da meta)
- Proteína: ${protConsumed}g de ${wd.goals.prot}g (meta)
- Carboidratos meta: ${wd.goals.carb}g | Gordura meta: ${wd.goals.fat}g
- Refeições marcadas hoje: ${doneMeals.length}/${wd.meals.length}`
    : '- Dieta não configurada pelo usuário'

  const habitsSection = habitDefs.length > 0
    ? habitDefs.map(h => `  • ${h.icon} ${h.label}`).join('\n')
    : '  Sem hábitos configurados'

  return `Você é o Coach IA do Rise Plan, um assistente pessoal de saúde, performance e desenvolvimento humano.
O usuário se chama ${userName || 'Atleta'}.

## Dados reais do usuário (hoje)

### Histórico de treinos
- Total de treinos registrados: ${workouts.length}
- Treinos esta semana: ${weekWorkouts.length}${weekWorkouts.length > 0 ? ` — ${weekWorkouts.map(w => `${w.name} (${w.time})`).join(', ')}` : ''}
- Distância esta semana: ${weekKm > 0 ? weekKm + 'km' : 'não registrada'}
- Calorias queimadas esta semana: ${weekCal > 0 ? weekCal + ' kcal' : 'não registrado'}

### Nutrição de hoje
${nutrition}

### Hábitos do usuário
${habitsSection}

## Como se comportar
- Responda SEMPRE em português brasileiro
- Seja direto, motivador e específico — use os dados reais acima para personalizar
- Aja como personal trainer + nutricionista ao mesmo tempo
- Respostas objetivas: 2-4 parágrafos no máximo
- Use marcadores (•) para listas, não use markdown pesado
- Quando falar de números, use os dados reais do usuário
- Se o usuário não tiver dados suficientes, incentive-o a registrar mais`
}
