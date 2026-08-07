// "Seu próximo treino é X" — a ponte entre o plano e o dia de hoje.
//
// Sem isto o plano ficaria numa aba que ninguém abre. Aqui ele aparece onde o
// atleta já olha todo dia, com o atalho para registrar.

import { CalendarRange, Check } from 'lucide-react'
import { T, C, type Page, displayStyle } from '../data'
import { Card } from '../primitives'
import { usePlanStore } from '../../store/usePlanStore'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { nextSession, WEEKDAY_NAMES } from '../../lib/weekPlan'
import { EFFORT_LEVELS } from '../../lib/calories'

function whenLabel(daysAhead: number, weekdayName: string): string {
  if (daysAhead === 0) return 'hoje'
  if (daysAhead === 1) return 'amanhã'
  return weekdayName.toLowerCase()
}

export function NextSessionCard({ setPage }: { setPage: (p: Page) => void }) {
  const sessions = usePlanStore(s => s.sessions)
  const workouts = useWorkoutStore(s => s.workouts)
  const next = nextSession(sessions, workouts)

  // Sem plano montado, o card vira o convite para montar um.
  if (!next) {
    return (
      <Card onClick={() => setPage('treino')} style={{ background: `${C.blue}0D`, border: `1px solid ${C.blue}33` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
              <CalendarRange size={17} color={C.blue} /> Plano da semana
            </div>
            <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.5 }}>
              Monte quais treinos caem em cada dia e o app passa a te dizer qual é o próximo.
            </div>
          </div>
          <span style={{ fontSize: T.text.md, color: C.blue, fontWeight: T.weight.bold, whiteSpace: 'nowrap' }}>Montar →</span>
        </div>
      </Card>
    )
  }

  const { session, daysAhead, doneToday } = next
  const done = daysAhead === 0 && doneToday
  const color = done ? C.green : C.blue
  const effortLabel = session.effort ? EFFORT_LEVELS[session.effort - 1]?.label : null

  return (
    <Card style={{ background: `${color}0D`, border: `1px solid ${color}33` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 6, ...displayStyle }}>
            {done ? <Check size={17} color={color} /> : <CalendarRange size={17} color={color} />}
            {done ? 'Treino de hoje concluído' : `Próximo treino · ${whenLabel(daysAhead, WEEKDAY_NAMES[session.weekday])}`}
          </div>
          <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}>
            {session.name}
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted }}>
            {session.type} · {session.durationMin} min{effortLabel ? ` · ${effortLabel.toLowerCase()}` : ''}
          </div>
        </div>

        {!done && daysAhead === 0 && (
          <button
            onClick={() => setPage('treino')}
            style={{
              background: color, border: 'none', borderRadius: T.radius.sm,
              padding: '9px 14px', color: '#fff', fontSize: T.text.base,
              fontWeight: T.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Registrar
          </button>
        )}
      </div>
    </Card>
  )
}
