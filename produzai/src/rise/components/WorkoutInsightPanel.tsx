import { useEffect, useState } from 'react'
import { Sparkles, Activity, TriangleAlert, CircleCheck, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar as RBar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { C, T, displayStyle } from '../data'
import { ChartTooltip } from '../primitives'
import type { ManualWorkout } from '../../store/useWorkoutStore'
import { useAthleteStore } from '../../store/useAthleteStore'
import { useAuthStore } from '../../store/useAuthStore'
import { ensureWorkoutInsight } from '../../lib/workoutInsight'
import type { WorkoutInsight } from '../../lib/db'
import type { WorkoutVerdict } from '../../lib/anthropic'
import { formatPace } from '../../lib/performance'
import { toast } from '../../lib/toast'

const VERDICT_STYLE: Record<WorkoutVerdict, { label: string; color: string }> = {
  excelente: { label: 'Excelente', color: C.green },
  solido:    { label: 'Sólido',    color: C.blue },
  regular:   { label: 'Regular',   color: C.orange },
  alerta:    { label: 'Atenção',   color: C.red },
}

function Metric({ label, value, hint, color }: { label: string; value: string; hint?: string; color: string }) {
  return (
    <div style={{ background: C.card, borderRadius: T.radius.sm, padding: '10px 12px', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: T.text['2xs'], color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, color, ...displayStyle }}>{value}</div>
      {hint && <div style={{ fontSize: T.text['2xs'], color: C.muted2, marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

/** Como ler a deriva cardíaca — o número mais importante e o menos conhecido. */
function decouplingHint(value: number): { text: string; color: string } {
  if (value <= 5)  return { text: 'base aeróbica sólida', color: C.green }
  if (value <= 10) return { text: 'base em construção',   color: C.orange }
  return { text: 'esforço acima da base atual', color: C.red }
}

export function WorkoutInsightPanel({ workout, allWorkouts }: {
  workout: ManualWorkout
  allWorkouts: ManualWorkout[]
}) {
  const profile = useAthleteStore(s => s.profile)
  const displayName = useAuthStore(s => s.displayName)

  const [insight, setInsight] = useState<WorkoutInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [askingAI, setAskingAI] = useState(false)

  // A análise local é gratuita, então roda assim que o painel abre.
  useEffect(() => {
    let active = true
    setLoading(true)
    ensureWorkoutInsight(workout, allWorkouts, profile)
      .then(result => { if (active) setInsight(result) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.id])

  async function handleAskAI() {
    setAskingAI(true)
    const result = await ensureWorkoutInsight(workout, allWorkouts, profile, {
      withAI: true,
      userName: displayName ?? undefined,
    })
    setAskingAI(false)
    if (result?.summary) setInsight(result)
    else toast.error('Não consegui gerar a leitura deste treino agora. Tente de novo em instantes.')
  }

  if (loading) {
    return (
      <div style={{ padding: '14px 0', fontSize: T.text.md, color: C.muted }}>
        Analisando treino...
      </div>
    )
  }

  if (!insight) {
    return (
      <div style={{ padding: '14px 0', fontSize: T.text.md, color: C.muted }}>
        Não foi possível analisar este treino.
      </div>
    )
  }

  const { analysis, summary } = insight
  const activeZones = analysis.zones.filter(z => z.pct > 0)
  const hasNumbers = activeZones.length > 0 || analysis.decoupling !== null || analysis.splits.length > 0

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 14 }}>
      {analysis.depth === 'summary' && (
        <div style={{ fontSize: T.text.sm, color: C.muted2, marginBottom: 12 }}>
          Treino sem série temporal (registro manual ou sem GPS/cinta) — a análise usa só os dados do resumo.
        </div>
      )}

      {/* Zonas de FC */}
      {activeZones.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Tempo por zona
          </div>
          <div style={{ display: 'flex', height: 12, borderRadius: T.radius['2xs'], overflow: 'hidden', marginBottom: 8 }}>
            {analysis.zones.map(z => (
              z.pct > 0 && <div key={z.zone} style={{ width: `${z.pct}%`, background: z.color }} title={`${z.label}: ${z.pct}%`} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {activeZones.map(z => (
              <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: T.text.sm, color: C.muted2 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: z.color }} />
                {z.label} <strong style={{ color: C.text }}>{z.pct}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas derivadas */}
      {hasNumbers && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
          {analysis.decoupling !== null && (() => {
            const hint = decouplingHint(analysis.decoupling)
            return (
              <Metric
                label="Deriva cardíaca"
                value={`${analysis.decoupling > 0 ? '+' : ''}${analysis.decoupling}%`}
                hint={hint.text}
                color={hint.color}
              />
            )
          })()}
          {analysis.splitDeltaSec !== null && (
            <Metric
              label="Split"
              value={`${analysis.splitDeltaSec > 0 ? '+' : ''}${analysis.splitDeltaSec}s/km`}
              hint={analysis.splitDeltaSec < 0 ? 'negative split' : '2ª metade mais lenta'}
              color={analysis.splitDeltaSec <= 0 ? C.green : C.muted2}
            />
          )}
          {analysis.maxHr && <Metric label="FC pico" value={`${analysis.maxHr}`} hint="bpm" color={C.pink} />}
          {analysis.avgCadence && <Metric label="Cadência" value={`${analysis.avgCadence}`} hint="passos/min" color={C.purple} />}
          {analysis.elevGain !== null && analysis.elevGain > 0 && (
            <Metric label="Elevação" value={`${analysis.elevGain}m`} hint="ganho acumulado" color={C.orange} />
          )}
          {analysis.efficiency && (
            <Metric label="Economia" value={`${analysis.efficiency}`} hint="metros por batimento" color={C.blue} />
          )}
        </div>
      )}

      {/* Parciais por km */}
      {analysis.splits.length >= 3 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Parciais por km
          </div>
          <div style={{ width: '100%', height: 130 }}>
            <ResponsiveContainer>
              <BarChart
                data={analysis.splits.map(s => ({ km: `${s.km}`, pace: s.paceMin, label: formatPace(s.paceMin) }))}
                margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
              >
                <CartesianGrid stroke={C.border} vertical={false} />
                <XAxis dataKey="km" tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={34} reversed domain={['dataMin - 0.3', 'dataMax + 0.3']} />
                <Tooltip content={<ChartTooltip />} />
                <RBar dataKey="pace" name="min/km" fill={C.running} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Leitura da IA */}
      {summary ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius.md, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: T.text.xs, fontWeight: T.weight.bold, textTransform: 'uppercase', letterSpacing: 0.8,
              color: VERDICT_STYLE[summary.verdict]?.color ?? C.muted2,
              background: `${VERDICT_STYLE[summary.verdict]?.color ?? C.muted2}22`,
              borderRadius: T.radius['2xs'], padding: '3px 9px',
            }}>
              {VERDICT_STYLE[summary.verdict]?.label ?? summary.verdict}
            </span>
            <span style={{ fontSize: T.text.lg, fontWeight: T.weight.bold, color: C.text }}>{summary.headline}</span>
          </div>

          <div style={{ fontSize: T.text.md, color: C.muted2, lineHeight: 1.6, marginBottom: 12 }}>{summary.reading}</div>

          {summary.highlights?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {summary.highlights.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: T.text.md, color: C.text, marginBottom: 5 }}>
                  <CircleCheck size={14} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}

          {summary.watchouts?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {summary.watchouts.map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: T.text.md, color: C.text, marginBottom: 5 }}>
                  <TriangleAlert size={14} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {summary.nextStep && (
            <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', background: C.card2, borderRadius: T.radius.sm, padding: '9px 11px' }}>
              <ArrowRight size={14} color={C.purple} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: T.text.md, color: C.text }}>
                <strong style={{ color: C.purple }}>Próximo passo: </strong>{summary.nextStep}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleAskAI}
          disabled={askingAI}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
            background: askingAI ? C.card : C.purple, border: 'none', borderRadius: T.radius.sm,
            padding: '10px', color: askingAI ? C.muted : '#fff',
            fontSize: T.text.md, fontWeight: T.weight.bold, cursor: askingAI ? 'default' : 'pointer',
          }}
        >
          {askingAI ? <Activity size={14} /> : <Sparkles size={14} />}
          {askingAI ? 'Lendo seu treino...' : 'Ler este treino com IA'}
        </button>
      )}
    </div>
  )
}
