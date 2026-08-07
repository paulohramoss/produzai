import { useContext, useMemo } from 'react'
import { Gauge, ShieldAlert, TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { C, T, displayStyle } from '../data'
import { Card, ChartTooltip } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useAthleteStore } from '../../store/useAthleteStore'
import { buildLoadSeries, computeAcwr, computeMonotony, readForm } from '../../lib/trainingLoad'

/** Quantos dias de gráfico — 90 mostra um ciclo inteiro sem virar sopa de pixels. */
const WINDOW_DAYS = 90

export function TrainingLoadSection() {
  const workouts = useWorkoutStore(s => s.workouts)
  const profile = useAthleteStore(s => s.profile)
  const { isMobile } = useContext(LayoutContext)

  const series = useMemo(() => buildLoadSeries(workouts, profile, WINDOW_DAYS), [workouts, profile])
  const acwr = useMemo(() => computeAcwr(workouts, profile), [workouts, profile])
  const monotony = useMemo(() => computeMonotony(workouts, profile), [workouts, profile])

  const last = series[series.length - 1]
  // Com menos de duas semanas de dados as médias exponenciais ainda não dizem nada.
  if (!last || series.length < 14) return null

  const form = readForm(last.form)
  const fourWeeksAgo = series[series.length - 29]
  const fitnessDelta = fourWeeksAgo ? Math.round((last.fitness - fourWeeksAgo.fitness) * 10) / 10 : null

  return (
    <Card style={{ marginBottom: 16, borderTop: `2px solid ${form.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
        <Gauge size={17} color={form.color} /> Condicionamento e fadiga
      </div>
      <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 14 }}>
        Modelo de carga: o que você construiu, o que ainda está cobrando e como isso te deixa hoje
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          {
            l: 'Condicionamento',
            v: String(Math.round(last.fitness)),
            sub: fitnessDelta !== null ? `${fitnessDelta > 0 ? '+' : ''}${fitnessDelta} em 4 semanas` : 'base acumulada',
            c: C.blue,
          },
          { l: 'Fadiga', v: String(Math.round(last.fatigue)), sub: 'carga dos últimos 7 dias', c: C.orange },
          { l: 'Forma', v: `${last.form > 0 ? '+' : ''}${Math.round(last.form)}`, sub: form.label, c: form.color },
        ].map((k, i) => (
          <div key={i} style={{ background: C.card2, borderRadius: T.radius.md, padding: '12px 14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{k.l}</div>
            <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: k.c, ...displayStyle }}>{k.v}</div>
            <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', height: 210, marginBottom: 12 }}>
        <ResponsiveContainer>
          <ComposedChart data={series} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="fitnessGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.blue} stopOpacity={0.35} />
                <stop offset="95%" stopColor={C.blue} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} interval={Math.floor(series.length / 6)} />
            <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke={C.border2} />
            <Area type="monotone" dataKey="fitness" name="condicionamento" stroke={C.blue} strokeWidth={2} fill="url(#fitnessGradient)" />
            <Line type="monotone" dataKey="fatigue" name="fadiga" stroke={C.orange} strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="form" name="forma" stroke={form.color} strokeWidth={1.6} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: `${form.color}12`, border: `1px solid ${form.color}33`, borderRadius: T.radius.sm, padding: '10px 13px', fontSize: T.text.md, color: C.muted2, lineHeight: 1.55, marginBottom: acwr || monotony?.isMonotonous ? 12 : 0 }}>
        <strong style={{ color: form.color }}>{form.label}. </strong>{form.detail}
      </div>

      {acwr && (
        <div style={{ background: C.card2, border: `1px solid ${acwr.color}33`, borderRadius: T.radius.sm, padding: '12px 13px', marginBottom: monotony?.isMonotonous ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: T.text.md, fontWeight: T.weight.bold, color: C.text }}>
              <ShieldAlert size={15} color={acwr.color} /> Equilíbrio de carga
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: acwr.color, ...displayStyle }}>{acwr.ratio}</span>
              <span style={{ fontSize: T.text.sm, color: acwr.color, fontWeight: T.weight.bold }}>{acwr.label}</span>
            </div>
          </div>

          {/* Escala 0 a 2 com a faixa ideal (0,8–1,3) destacada. */}
          <div style={{ position: 'relative', height: 8, borderRadius: T.radius['2xs'], background: C.border, marginBottom: 8 }}>
            <div style={{ position: 'absolute', left: '40%', width: '25%', height: '100%', background: `${C.green}55`, borderRadius: T.radius['2xs'] }} />
            <div style={{
              position: 'absolute', left: `${Math.min(98, Math.max(0, (acwr.ratio / 2) * 100))}%`,
              top: -3, width: 3, height: 14, background: acwr.color, borderRadius: 2, transform: 'translateX(-50%)',
            }} />
          </div>

          <div style={{ fontSize: T.text.base, color: C.muted2, lineHeight: 1.55 }}>{acwr.detail}</div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6 }}>
            Carga desta semana {acwr.acute} · média das últimas 4 semanas {acwr.chronic}
          </div>
        </div>
      )}

      {monotony?.isMonotonous && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.card2, borderRadius: T.radius.sm, padding: '10px 13px' }}>
          <TrendingUp size={15} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: T.text.base, color: C.muted2, lineHeight: 1.55 }}>
            <strong style={{ color: C.text }}>Semana monótona (índice {monotony.monotony}).</strong>{' '}
            Seus dias estão todos com carga parecida — falta contraste entre fácil e forte. Alternar dias realmente leves com dias realmente fortes rende mais que a média constante.
          </div>
        </div>
      )}
    </Card>
  )
}
