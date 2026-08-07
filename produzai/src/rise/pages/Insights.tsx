import { useState, useEffect, useContext, useMemo } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { Activity, CalendarDays, MirrorRectangular, Puzzle, TrendingUp, Zap } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar as RBar, Line, Cell,
  BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Card, Bar, ChartTooltip } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { useHabitsStore, type HabitDef } from '../../store/useHabitsStore'
import { useWorkoutStore, type ManualWorkout } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import {
  getDailyHistory, getMentalHistory, getWeeklyReviews, saveWeeklyReview,
  type DailyData, type MentalEntry, type WeeklyReview,
} from '../../lib/db'
import { analyzePatterns, type PatternInsight } from '../../lib/patterns'
import { lastNDays } from '../../lib/date'
import { getWeekBuckets, aggregateWellbeingByWeek, compareTrainingVsRestDays } from '../../lib/performance'
import { buildWeekPerformance, diagnoseWeek, findStrongestFactor } from '../../lib/performanceScore'
import { hasApiKey, generateWeeklyReview } from '../../lib/anthropic'
import { toast } from '../../lib/toast'
import { LayoutContext } from '../LayoutContext'

interface Props { setPage: (p: Page) => void }

const HISTORY_DAYS = 56

const TONE_COLOR: Record<PatternInsight['tone'], string> = {
  positive: C.green,
  neutral: C.blue,
  attention: C.orange,
}

