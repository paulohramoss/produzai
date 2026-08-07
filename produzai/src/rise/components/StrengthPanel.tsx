// Painel de força: recordes por exercício e progressão de carga.
//
// É o que faltava para quem treina musculação — os recordes que existiam
// (pace, distância, calorias) não dizem nada sobre agachamento ou supino.

import { useContext, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Trophy, TrendingUp } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, ChartTooltip } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { computeExerciseRecords, exerciseProgression, workoutVolume } from '../../lib/strength'
import type { ManualWorkout } from '../../store/useWorkoutStore'

function formatDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${d}/${m}`
}

export function StrengthPanel({ workouts }: { workouts: ManualWorkout[] }) {
  const { isMobile } = useContext(LayoutContext)
  const records = useMemo(() => computeExerciseRecords(workouts), [workouts])
  const [selected, setSelected] = useState<string | null>(null)

  const active = selected ?? records[0]?.name ?? null
  const progression = useMemo(
    () => (active ? exerciseProgression(workouts, active, 20) : []),
    [workouts, active],
  )

  // Tonelagem da semana — a leitura de volume que o corredor tem em km.
  const weekVolume = useMemo(() => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() || 7) - 1))
    weekStart.setHours(0, 0, 0, 0)
    return workouts
      .filter(w => {
        const [y, m, d] = w.rawDate.split('-').map(Number)
        return new Date(y, m - 1, d) >= weekStart
      })
      .reduce((sum, w) => sum + workoutVolume(w), 0)
  }, [workouts])

  if (records.length === 0) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
          <Trophy size={17} color={C.muted2} /> Força
        </div>
        <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6, padding: '12px 0' }}>
          Registre um treino com exercícios, séries e cargas para acompanhar
          recordes por exercício, 1RM estimado e progressão de carga.
        </div>
      </Card>
    )
  }

  const hasChart = progression.filter(p => p.est1RM !== null || p.topWeight > 0).length >= 2

  return (
    <Card style={{ borderTop: `2px solid ${C.purple}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}>
          <Trophy size={17} color={C.purple} /> Força
        </div>
        {weekVolume > 0 && (
          <span style={{ fontSize: T.text.base, color: C.muted }}>
            volume da semana: <strong style={{ color: C.text }}>{weekVolume.toLocaleString('pt-BR')} kg</strong>
          </span>
        )}
      </div>

      {/* Recordes por exercício */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {records.slice(0, 6).map(r => (
          <div
            key={r.name}
            onClick={() => setSelected(r.name)}
            style={{
              background: C.card2, borderRadius: T.radius.md, padding: '11px 13px', cursor: 'pointer',
              border: `1px solid ${active === r.name ? C.purple : C.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: T.text.md, fontWeight: T.weight.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
              </span>
              <span style={{ fontSize: T.text.xs, color: C.muted, flexShrink: 0 }}>
                {r.sessions}× · {formatDate(r.lastDate)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div>
                <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, color: C.purple, ...displayStyle }}>
                  {r.heaviest.weightKg > 0 ? `${r.heaviest.weightKg}kg` : `${r.heaviest.reps} reps`}
                </div>
                <div style={{ fontSize: T.text.xs, color: C.muted }}>
                  {r.heaviest.weightKg > 0 ? `recorde · ${r.heaviest.reps} reps` : 'peso do corpo'}
                </div>
              </div>
              {r.best1RM && (
                <div>
                  <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, color: C.orange, ...displayStyle }}>
                    {r.best1RM.value}kg
                  </div>
                  <div style={{ fontSize: T.text.xs, color: C.muted }}>1RM estimado</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progressão do exercício selecionado */}
      {active && hasChart && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, marginBottom: 4, ...displayStyle }}>
            <TrendingUp size={15} color={C.orange} /> Progressão · {active}
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 12 }}>
            Carga máxima e 1RM estimado por sessão — toque num recorde acima para trocar
          </div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={progression} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="topWeight" name="carga máx (kg)" stroke={C.purple} strokeWidth={2} dot={{ r: 3, fill: C.purple }} />
                <Line type="monotone" dataKey="est1RM" name="1RM est. (kg)" stroke={C.orange} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2, fill: C.orange }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
            O 1RM é estimado pela fórmula de Epley e serve para comparar sessões
            entre si — não é peso para tentar na barra.
          </div>
        </>
      )}
    </Card>
  )
}
