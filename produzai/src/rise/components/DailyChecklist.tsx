import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { T, C } from '../data'
import { Card, Bar } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { getDaily, saveDaily, getDailyHistory, type DailyData } from '../../lib/db'
import { toast } from '../../lib/toast'
import { userStorage } from '../../lib/userStorage'
import { type Habit, type FocusItem } from '../../lib/dailyScore'
import { todayKey, lastNDays } from '../../lib/date'
import { HabitosModal } from './HabitosModal'
import { computeHabitStreak, isDaily, isPendingToday, targetOf } from '../../lib/streaks'

export type { Habit, FocusItem }

const DEFAULT_FOCUS: FocusItem[] = [
  { id: '1', text: '', done: false },
  { id: '2', text: '', done: false },
  { id: '3', text: '', done: false },
]

export interface DailyChecklistHandle {
  toggleHabit: (id: string) => void
  toggleFocus: (id: string) => void
}

interface Props {
  date: string
  editable: boolean
  onStateChange?: (s: { habits: Habit[]; focus: FocusItem[] }) => void
}

export const DailyChecklist = forwardRef<DailyChecklistHandle, Props>(function DailyChecklist(
  { date, editable, onStateChange }, ref,
) {
  const today      = todayKey()
  const isToday    = date === today
  const user       = useAuthStore(s => s.user)
  const habitDefs  = useHabitsStore(s => s.defs)

  const [habits, setHabits] = useState<Habit[]>([])
  const [focus,  setFocus]  = useState<FocusItem[]>(DEFAULT_FOCUS.map(f => ({ ...f })))
  const [loaded, setLoaded] = useState(false)
  const [managingHabits, setManagingHabits] = useState(false)
  // Histórico da semana: diz quantas vezes cada hábito de frequência já foi
  // cumprido, para o checklist mostrar "2/4" em vez de cobrar todo dia.
  const [weekHistory, setWeekHistory] = useState<Record<string, DailyData>>({})

  useEffect(() => {
    async function loadWeek() {
      if (!user) return
      setWeekHistory(await getDailyHistory(lastNDays(14)))
    }
    loadWeek()
  }, [user, date])

  useEffect(() => {
    async function load() {
      setLoaded(false)
      const baseHabits = habitDefs.map(d => ({ ...d, done: false }))

      let savedHabits: Habit[] | null = null
      let savedFocus:  FocusItem[] | null = null

      if (user) {
        const cloud = await getDaily(date)
        if (cloud?.habits) savedHabits = cloud.habits
        if (cloud?.focus)  savedFocus  = cloud.focus
      }

      // Fallback de localStorage só para hoje — dias passados não têm cache local
      if (isToday) {
        if (!savedHabits) {
          try {
            const r = userStorage.getItem(`habits_${date}`)
            if (r) savedHabits = JSON.parse(r)
          } catch { /* silent */ }
        }
        if (!savedFocus) {
          try {
            const f = userStorage.getItem(`focus_${date}`)
            if (f) savedFocus = JSON.parse(f)
          } catch { /* silent */ }
        }
      }

      const doneMap: Record<string, boolean> = {}
      ;(savedHabits ?? []).forEach(h => { doneMap[h.id] = h.done })
      const nextHabits = baseHabits.map(h => ({ ...h, done: doneMap[h.id] ?? false }))
      const nextFocus  = savedFocus ?? DEFAULT_FOCUS.map(f => ({ ...f }))
      setHabits(nextHabits)
      setFocus(nextFocus)
      setLoaded(true)
      onStateChange?.({ habits: nextHabits, focus: nextFocus })
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date, habitDefs])

  function persistDaily(h: Habit[], f: FocusItem[]) {
    if (isToday) {
      userStorage.setItem(`habits_${date}`, JSON.stringify(h))
      userStorage.setItem(`focus_${date}`, JSON.stringify(f))
    }
    saveDaily(date, { habits: h, focus: f })
    onStateChange?.({ habits: h, focus: f })
  }

  const toggleHabit = useCallback((id: string) => {
    if (!editable) return
    const next = habits.map(h => h.id === id ? { ...h, done: !h.done } : h)
    setHabits(next)
    persistDaily(next, focus)
    const h = next.find(x => x.id === id)
    if (h?.done) toast.success(`${h.icon} ${h.label} concluído!`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, habits, focus])

  const toggleFocus = useCallback((id: string) => {
    if (!editable) return
    const next = focus.map(f => f.id === id ? { ...f, done: !f.done } : f)
    setFocus(next)
    persistDaily(habits, next)
    const f = next.find(x => x.id === id)
    if (f?.done && f.text) toast.success(`🎯 "${f.text}" concluído!`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, focus, habits])

  const updateFocus = (id: string, text: string) => {
    if (!editable) return
    const next = focus.map(f => f.id === id ? { ...f, text } : f)
    setFocus(next)
    persistDaily(habits, next)
  }

  useImperativeHandle(ref, () => ({ toggleHabit, toggleFocus }), [toggleHabit, toggleFocus])

  // O dia corrente entra pelo estado local para o contador reagir ao toque.
  const historyWithToday: Record<string, DailyData> = {
    ...weekHistory,
    [date]: { ...weekHistory[date], habits },
  }
  const streakOf = (id: string) => {
    const def = habitDefs.find(d => d.id === id)
    return def ? computeHabitStreak(def, historyWithToday, date) : null
  }

  const doneHabits = habits.filter(h => h.done).length

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: C.muted, fontSize: T.text.lg }}>
        Carregando...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {managingHabits && <HabitosModal onClose={() => setManagingHabits(false)} />}

      {/* Foco */}
      <Card>
        <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14 }}>🎯 Foco do dia</div>
        {focus.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < focus.length - 1 ? 12 : 0 }}>
            <div
              onClick={() => f.text && toggleFocus(f.id)}
              style={{ width: 20, height: 20, borderRadius: T.radius.xs, border: `2px solid ${f.done ? C.orange : C.border2}`, background: f.done ? C.orange : 'transparent', flexShrink: 0, cursor: f.text && editable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {f.done && <span style={{ fontSize: T.text.xs, color: '#000', fontWeight: 900 }}>✓</span>}
            </div>
            <input
              type="text"
              value={f.text}
              onChange={e => updateFocus(f.id, e.target.value)}
              placeholder={`Prioridade ${i + 1}...`}
              disabled={!editable}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: f.done ? C.muted : C.text, fontSize: T.text.md, textDecoration: f.done ? 'line-through' : 'none', padding: 0 }}
            />
          </div>
        ))}
      </Card>

      {/* Hábitos */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl }}>✅ Hábitos</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setManagingHabits(true)}
              style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '3px 8px', fontSize: T.text.xs, color: C.muted, cursor: 'pointer', fontWeight: T.weight.semibold }}
            >
              ⚙ Editar
            </button>
            <span style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: doneHabits === habits.length ? C.green : C.muted }}>
              {doneHabits}/{habits.length}
            </span>
          </div>
        </div>
        <Bar pct={habits.length > 0 ? Math.round(doneHabits / habits.length * 100) : 0} color={C.green} h={4} />
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {habits.map(h => {
            const def = habitDefs.find(d => d.id === h.id)
            const streak = streakOf(h.id)
            // Hábito de frequência com a meta da semana batida entra em modo
            // descanso: continua clicável, mas não pesa como pendência.
            const resting = Boolean(def && streak && !h.done && !isPendingToday(def, streak, date))
            return (
              <div
                key={h.id}
                onClick={() => toggleHabit(h.id)}
                style={{
                  padding: '8px 10px',
                  background: h.done ? `${C.green}11` : C.card2,
                  borderRadius: T.radius.sm,
                  cursor: editable ? 'pointer' : 'default',
                  border: `1px solid ${h.done ? C.green + '44' : C.border}`,
                  opacity: resting ? 0.6 : 1,
                  transition: 'all .12s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: T.text.xl }}>{h.icon}</span>
                  <span style={{ flex: 1, fontSize: T.text.md, color: h.done ? C.muted : C.text, textDecoration: h.done ? 'line-through' : 'none' }}>
                    {h.label}
                  </span>
                  {def && streak && !isDaily(def) && (
                    <span
                      title={`Meta de ${targetOf(def)}x por semana`}
                      style={{
                        fontSize: T.text.xs, fontWeight: T.weight.bold, padding: '2px 7px',
                        borderRadius: T.radius.pill, whiteSpace: 'nowrap',
                        background: streak.weekMet ? `${C.green}22` : C.card3,
                        color: streak.weekMet ? C.green : C.muted,
                      }}
                    >
                      {streak.weekDone}/{streak.weekTarget}
                    </span>
                  )}
                  <span style={{ color: h.done ? C.green : C.border2, fontSize: T.text.lg }}>{h.done ? '✓' : '○'}</span>
                </div>
                {resting && (
                  <div style={{ fontSize: T.text.sm, color: C.green, marginTop: 6, paddingLeft: 25 }}>
                    ✅ Meta da semana cumprida — hoje pode descansar.
                  </div>
                )}
                {!h.done && !resting && h.why && (
                  <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6, paddingLeft: 25, lineHeight: 1.5 }}>
                    💭 {h.why}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
})
