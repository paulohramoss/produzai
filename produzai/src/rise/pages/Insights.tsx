import { useState, useEffect, useContext } from 'react'
import { C, type Page } from '../data'
import { Card, Bar } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { useHabitsStore, type HabitDef } from '../../store/useHabitsStore'
import { useWorkoutStore, type ManualWorkout } from '../../store/useWorkoutStore'
import {
  getDailyHistory, getMentalHistory, getWeeklyReviews, saveWeeklyReview,
  type DailyData, type MentalEntry, type WeeklyReview,
} from '../../lib/db'
import { analyzePatterns, type PatternInsight } from '../../lib/patterns'
import { hasApiKey, generateWeeklyReview } from '../../lib/anthropic'
import { toast } from '../../lib/toast'
import { LayoutContext } from '../LayoutContext'

interface Props { setPage: (p: Page) => void }

const HISTORY_DAYS = 35

const TONE_COLOR: Record<PatternInsight['tone'], string> = {
  positive: C.green,
  neutral: C.blue,
  attention: C.orange,
}

function lastDates(n: number): string[] {
  const dates: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function formatWeekKey(weekKey: string): string {
  const [year, week] = weekKey.split('-W')
  return `Semana ${week} · ${year}`
}

function buildWeekSummary(
  dates: string[],
  dailyHistory: Record<string, DailyData>,
  mentalHistory: Record<string, MentalEntry>,
  habitDefs: HabitDef[],
  workouts: ManualWorkout[],
): string {
  const lines: string[] = [`Dados da semana (${dates[0]} a ${dates[dates.length - 1]}):`]

  for (const def of habitDefs) {
    let done = 0, total = 0
    for (const d of dates) {
      const h = dailyHistory[d]?.habits?.find(x => x.id === def.id)
      if (h) { total++; if (h.done) done++ }
    }
    if (total > 0) lines.push(`- ${def.icon} ${def.label}: ${done}/${total} dias concluído${total > 1 ? 's' : ''} (${Math.round(done / total * 100)}%)`)
  }

  let focusDone = 0, focusTotal = 0
  for (const d of dates) {
    const items = (dailyHistory[d]?.focus ?? []).filter(f => f.text.trim())
    focusTotal += items.length
    focusDone += items.filter(f => f.done).length
  }
  if (focusTotal > 0) lines.push(`- Prioridades do dia concluídas: ${focusDone}/${focusTotal}`)

  const moods = dates.map(d => mentalHistory[d]?.mood ?? 0).filter(m => m > 0)
  const energies = dates.map(d => mentalHistory[d]?.energy ?? 0).filter(e => e > 0)
  if (moods.length) lines.push(`- Humor médio: ${(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)}/5 (${moods.length} registros)`)
  if (energies.length) lines.push(`- Energia média: ${(energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)}/5 (${energies.length} registros)`)

  const weekWorkouts = workouts.filter(w => dates.includes(w.rawDate))
  lines.push(`- Treinos registrados: ${weekWorkouts.length}`)

  const daysWithData = dates.filter(d => dailyHistory[d]).length
  lines.push(`- Dias com dados registrados: ${daysWithData}/${dates.length}`)

  return lines.join('\n')
}

export function Insights({ setPage }: Props) {
  const user = useAuthStore(s => s.user)
  const habitDefs = useHabitsStore(s => s.defs)
  const workouts = useWorkoutStore(s => s.workouts)
  const { isMobile } = useContext(LayoutContext)

  const [loaded, setLoaded] = useState(false)
  const [dailyHistory, setDailyHistory] = useState<Record<string, DailyData>>({})
  const [mentalHistory, setMentalHistory] = useState<Record<string, MentalEntry>>({})
  const [reviews, setReviews] = useState<WeeklyReview[]>([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    async function load() {
      if (!user) { setLoaded(true); return }
      const dates = lastDates(HISTORY_DAYS)
      const [daily, mental, weeklyReviews] = await Promise.all([
        getDailyHistory(dates),
        getMentalHistory(dates),
        getWeeklyReviews(),
      ])
      setDailyHistory(daily)
      setMentalHistory(mental)
      setReviews(weeklyReviews)
      setLoaded(true)
    }
    load()
  }, [user])

  const insights = analyzePatterns({ dailyHistory, mentalHistory, habitDefs, workouts })

  // Energia x produtividade — taxa média de hábitos concluídos por nível de energia
  const energyBuckets: Record<number, number[]> = {}
  for (const d of Object.keys(dailyHistory)) {
    const energy = mentalHistory[d]?.energy ?? 0
    const habits = dailyHistory[d]?.habits
    if (energy <= 0 || !habits || habits.length === 0) continue
    const rate = habits.filter(h => h.done).length / habits.length
    ;(energyBuckets[energy] ??= []).push(rate)
  }
  const energyRows = [1, 2, 3, 4, 5].map(level => {
    const rates = energyBuckets[level] ?? []
    const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null
    return { level, avg, count: rates.length }
  })
  const hasEnergyData = energyRows.some(r => r.count > 0)

  async function handleGenerateReview() {
    if (!hasApiKey()) {
      toast.error('Configure sua chave de API da Anthropic para gerar revisões semanais.')
      return
    }
    setGenerating(true)
    const dates = lastDates(7)
    const summary = buildWeekSummary(dates, dailyHistory, mentalHistory, habitDefs, workouts)
    const result = await generateWeeklyReview(summary)
    setGenerating(false)
    if (!result) {
      toast.error('Não foi possível gerar a revisão agora. Tente novamente em instantes.')
      return
    }
    const review: WeeklyReview = {
      weekKey: getISOWeekKey(new Date()),
      generatedAt: Date.now(),
      ...result,
    }
    await saveWeeklyReview(review)
    setReviews(prev => [review, ...prev.filter(r => r.weekKey !== review.weekKey)])
    toast.success('✨ Revisão semanal gerada!')
  }

  if (!loaded) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: 14 }}>Carregando...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, marginBottom: 4 }}>🔍 Insights</div>
          <div style={{ fontSize: 13, color: C.muted }}>Padrões, energia e revisões — o que seus dados dizem sobre você</div>
        </div>
        <button
          onClick={() => setPage('hoje')}
          style={{
            background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10,
            padding: isMobile ? '8px 12px' : '9px 14px', fontSize: 12, fontWeight: 700,
            color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ☀️ Hoje →
        </button>
      </div>

      {/* Padrões detectados */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🧩 Padrões detectados</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {insights.map((ins, i) => (
            <Card key={i} style={{ borderLeft: `3px solid ${TONE_COLOR[ins.tone]}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{ins.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ins.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{ins.detail}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* Energia x produtividade */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⚡ Energia x Produtividade</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
            Quanto dos seus hábitos você completa em cada nível de energia
          </div>
          {hasEnergyData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {energyRows.map(({ level, avg, count }) => (
                <div key={level}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                    <span style={{ color: C.text, fontWeight: 600 }}>Energia {level}/5</span>
                    <span style={{ color: C.muted }}>
                      {avg !== null ? `${Math.round(avg * 100)}% · ${count} dia${count > 1 ? 's' : ''}` : '— sem dados'}
                    </span>
                  </div>
                  <Bar pct={avg !== null ? Math.round(avg * 100) : 0} color={C.orange} h={5} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              Registre energia e hábitos por alguns dias para ver essa relação.
            </div>
          )}
        </Card>

        {/* Revisão semanal */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🗓️ Revisão semanal</div>
            <button
              onClick={handleGenerateReview}
              disabled={generating}
              style={{
                background: generating ? C.card2 : C.green, border: 'none', borderRadius: 8,
                padding: '6px 12px', fontSize: 11, fontWeight: 700,
                color: generating ? C.muted : '#fff', cursor: generating ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              {generating ? 'Gerando...' : '✨ Gerar desta semana'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            Resumo da semana com vitórias, deslizes e um ajuste para a próxima
          </div>

          {reviews.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              {hasApiKey()
                ? 'Ainda sem revisões. Clique em "Gerar desta semana" para começar.'
                : 'Configure sua chave de API da Anthropic para gerar revisões semanais com IA.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reviews.slice(0, 4).map(r => (
                <div key={r.weekKey} style={{ background: C.card2, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {formatWeekKey(r.weekKey)}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>{r.summary}</div>

                  {r.wins?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {r.wins.map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.green, marginBottom: 3 }}>✅ {w}</div>
                      ))}
                    </div>
                  )}
                  {r.slips?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {r.slips.map((s, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>💭 {s}</div>
                      ))}
                    </div>
                  )}
                  {r.question && (
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: C.blue, marginTop: 8, marginBottom: r.adjustment ? 6 : 0 }}>
                      💬 {r.question}
                    </div>
                  )}
                  {r.adjustment && (
                    <div style={{ fontSize: 12, color: C.orange, marginTop: 6 }}>
                      🔧 {r.adjustment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
