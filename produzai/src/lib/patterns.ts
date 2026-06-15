import type { DailyData, MentalEntry, HabitDef } from './db'
import type { ManualWorkout } from '../store/useWorkoutStore'

export interface PatternInsight {
  icon: string
  title: string
  detail: string
  tone: 'positive' | 'neutral' | 'attention'
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const DAY_MS = 24 * 60 * 60 * 1000

function dateToMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function completionRate(daily: DailyData): number | null {
  if (!daily.habits || daily.habits.length === 0) return null
  const done = daily.habits.filter(h => h.done).length
  return done / daily.habits.length
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 5) return null
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

/**
 * Motor de detecção de padrões — roda 100% localmente sobre o histórico do
 * usuário (sem chamadas de IA), então funciona offline e sem custo.
 */
export function analyzePatterns(opts: {
  dailyHistory: Record<string, DailyData>
  mentalHistory: Record<string, MentalEntry>
  habitDefs: HabitDef[]
  workouts: ManualWorkout[]
}): PatternInsight[] {
  const { dailyHistory, mentalHistory, habitDefs, workouts } = opts
  const dates = Object.keys(dailyHistory).sort()
  const insights: PatternInsight[] = []

  if (dates.length < 5) {
    return [{
      icon: '🌱',
      title: 'Seus padrões estão sendo construídos',
      detail: 'Continue marcando seus hábitos e seu humor diariamente. Em poucos dias, esta página começa a revelar padrões únicos sobre como você funciona.',
      tone: 'neutral',
    }]
  }

  // ── 1. Melhor / pior dia da semana para hábitos ─────────────────────────
  const byWeekday: Record<number, number[]> = {}
  for (const d of dates) {
    const rate = completionRate(dailyHistory[d])
    if (rate === null) continue
    const wd = weekdayOf(d)
    ;(byWeekday[wd] ??= []).push(rate)
  }
  const weekdayAverages = Object.entries(byWeekday)
    .filter(([, rates]) => rates.length >= 2)
    .map(([wd, rates]) => ({ wd: Number(wd), avg: rates.reduce((a, b) => a + b, 0) / rates.length }))

  if (weekdayAverages.length >= 3) {
    const best = weekdayAverages.reduce((a, b) => (b.avg > a.avg ? b : a))
    const worst = weekdayAverages.reduce((a, b) => (b.avg < a.avg ? b : a))
    if (best.wd !== worst.wd && (best.avg - worst.avg) >= 0.15) {
      insights.push({
        icon: '📅',
        title: `Seus melhores dias são ${WEEKDAYS[best.wd]}s`,
        detail: `Você completa em média ${Math.round(best.avg * 100)}% dos hábitos em ${WEEKDAYS[best.wd]}s, contra ${Math.round(worst.avg * 100)}% em ${WEEKDAYS[worst.wd]}s. Que tal proteger ${WEEKDAYS[worst.wd]} com uma rotina mais simples?`,
        tone: 'neutral',
      })
    }
  }

  // ── 2. Correlação energia x produtividade (hábitos concluídos) ──────────
  const energyPairs: { e: number; r: number }[] = []
  for (const d of dates) {
    const rate = completionRate(dailyHistory[d])
    const energy = mentalHistory[d]?.energy ?? 0
    if (rate === null || energy <= 0) continue
    energyPairs.push({ e: energy, r: rate * 100 })
  }
  if (energyPairs.length >= 5) {
    const corr = pearson(energyPairs.map(p => p.e), energyPairs.map(p => p.r))
    if (corr !== null && Math.abs(corr) >= 0.3) {
      const strength = Math.abs(corr) >= 0.6 ? 'forte' : 'moderada'
      if (corr > 0) {
        insights.push({
          icon: '⚡',
          title: 'Energia alta = mais hábitos concluídos',
          detail: `Existe uma correlação ${strength} (${Math.round(corr * 100)}%) entre seu nível de energia e quantos hábitos você completa no dia. Proteger o sono e a energia pode valer mais que força de vontade.`,
          tone: 'positive',
        })
      } else {
        insights.push({
          icon: '🔍',
          title: 'Energia e hábitos andam ao contrário',
          detail: `Seus dias de energia mais baixa (${Math.round(Math.abs(corr) * 100)}% de correlação inversa) têm, em média, MAIS hábitos concluídos. Pode ser sinal de que você está se cobrando demais nos dias difíceis.`,
          tone: 'attention',
        })
      }
    }
  }

  // ── 3. Hábito com menor taxa de conclusão (lembrar o "porquê") ──────────
  const habitStats: Record<string, { done: number; total: number }> = {}
  for (const d of dates) {
    for (const h of dailyHistory[d].habits ?? []) {
      const s = (habitStats[h.id] ??= { done: 0, total: 0 })
      s.total += 1
      if (h.done) s.done += 1
    }
  }
  let weakest: { id: string; rate: number } | null = null
  for (const [id, s] of Object.entries(habitStats)) {
    if (s.total < 5) continue
    const rate = s.done / s.total
    if (rate < 0.4 && (weakest === null || rate < weakest.rate)) weakest = { id, rate }
  }
  if (weakest) {
    const def = habitDefs.find(h => h.id === weakest!.id)
    if (def) {
      insights.push({
        icon: def.icon || '💭',
        title: `"${def.label}" está sendo deixado de lado`,
        detail: def.why
          ? `Você completou esse hábito em apenas ${Math.round(weakest.rate * 100)}% dos dias registrados. Sem cobrança — só um lembrete do porquê: ${def.why}`
          : `Você completou esse hábito em apenas ${Math.round(weakest.rate * 100)}% dos dias registrados. Pode ser um sinal para revisar a meta ou o motivo por trás dele.`,
        tone: 'attention',
      })
    }
  }

  // ── 4. Abandono na 3ª semana ─────────────────────────────────────────────
  for (const def of habitDefs) {
    if (!def.createdAt) continue
    const weekRates: Record<number, { done: number; total: number }> = {}
    for (const d of dates) {
      const ms = dateToMs(d)
      if (ms < def.createdAt) continue
      const habit = (dailyHistory[d].habits ?? []).find(h => h.id === def.id)
      if (!habit) continue
      const week = Math.floor((ms - def.createdAt) / (7 * DAY_MS))
      const s = (weekRates[week] ??= { done: 0, total: 0 })
      s.total += 1
      if (habit.done) s.done += 1
    }
    const early = [0, 1].map(w => weekRates[w]).filter(Boolean)
    const late = weekRates[2]
    if (early.length === 2 && late && late.total >= 3) {
      const earlyRate = early.reduce((s, w) => s + w.done, 0) / early.reduce((s, w) => s + w.total, 0)
      const lateRate = late.done / late.total
      if (earlyRate - lateRate >= 0.3) {
        insights.push({
          icon: '📉',
          title: `"${def.label}" costuma cair na 3ª semana`,
          detail: `Nas duas primeiras semanas a taxa de conclusão era ${Math.round(earlyRate * 100)}%, e caiu para ${Math.round(lateRate * 100)}% na 3ª semana.${def.why ? ` Lembre-se: ${def.why}` : ''} Talvez seja hora de tornar a meta menor ou mais fácil de encaixar na rotina.`,
          tone: 'attention',
        })
      }
    }
  }

  // ── 5. Hábito de movimento x humor ───────────────────────────────────────
  const movementDef = habitDefs.find(h => /trein|exerc|corr|caminh|academia|gym|atividade/i.test(h.label) || /trein|exerc|corr|caminh/i.test(h.id))
  if (movementDef) {
    const withMood: number[] = []
    const withoutMood: number[] = []
    for (const d of dates) {
      const mood = mentalHistory[d]?.mood ?? 0
      if (mood <= 0) continue
      const habit = (dailyHistory[d].habits ?? []).find(h => h.id === movementDef.id)
      if (!habit) continue
      if (habit.done) withMood.push(mood)
      else withoutMood.push(mood)
    }
    if (withMood.length >= 2 && withoutMood.length >= 2) {
      const avgWith = withMood.reduce((a, b) => a + b, 0) / withMood.length
      const avgWithout = withoutMood.reduce((a, b) => a + b, 0) / withoutMood.length
      if (avgWith - avgWithout >= 0.4) {
        insights.push({
          icon: movementDef.icon || '💪',
          title: `Seus melhores dias têm "${movementDef.label}"`,
          detail: `Nos dias em que você completa "${movementDef.label}", seu humor médio é ${avgWith.toFixed(1)}/5 — contra ${avgWithout.toFixed(1)}/5 nos dias sem. Esse hábito parece puxar o seu dia inteiro para cima.`,
          tone: 'positive',
        })
      }
    }
  }

  // ── 6. Streak atual ───────────────────────────────────────────────────────
  let bestStreak: { def: HabitDef; days: number } | null = null
  for (const def of habitDefs) {
    let streak = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      const habit = (dailyHistory[dates[i]].habits ?? []).find(h => h.id === def.id)
      if (habit?.done) streak++
      else break
    }
    if (streak >= 3 && (bestStreak === null || streak > bestStreak.days)) {
      bestStreak = { def, days: streak }
    }
  }
  if (bestStreak) {
    insights.push({
      icon: '🔥',
      title: `${bestStreak.days} dias seguidos com "${bestStreak.def.label}"`,
      detail: `Sequência ativa! ${bestStreak.def.why ? `Você está vivendo o seu "porquê": ${bestStreak.def.why}` : 'Consistência é exatamente isso — manter o ritmo, um dia por vez.'}`,
      tone: 'positive',
    })
  }

