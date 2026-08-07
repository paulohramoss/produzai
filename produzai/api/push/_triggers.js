// Motor de gatilhos do coaching proativo.
//
// A regra que separa "coach que fala primeiro" de "app que manda spam" é uma
// só: cada notificação precisa de um MOTIVO vindo dos dados. Este arquivo não
// calcula nada — ele lê o snapshot publicado pelo cliente (ver
// `src/lib/coachSnapshot.ts`) e escolhe o gatilho mais relevante do dia.
//
// Os gatilhos estão em ordem de prioridade: o primeiro que casar vence, e no
// máximo UM é enviado por dia.

const SESSION_LABELS = {
  easy: 'rodagem fácil',
  long: 'longo',
  quality: 'treino de qualidade',
  strength: 'treino de força',
  race: 'prova',
  rest: 'descanso',
}

function firstName(snapshot) {
  const name = String(snapshot.displayName || '').trim()
  return name ? name.split(/\s+/)[0] : null
}

/**
 * Todos os gatilhos. `when` recebe o snapshot e devolve a notificação, ou null.
 * `key` identifica o gatilho para não repetir o mesmo aviso dias seguidos.
 */
const TRIGGERS = [
  {
    key: 'acwr-risco',
    // Nunca repete em menos de 3 dias: o atleta já sabe, avisar de novo é ruído.
    cooldownDays: 3,
    when: s => {
      if (s.acwrStatus !== 'risco' || s.acwr == null) return null
      return {
        title: '⚠️ Sua carga subiu rápido demais',
        body: `ACWR em ${s.acwr} — bem acima da sua média das últimas 4 semanas. É o padrão que costuma vir antes de lesão. Que tal uma semana mais leve?`,
        url: '/?page=treino',
      }
    },
  },
  {
    key: 'recuperacao-baixa',
    cooldownDays: 2,
    when: s => {
      const hrvDown = s.hrvDeviationPct != null && s.hrvDeviationPct <= -12
      const rhrUp = s.restingHrDelta != null && s.restingHrDelta >= 6
      if (!hrvDown && !rhrUp) return null
      const detail = hrvDown
        ? `Sua VFC está ${Math.abs(Math.round(s.hrvDeviationPct))}% abaixo da sua linha de base`
        : `Sua FC de repouso está ${s.restingHrDelta} bpm acima do normal`
      return {
        title: '💤 Seu corpo está pedindo recuperação',
        body: `${detail}. Hoje o ganho está no descanso — sono, comida e movimento leve.`,
        url: '/?page=hoje',
      }
    },
  },
  {
    key: 'forma-sobrecarga',
    cooldownDays: 4,
    when: s => {
      if (s.form == null || s.form >= -30) return null
      return {
        title: '🔋 Fadiga acumulada alta',
        body: `Sua forma está em ${Math.round(s.form)} — a fadiga passou o que seu condicionamento sustenta. Alguns dias leves agora valem mais que forçar.`,
        url: '/?page=treino',
      }
    },
  },
  {
    key: 'sumiu',
    cooldownDays: 3,
    when: s => {
      if (s.daysSinceWorkout == null || s.daysSinceWorkout < 4) return null
      const name = firstName(s)
      return {
        title: '👋 Faz uns dias',
        body: `${name ? `${name}, s` : 'S'}eu último treino foi há ${s.daysSinceWorkout} dias. Não precisa ser o treino perfeito — 20 minutos leves já seguram sua base.`,
        url: '/?page=treino',
      }
    },
  },
  {
    key: 'sessao-hoje',
    cooldownDays: 0, // esta é diária de propósito: é a agenda do atleta
    when: s => {
      if (!s.todaySession) return null
      const label = SESSION_LABELS[s.todaySession.kind] ?? 'treino'
      const readiness = s.readiness != null && s.readiness < 45
        ? ' Sua prontidão hoje está baixa — se pegar pesado, segure a intensidade.'
        : ''
      return {
        title: `📋 Hoje: ${s.todaySession.title}`,
        body: `${s.todaySession.targetMin} min de ${label}.${readiness}`,
        url: '/?page=plano',
      }
    },
  },
  {
    key: 'dia-forte',
    cooldownDays: 2,
    when: s => {
      if (s.readiness == null || s.readiness < 80) return null
      if (s.acwrStatus === 'risco' || s.acwrStatus === 'atencao') return null
      return {
        title: '🚀 Hoje você está pronto pra forçar',
        body: `Prontidão em ${s.readiness}/100 — a melhor janela da semana para o treino mais duro.`,
        url: '/?page=treino',
      }
    },
  },
  {
    key: 'volume-caiu',
    cooldownDays: 5,
    when: s => {
      if (s.previousWeeklyWorkouts < 3) return null
      if (s.weeklyWorkouts >= s.previousWeeklyWorkouts - 1) return null
      return {
        title: '📉 Semana mais curta que a anterior',
        body: `${s.weeklyWorkouts} treinos nesta semana contra ${s.previousWeeklyWorkouts} na passada. Sem culpa — só vale olhar se algo na rotina mudou.`,
        url: '/?page=insights',
      }
    },
  },
  {
    key: 'monotonia',
    cooldownDays: 7,
    when: s => {
      if (s.monotony == null || s.monotony < 2) return null
      return {
        title: '🔁 Seus dias estão todos iguais',
        body: 'Falta contraste entre fácil e forte na sua semana. Alternar dias realmente leves com dias realmente fortes rende mais que a média constante.',
        url: '/?page=treino',
      }
    },
  },
  {
    key: 'proxima-sessao',
    cooldownDays: 2,
    when: s => {
      if (!s.nextSession || s.todaySession) return null
      const label = SESSION_LABELS[s.nextSession.kind] ?? 'treino'
      return {
        title: '📅 Próxima sessão do seu plano',
        body: `${s.nextSession.date}: ${s.nextSession.title} — ${s.nextSession.targetMin} min de ${label}.`,
        url: '/?page=plano',
      }
    },
  },
]

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Escolhe o que notificar hoje.
 * @param snapshot  Documento `data/coachSnapshot` do usuário.
 * @param history   `{ [key]: timestamp }` do último envio de cada gatilho.
 * @returns `{ key, title, body, url }` ou null quando nada é relevante.
 */
export function pickNotification(snapshot, history = {}, now = Date.now()) {
  if (!snapshot) return null

  // Snapshot velho descreve um atleta que não existe mais — melhor calar.
  if (!snapshot.updatedAt || now - snapshot.updatedAt > 14 * DAY_MS) return null

  for (const trigger of TRIGGERS) {
    const lastSent = history[trigger.key]
    if (lastSent && now - lastSent < trigger.cooldownDays * DAY_MS) continue

    const result = trigger.when(snapshot)
    if (result) return { key: trigger.key, ...result }
  }

  return null
}

/** Hora local do usuário, para não notificar de madrugada. */
export function localHour(timeZone, now = new Date()) {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now),
    )
  } catch {
    return now.getUTCHours()
  }
}