const lastDates = lastNDays

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
  const dietCompliance = useWebDietStore(s => s.compliance)
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

  const weekPerformance = useMemo(
    () => buildWeekPerformance(lastDates(7), mentalHistory, dietCompliance, workouts),
    [mentalHistory, dietCompliance, workouts],
  )
  const weekDiagnosis = useMemo(() => diagnoseWeek(weekPerformance), [weekPerformance])
  const strongestFactor = useMemo(() => findStrongestFactor(weekPerformance), [weekPerformance])
  const hasPerformanceData = weekPerformance.some(d => d.score !== null)

  const weeklyWellbeing = useMemo(
    () => aggregateWellbeingByWeek(dailyHistory, mentalHistory, workouts, getWeekBuckets(8)),
    [dailyHistory, mentalHistory, workouts],
  )
  const hasWellbeingData = weeklyWellbeing.some(w => w.workouts > 0 || w.avgMood !== null || w.avgEnergy !== null)

  const trainingComparison = useMemo(
    () => compareTrainingVsRestDays(mentalHistory, workouts),
    [mentalHistory, workouts],
  )
  const trainingComparisonData = [
    { label: 'Dias com treino', humor: trainingComparison.trainMood, energia: trainingComparison.trainEnergy, days: trainingComparison.trainDays },
    { label: 'Dias sem treino', humor: trainingComparison.restMood, energia: trainingComparison.restEnergy, days: trainingComparison.restDays },
  ]
  const hasTrainingComparisonData = trainingComparison.trainDays > 0 && trainingComparison.restDays > 0

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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: T.text.lg }}>Carregando...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 22 : 26, fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><TrendingUp size={20} color={C.orange} /> Insights</div>
          <div style={{ fontSize: T.text.md, color: C.muted }}>Padrões, energia e revisões — o que seus dados dizem sobre você</div>
        </div>
        <button
          onClick={() => setPage('hoje')}
          style={{
            background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.md,
            padding: isMobile ? '8px 12px' : '9px 14px', fontSize: T.text.base, fontWeight: T.weight.bold,
            color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ☀️ Hoje →
        </button>
      </div>

      {/* Espelho de performance */}
      <Card style={{ marginBottom: 16, borderTop: `2px solid ${C.orange}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
          <MirrorRectangular size={17} color={C.orange} /> Espelho de performance
        </div>
        <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 16 }}>
          Como sono, dieta e treino se refletiram na sua semana — últimos 7 dias
        </div>

        {hasPerformanceData ? (
          <>
            <div style={{ width: '100%', height: 180, marginBottom: 16 }}>
              <ResponsiveContainer>
                <BarChart
                  data={weekPerformance.map(d => ({
                    label: d.weekday.slice(0, 3),
                    score: d.score,
                    isBest: weekDiagnosis.best?.date === d.date,
                    isWorst: weekDiagnosis.worst?.date === d.date,
                  }))}
                  margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                >
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<ChartTooltip />} />
                  <RBar dataKey="score" name="performance" radius={[4, 4, 0, 0]}>
                    {weekPerformance.map((d, i) => (
                      <Cell
                        key={i}
                        fill={weekDiagnosis.best?.date === d.date ? C.green : weekDiagnosis.worst?.date === d.date ? C.red : C.blue}
                      />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weekDiagnosis.best && (
                <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, borderRadius: T.radius.md, padding: '10px 14px', fontSize: T.text.base, color: C.text, lineHeight: 1.6 }}>
                  🏆 {weekDiagnosis.bestText}
                </div>
              )}
              {weekDiagnosis.worst && (
                <div style={{ background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: T.radius.md, padding: '10px 14px', fontSize: T.text.base, color: C.text, lineHeight: 1.6 }}>
                  ⚠️ {weekDiagnosis.worstText}
                </div>
              )}
              {strongestFactor && (
                <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.md, padding: '10px 14px', fontSize: T.text.base, color: C.muted, lineHeight: 1.6 }}>
                  🔍 O fator que mais acompanhou sua performance essa semana foi <strong style={{ color: C.text }}>{strongestFactor.text}</strong> ({strongestFactor.corr > 0 ? 'correlação positiva' : 'correlação inversa'}, {Math.round(Math.abs(strongestFactor.corr) * 100)}%).
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
            Registre sono (na página Mental), dieta e treinos por alguns dias para ver seu espelho de performance.
          </div>
        )}
      </Card>

      {/* Padrões detectados */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 12, ...displayStyle }}><Puzzle size={17} /> Padrões detectados</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {insights.map((ins, i) => (
            <Card key={i} style={{ borderLeft: `3px solid ${TONE_COLOR[ins.tone]}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: T.text['5xl'], flexShrink: 0 }}>{ins.icon}</span>
                <div>
                  <div style={{ fontWeight: T.weight.bold, fontSize: T.text.md, marginBottom: 4 }}>{ins.title}</div>
                  <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.6 }}>{ins.detail}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Treino x Bem-estar */}
      {(hasWellbeingData || hasTrainingComparisonData) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {hasWellbeingData && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
                <Activity size={17} color={C.running} /> Performance x Bem-estar
              </div>
              <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 12 }}>
                Treinos por semana (barras) e humor/energia médios (linhas) — últimas 8 semanas
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <ComposedChart data={weeklyWellbeing} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={26} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                    <RBar yAxisId="left" dataKey="workouts" name="treinos" fill={`${C.running}88`} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="avgMood" name="humor" stroke={C.blue} strokeWidth={2} dot={{ r: 3, fill: C.blue }} connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="avgEnergy" name="energia" stroke={C.orange} strokeWidth={2} dot={{ r: 3, fill: C.orange }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {hasTrainingComparisonData && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
                <Zap size={17} color={C.orange} /> Treino x Descanso
              </div>
              <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 12 }}>
                Humor e energia médios em dias com treino registrado vs. dias sem treino
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={trainingComparisonData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis domain={[0, 5]} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                    <RBar dataKey="humor" name="humor" fill={C.blue} radius={[3, 3, 0, 0]} />
                    <RBar dataKey="energia" name="energia" fill={C.orange} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* Energia x produtividade */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}><Zap size={17} /> Energia x Produtividade</div>
          <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 16 }}>
            Quanto dos seus hábitos você completa em cada nível de energia
          </div>
          {hasEnergyData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {energyRows.map(({ level, avg, count }) => (
                <div key={level}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: T.text.base }}>
                    <span style={{ color: C.text, fontWeight: T.weight.semibold }}>Energia {level}/5</span>
                    <span style={{ color: C.muted }}>
                      {avg !== null ? `${Math.round(avg * 100)}% · ${count} dia${count > 1 ? 's' : ''}` : '— sem dados'}
                    </span>
                  </div>
                  <Bar pct={avg !== null ? Math.round(avg * 100) : 0} color={C.orange} h={5} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              Registre energia e hábitos por alguns dias para ver essa relação.
            </div>
          )}
        </Card>

        {/* Revisão semanal */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}><CalendarDays size={17} /> Revisão semanal</div>
            <button
              onClick={handleGenerateReview}
              disabled={generating}
              style={{
                background: generating ? C.card2 : C.green, border: 'none', borderRadius: T.radius.sm,
                padding: '6px 12px', fontSize: T.text.sm, fontWeight: T.weight.bold,
                color: generating ? C.muted : '#fff', cursor: generating ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              {generating ? 'Gerando...' : '✨ Gerar desta semana'}
            </button>
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 14 }}>
            Resumo da semana com vitórias, deslizes e um ajuste para a próxima
          </div>

          {reviews.length === 0 ? (
            <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              {hasApiKey()
                ? 'Ainda sem revisões. Clique em "Gerar desta semana" para começar.'
                : 'Configure sua chave de API da Anthropic para gerar revisões semanais com IA.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reviews.slice(0, 4).map(r => (
                <div key={r.weekKey} style={{ background: C.card2, borderRadius: T.radius.md, padding: 14, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: T.text.sm, color: C.muted, fontWeight: T.weight.bold, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {formatWeekKey(r.weekKey)}
                  </div>
                  <div style={{ fontSize: T.text.md, lineHeight: 1.6, marginBottom: 10 }}>{r.summary}</div>

                  {r.wins?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {r.wins.map((w, i) => (
                        <div key={i} style={{ fontSize: T.text.base, color: C.green, marginBottom: 3 }}>✅ {w}</div>
                      ))}
                    </div>
                  )}
                  {r.slips?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {r.slips.map((s, i) => (
                        <div key={i} style={{ fontSize: T.text.base, color: C.muted, marginBottom: 3 }}>💭 {s}</div>
                      ))}
                    </div>
                  )}
                  {r.question && (
                    <div style={{ fontSize: T.text.base, fontStyle: 'italic', color: C.blue, marginTop: 8, marginBottom: r.adjustment ? 6 : 0 }}>
                      💬 {r.question}
                    </div>
                  )}
                  {r.adjustment && (
                    <div style={{ fontSize: T.text.base, color: C.orange, marginTop: 6 }}>
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
