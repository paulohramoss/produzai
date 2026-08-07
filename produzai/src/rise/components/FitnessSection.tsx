import { useContext, useMemo } from 'react'
import { Flame, Timer } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { C, T, displayStyle } from '../data'
import { Card, ChartTooltip } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { estimateFitness, trainingPaces, predictRaces, buildVdotTrend } from '../../lib/fitness'

export function FitnessSection() {
  const workouts = useWorkoutStore(s => s.workouts)
  const { isMobile } = useContext(LayoutContext)

  const estimate = useMemo(() => estimateFitness(workouts), [workouts])
  const trend = useMemo(() => buildVdotTrend(workouts, 6), [workouts])

  if (!estimate) return null

  const paces = trainingPaces(estimate.vdot)
  const races = predictRaces(estimate.vdot)
  const delta = trend.length >= 2 ? Math.round((trend[trend.length - 1].vdot - trend[0].vdot) * 10) / 10 : null

  return (
    <Card style={{ marginBottom: 16, borderTop: `2px solid ${C.pink}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
        <Flame size={17} color={C.pink} /> Condicionamento estimado
      </div>
      <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 14 }}>
        Calculado do seu melhor esforço nos últimos 90 dias — sem teste de laboratório
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ background: C.card2, borderRadius: T.radius.md, padding: '12px 14px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>VDOT</div>
          <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: C.pink, ...displayStyle }}>{estimate.vdot}</div>
          <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 3 }}>
            {delta !== null ? `${delta > 0 ? '+' : ''}${delta} em 6 meses` : estimate.level}
          </div>
        </div>
        <div style={{ background: C.card2, borderRadius: T.radius.md, padding: '12px 14px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>VO₂máx</div>
          <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: C.blue, ...displayStyle }}>{estimate.vo2max}</div>
          <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 3 }}>ml/kg/min</div>
        </div>
        <div style={{ background: C.card2, borderRadius: T.radius.md, padding: '12px 14px', border: `1px solid ${C.border}`, gridColumn: isMobile ? '1 / -1' : undefined }}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Nível</div>
          <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: C.purple, ...displayStyle }}>{estimate.level}</div>
          <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            de {estimate.source.name}
          </div>
        </div>
      </div>

      {trend.length >= 3 && (
        <div style={{ width: '100%', height: 140, marginBottom: 16 }}>
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="vdot" name="VDOT" stroke={C.pink} strokeWidth={2} dot={{ r: 3, fill: C.pink }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ritmos de treino */}
      <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        Seus ritmos de treino
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {paces.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card2, borderRadius: T.radius.sm, padding: '9px 12px', border: `1px solid ${C.border}` }}>
            <div style={{ width: 3, height: 26, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: C.text }}>{p.label}</div>
              <div style={{ fontSize: T.text.sm, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.purpose}</div>
            </div>
            <div style={{ fontSize: T.text.xl, fontWeight: T.weight.extrabold, color: p.color, flexShrink: 0, ...displayStyle }}>{p.formatted}</div>
          </div>
        ))}
      </div>

      {/* Previsão de prova */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        <Timer size={12} /> Se você corresse hoje
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
        {races.map(r => (
          <div key={r.label} style={{ background: C.card2, borderRadius: T.radius.sm, padding: '10px 12px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: T.text.xs, color: C.muted, marginBottom: 4 }}>{r.label}</div>
            <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: C.orange, ...displayStyle }}>{r.formatted}</div>
            <div style={{ fontSize: T.text.xs, color: C.muted2, marginTop: 2 }}>{r.pacePerKm}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
        Previsões assumem treino específico para a distância. Sem volume de longão, a maratona sai mais lenta que o número acima.
      </div>
    </Card>
  )
}