  // ── 7. Volume de treino na semana ────────────────────────────────────────
  if (workouts.length >= 3) {
    const last14 = workouts.filter(w => Date.now() - dateToMs(w.rawDate) <= 14 * DAY_MS)
    const last7 = last14.filter(w => Date.now() - dateToMs(w.rawDate) <= 7 * DAY_MS)
    const prev7 = last14.filter(w => {
      const diff = Date.now() - dateToMs(w.rawDate)
      return diff > 7 * DAY_MS && diff <= 14 * DAY_MS
    })
    if (last7.length > 0 || prev7.length > 0) {
      if (last7.length > prev7.length) {
        insights.push({
          icon: '📈',
          title: 'Volume de treino subiu',
          detail: `Você treinou ${last7.length}x nos últimos 7 dias, contra ${prev7.length}x na semana anterior. Mantenha o ritmo sem forçar — progresso consistente vence intensidade pontual.`,
          tone: 'positive',
        })
      } else if (last7.length < prev7.length) {
        insights.push({
          icon: '📉',
          title: 'Volume de treino caiu',
          detail: `Você treinou ${last7.length}x nos últimos 7 dias, contra ${prev7.length}x na semana anterior. Sem culpa — só observe se algo na rotina mudou e se vale ajustar o plano.`,
          tone: 'neutral',
        })
      }
    }
  }

  if (insights.length === 0) {
    insights.push({
      icon: '🔍',
      title: 'Ainda sem padrões fortes',
      detail: 'Seus dados ainda não mostram um padrão claro — isso é normal nas primeiras semanas. Continue registrando hábitos, humor e energia para revelar como você funciona.',
      tone: 'neutral',
    })
  }

  return insights.slice(0, 6)
}
