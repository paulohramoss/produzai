// Carga de treino e razão aguda:crônica.
//
// Traduz o sRPE (esforço × minutos) numa leitura que muda decisão: a semana
// está coerente com o que o corpo vem aguentando, ou você deu um salto que
// costuma anteceder lesão?

import { useContext, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar as RBar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts'
import { Activity } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, ChartTooltip } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import {
  computeTrainingLoad, weeklyLoadTrend, ZONE_EMOJI, MIN_DAYS_FOR_ACWR,
  type LoadZone,
} from '../../lib/trainingLoad'
import type { ManualWorkout } from '../../store/useWorkoutStore'

const ZONE_COLOR: Record<LoadZone, string> = {
  'destreino': C.blue,
  'ideal':     C.green,
  'atencao':   C.orange,
  'risco':     C.red,
  'sem-base':  C.muted2,
}

export function TrainingLoadCard({ workouts }: { workouts: ManualWorkout[] }) {
  const { isMobile } = useContext(LayoutContext)
  const load = useMemo(() => computeTrainingLoad(workouts), [workouts])
  const trend = useMemo(() => weeklyLoadTrend(workouts, 8), [workouts])

  const color = ZONE_COLOR[load.zone]
  const hasTrend = trend.some(p => p.load > 0)

  if (!hasTrend) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
          <Activity size={17} color={C.muted2} /> Carga de treino
        </div>
        <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6, padding: '12px 0' }}>
          Registre duração e grau de esforço nos treinos para o app calcular sua
          carga interna e avisar quando ela subir rápido demais.
        </div>
      </Card>
    )
  }

  const weekDelta = load.previousWeek > 0
    ? Math.round(((load.acute - load.previousWeek) / load.previousWeek) * 100)
    : null

  return (
    <Card style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}>
            <Activity size={17} color={color} /> Carga de treino
          </div>
          <div style={{ fontSize: T.text.base, color, fontWeight: T.weight.bold, marginTop: 4 }}>
            {ZONE_EMOJI[load.zone]} {load.headline}
          </div>
        </div>
        {load.acwr !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color, lineHeight: 1, ...displayStyle }}>
              {load.acwr.toFixed(2)}
            </div>
            <div style={{ fontSize: T.text.xs, color: C.muted, marginTop: 2 }}>aguda / crônica</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: T.text.base, color: C.text, lineHeight: 1.6, margin: '12px 0' }}>
        {load.advice}
      </div>

      {/* Números da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Últimos 7 dias', v: load.acute.toLocaleString('pt-BR'), sub: 'UA de carga', c: color },
          { l: 'Média de 4 semanas', v: load.chronic.toLocaleString('pt-BR'), sub: 'UA por semana', c: C.muted2 },
          {
            l: 'Vs. semana passada',
            v: weekDelta === null ? '—' : `${weekDelta > 0 ? '+' : ''}${weekDelta}%`,
            sub: load.previousWeek > 0 ? `${load.previousWeek.toLocaleString('pt-BR')} UA` : 'sem base',
            c: weekDelta === null ? C.muted2 : weekDelta > 30 ? C.orange : C.text,
          },
        ].map(k => (
          <div key={k.l} style={{ background: C.card2, borderRadius: T.radius.md, padding: '10px 12px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>{k.l}</div>
            <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: k.c, ...displayStyle }}>{k.v}</div>
            <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', height: 190 }}>
        <ResponsiveContainer>
          <ComposedChart data={trend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={C.border} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis yAxisId="load" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
            <YAxis yAxisId="acwr" orientation="right" domain={[0, 2]} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            {/* Faixa confortável: 0,8 a 1,3 */}
            <ReferenceLine yAxisId="acwr" y={1.3} stroke={`${C.orange}66`} strokeDasharray="4 4" />
            <ReferenceLine yAxisId="acwr" y={0.8} stroke={`${C.blue}66`} strokeDasharray="4 4" />
            <RBar yAxisId="load" dataKey="load" name="carga (UA)" fill={`${C.purple}88`} radius={[3, 3, 0, 0]} />
            <Line yAxisId="acwr" type="monotone" dataKey="acwr" name="ACWR" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
        Carga interna = esforço percebido × minutos. A razão compara os últimos 7
        dias com a média das últimas 4 semanas; entre 0,8 e 1,3 é a faixa
        confortável.{load.acwr === null && ` Precisa de ${MIN_DAYS_FOR_ACWR} dias de histórico — você tem ${load.historyDays}.`}
      </div>
    </Card>
  )
}
