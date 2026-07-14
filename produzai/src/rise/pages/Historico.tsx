import { useState, useEffect, useContext } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { History } from 'lucide-react'
import { Card } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { getDailyHistory, type DailyData } from '../../lib/db'
import { DailyChecklist } from '../components/DailyChecklist'
import { computeScore } from '../../lib/dailyScore'
import { LayoutContext } from '../LayoutContext'

interface Props { setPage: (p: Page) => void }

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function pad(n: number) { return String(n).padStart(2, '0') }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }
function todayKey() { return new Date().toISOString().slice(0, 10) }

function monthLabel(viewMonth: Date): string {
  const s = viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function Historico({ setPage: _s }: Props) {
  const user      = useAuthStore(s => s.user)
  const habitDefs = useHabitsStore(s => s.defs)
  const { isMobile } = useContext(LayoutContext)
  const today = todayKey()

  const [viewMonth, setViewMonth]   = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [monthData, setMonthData]   = useState<Record<string, DailyData>>({})
  const [loaded, setLoaded]         = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(today)

  const year  = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = new Date(year, month, 1).getDay()
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth()

  useEffect(() => {
    async function load() {
      if (!user) { setLoaded(true); return }
      setLoaded(false)
      const dates = Array.from({ length: daysInMonth }, (_, i) => dateKey(year, month, i + 1))
      const data = await getDailyHistory(dates)
      setMonthData(data)
      setLoaded(true)
    }
    load()
  }, [user, year, month, daysInMonth])

  function scoreFor(date: string): number | null {
    const d = monthData[date]
    if (!d) return null
    return computeScore(
      habitDefs.map(def => ({ ...def, done: d.habits?.find(h => h.id === def.id)?.done ?? false })),
      d.focus ?? [],
    )
  }

  function cellStyle(date: string, isFuture: boolean): React.CSSProperties {
    if (isFuture) {
      return { background: C.card2, opacity: 0.35, pointerEvents: 'none' as const }
    }
    const score = scoreFor(date)
    const isToday = date === today
    const base: React.CSSProperties = { cursor: 'pointer', transition: 'all .12s' }
    if (score === null) {
      return { ...base, background: C.card2, border: isToday ? `2px solid ${C.border2}` : '1px solid transparent' }
    }
    if (score === 100) {
      return { ...base, background: `${C.green}40`, border: `${isToday ? 2 : 1}px solid ${C.green}` }
    }
    return { ...base, background: `${C.orange}40`, border: `${isToday ? 2 : 1}px solid ${C.orange}` }
  }

  function changeMonth(delta: number) {
    setViewMonth(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + delta)
      return d
    })
  }

  const panel = selectedDate && (
    <DailyChecklist
      key={selectedDate}
      date={selectedDate}
      editable={selectedDate <= today}
      onStateChange={s => {
        setMonthData(prev => ({ ...prev, [selectedDate]: { habits: s.habits, focus: s.focus } }))
      }}
    />
  )

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: T.text.lg }}>
        Faça login para ver seu histórico.
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 22 : 26, fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><History size={20} color={C.orange} /> Histórico</div>
        <div style={{ fontSize: T.text.md, color: C.muted }}>Veja o que foi preenchido em cada dia e complete o que ficou faltando</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button
              onClick={() => changeMonth(-1)}
              style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, width: 30, height: 30, color: C.text, cursor: 'pointer', fontSize: T.text.lg }}
            >
              ‹
            </button>
            <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl, textTransform: 'capitalize' }}>{monthLabel(viewMonth)}</div>
            <button
              onClick={() => changeMonth(1)}
              disabled={isCurrentMonth}
              style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, width: 30, height: 30, color: isCurrentMonth ? C.muted : C.text, cursor: isCurrentMonth ? 'default' : 'pointer', fontSize: T.text.lg, opacity: isCurrentMonth ? 0.4 : 1 }}
            >
              ›
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 5 }}>
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: T.text.xs, color: C.muted, fontWeight: T.weight.bold }}>{w}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
            {Array.from({ length: startOffset }, (_, i) => <div key={`blank-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day  = i + 1
              const date = dateKey(year, month, day)
              const isFuture = date > today
              return (
                <div
                  key={date}
                  onClick={() => !isFuture && setSelectedDate(date)}
                  style={{
                    ...cellStyle(date, isFuture),
                    height: 34, borderRadius: T.radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: T.text.base, fontWeight: date === selectedDate ? 800 : 500,
                    color: isFuture ? C.muted : C.text,
                    outline: date === selectedDate ? `2px solid ${C.text}44` : 'none',
                  }}
                >
                  {day}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: T.text.sm, color: C.muted, flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: `${C.green}55`, border: `1px solid ${C.green}`, borderRadius: 2, marginRight: 5 }} />completo</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: `${C.orange}55`, border: `1px solid ${C.orange}`, borderRadius: 2, marginRight: 5 }} />parcial</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 2, marginRight: 5 }} />sem registro</span>
          </div>

          {!loaded && <div style={{ textAlign: 'center', color: C.muted, fontSize: T.text.base, marginTop: 14 }}>Carregando mês...</div>}
        </Card>

        <div>
          {selectedDate ? panel : (
            <Card>
              <div style={{ textAlign: 'center', color: C.muted, fontSize: T.text.md, padding: '20px 0' }}>
                Selecione um dia no calendário para ver ou preencher.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
