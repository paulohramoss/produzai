import { useState, useContext } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { CalendarDays, Dumbbell, Utensils } from 'lucide-react'
import { Card } from '../primitives'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { LayoutContext } from '../LayoutContext'

interface Props { setPage: (p: Page) => void }

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function getWeekDates() {
  const today = new Date()
  const dow = today.getDay() || 7
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - dow + 1 + i)
    return d
  })
}

export function Agenda({ setPage }: Props) {
  const { isMobile } = useContext(LayoutContext)
  const wd       = useWebDietStore(s => s.data)
  const workouts = useWorkoutStore(s => s.workouts)
  const weekDates = getWeekDates()
  const todayIdx  = (new Date().getDay() || 7) - 1
  const [selectedDay, setSelectedDay] = useState(todayIdx)

  const meals = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))

  const weekStart = weekDates[0]
  const workoutsByDay: Record<number, typeof workouts> = {}
  workouts.forEach(w => {
    const [y, m, d] = w.rawDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const diff = Math.round((date.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff < 7) {
      if (!workoutsByDay[diff]) workoutsByDay[diff] = []
      workoutsByDay[diff].push(w)
    }
  })

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 22 : 26, fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><CalendarDays size={20} color={C.orange} /> Agenda</div>
        <div style={{ fontSize: T.text.md, color: C.muted }}>Semana atual — treinos e refeições</div>
      </div>

      {/* Week strip — horizontal scroll on mobile to avoid cramping 7 cells */}
      <div style={{ overflowX: 'auto', marginBottom: 20, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div style={{ display: 'flex', gap: 6, minWidth: isMobile ? 'max-content' : undefined }}>
          {DAYS.map((day, i) => {
            const d       = weekDates[i]
            const acts    = workoutsByDay[i] ?? []
            const isToday = i === todayIdx
            const isSel   = i === selectedDay
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                aria-pressed={isSel}
                style={{
                  flex: isMobile ? '0 0 60px' : '1',
                  background: isSel ? C.orange : isToday ? `${C.orange}22` : C.card,
                  border: `1px solid ${isSel ? C.orange : isToday ? C.orange + '55' : C.border}`,
                  borderRadius: T.radius.lg,
                  padding: '10px 8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all .12s',
                }}
              >
                <div style={{ fontSize: T.text.xs, color: isSel ? '#000' : C.muted, fontWeight: T.weight.bold, marginBottom: 4 }}>{day}</div>
                <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, color: isSel ? '#000' : isToday ? C.orange : C.text }}>{d.getDate()}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 6 }}>
                  {acts.slice(0, 3).map((_, j) => (
                    <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple }} />
                  ))}
                  {wd && meals.length > 0 && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.green }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* Activities */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}><Dumbbell size={17} /> Treinos — {DAYS[selectedDay]}</div>
            <button
              onClick={() => setPage('treino')}
              style={{ background: 'none', border: 'none', fontSize: T.text.sm, color: C.orange, cursor: 'pointer', padding: 0 }}
            >
              + Registrar
            </button>
          </div>
          {(workoutsByDay[selectedDay] ?? []).length > 0 ? (
            (workoutsByDay[selectedDay] ?? []).map((w, i) => (
              <div key={i} style={{ padding: '12px', background: C.card2, borderRadius: T.radius.md, marginBottom: 8, borderLeft: `3px solid ${C.purple}` }}>
                <div style={{ fontWeight: T.weight.bold, fontSize: T.text.md, marginBottom: 6 }}>{w.name}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {w.dist > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: T.text.lg, fontWeight: T.weight.extrabold, color: C.running }}>{w.dist}km</div><div style={{ fontSize: T.text['2xs'], color: C.muted }}>dist</div></div>}
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: T.text.lg, fontWeight: T.weight.extrabold }}>{w.time}</div><div style={{ fontSize: T.text['2xs'], color: C.muted }}>tempo</div></div>
                  {w.cal > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: T.text.lg, fontWeight: T.weight.extrabold, color: C.red }}>{w.cal}</div><div style={{ fontSize: T.text['2xs'], color: C.muted }}>kcal</div></div>}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: T.text.md, color: C.muted, padding: '20px 0', textAlign: 'center' }}>
              <div style={{ fontSize: T.text['7xl'], marginBottom: 10 }}>🏋</div>
              Nenhum treino registrado
            </div>
          )}
        </Card>

        {/* Meals schedule */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}><Utensils size={17} /> Plano alimentar — {DAYS[selectedDay]}</div>
          </div>
          {wd && meals.length > 0 ? (
            meals.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 36, fontSize: T.text.xs, color: C.muted, flexShrink: 0 }}>{m.time}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: T.text.md, fontWeight: T.weight.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  <div style={{ fontSize: T.text.xs, color: C.muted }}>{m.cal} kcal · P:{m.prot}g C:{m.carb}g G:{m.fat}g</div>
                </div>
                {selectedDay === todayIdx && (
                  <span style={{ fontSize: T.text.xs, color: m.done ? C.green : C.border2, flexShrink: 0 }}>{m.done ? '✓' : '○'}</span>
                )}
              </div>
            ))
          ) : (
            <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              {wd
                ? <button onClick={() => setPage('dieta')} style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontSize: T.text.md }}>Adicionar refeições →</button>
                : <button onClick={() => setPage('dieta')} style={{ background: 'none', border: 'none', color: C.orange, cursor: 'pointer', fontSize: T.text.md }}>Configurar dieta →</button>
              }
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
