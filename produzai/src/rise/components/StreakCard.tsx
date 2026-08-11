// Sequência à vista: o número que faz o atleta voltar amanhã.
//
// Mostra a sequência do dia (hábitos diários cumpridos) e, por hábito, ou os
// dias seguidos ou as semanas em que a meta de frequência foi batida. Hábito de
// 4x por semana aparece com o progresso da semana, não como falha no dia de
// descanso.

import { useContext } from 'react'
import { Flame, Snowflake } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, Bar } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import type { DailyData, HabitDef } from '../../lib/db'
import { computeDayStreak, computeHabitStreak, isDaily, targetOf } from '../../lib/streaks'

interface Props {
  defs: HabitDef[]
  history: Record<string, DailyData>
  /** Enquanto o histórico não chegou da nuvem, não anunciamos "0 dias". */
  loading?: boolean
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export function StreakCard({ defs, history, loading }: Props) {
  const { isMobile } = useContext(LayoutContext)

  if (loading) {
    return (
      <Card>
        <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '12px 0' }}>
          Carregando sequências...
        </div>
      </Card>
    )
  }

  const day = computeDayStreak(defs, history)
  const streaks = defs.map(def => ({ def, streak: computeHabitStreak(def, history) }))
  const alive = streaks.filter(s => s.streak.count > 0 || s.streak.weekDone > 0)

  const dayColor = day.count >= 7 ? C.orange : day.count > 0 ? C.green : C.muted

  return (
    <Card style={{ background: day.count > 0 ? `${C.orange}0D` : undefined, border: `1px solid ${day.count > 0 ? C.orange + '33' : C.border}` }}>
      {/* Sequência do dia */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: alive.length > 0 ? 14 : 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
            <Flame size={17} color={dayColor} /> Sequência
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.5 }}>
            {day.count === 0
              ? 'Feche os hábitos diários de hoje para começar uma sequência.'
              : day.todayComplete
                ? `${day.count} ${plural(day.count, 'dia', 'dias')} com o dia fechado. Hoje já está garantido.`
                : `${day.count} ${plural(day.count, 'dia', 'dias')} até ontem. Feche os hábitos de hoje para manter.`}
          </div>
          {day.freezeUsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: T.text.sm, color: C.blue, marginTop: 6 }}>
              <Snowflake size={12} /> Folga da semana usada — o próximo dia perdido zera a contagem.
            </div>
          )}
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: dayColor, lineHeight: 1, ...displayStyle }}>
          {day.count}
        </div>
      </div>

      {/* Por hábito */}
      {alive.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          {alive.map(({ def, streak }) => {
            const daily = isDaily(def)
            const pct = streak.weekTarget > 0
              ? Math.min(100, Math.round((streak.weekDone / streak.weekTarget) * 100))
              : 0
            return (
              <div key={def.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: T.text.xl, width: 22, textAlign: 'center' }}>{def.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: T.text.base, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {def.label}
                      {!daily && (
                        <span style={{ color: C.muted, fontSize: T.text.sm }}> · {targetOf(def)}x/semana</span>
                      )}
                    </span>
                    <span style={{ fontSize: T.text.sm, color: C.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {streak.weekDone}/{streak.weekTarget} na semana
                    </span>
                  </div>
                  <Bar pct={pct} color={streak.weekMet ? C.green : C.orange} h={3} />
                </div>
                <span style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: streak.count > 0 ? C.orange : C.muted, whiteSpace: 'nowrap', minWidth: isMobile ? 54 : 78, textAlign: 'right' }}>
                  {streak.count > 0 ? `🔥 ${streak.count}${daily ? 'd' : 'sem'}` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
