import { useEffect, useState } from 'react'
import { ArrowRight, CalendarCheck2, Target } from 'lucide-react'
import { C, T } from '../data'
import { Card } from '../primitives'
import { getDailyHistory, type DailyData } from '../../lib/db'
import { lastNDays, todayKey } from '../../lib/date'
import { useAuthStore } from '../../store/useAuthStore'

interface Props {
  onOpenToday: () => void
  onOpenAgenda: () => void
}

/** Revisão breve dos últimos sete dias, sem premiar streaks artificiais. */
export function WeeklyPerformance({ onOpenToday, onOpenAgenda }: Props) {
  const uid = useAuthStore(s => s.user?.uid)
  const [history, setHistory] = useState<Record<string, DailyData>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!uid) { setLoading(false); return }
    setLoading(true)
    getDailyHistory(lastNDays(7)).then(data => {
      if (active) { setHistory(data); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [uid])

  const days = lastNDays(7)
  const entries = days.map(date => history[date]).filter((day): day is DailyData => Boolean(day?.habits?.length))
  const completed = entries.reduce((sum, day) => sum + (day.habits?.filter(h => h.done).length ?? 0), 0)
  const planned = entries.reduce((sum, day) => sum + (day.habits?.length ?? 0), 0)
  const rate = planned ? Math.round(completed / planned * 100) : null
  const today = history[todayKey()]
  const priorities = today?.focus?.filter(f => f.text.trim()).slice(0, 3) ?? []
  const remaining = priorities.filter(f => !f.done)
  const insight = rate === null
    ? 'Registre seus hábitos para começar a entender sua consistência.'
    : rate >= 80
      ? 'Sua consistência está forte. Preserve espaço para recuperar e continuar.'
      : rate >= 50
        ? 'Você já tem uma base. Escolha um hábito para tornar mais fácil nesta semana.'
        : 'Reduza a quantidade de compromissos e recomece com passos menores.'

  return (
    <Card style={{ marginBottom: 20, border: `1px solid ${C.orange}44` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ color: C.orange, fontSize: T.text.xs, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Sua evolução</div>
          <h2 style={{ fontSize: T.text['3xl'], fontWeight: 800, margin: '4px 0', color: C.text }}>Consistência, não perfeição.</h2>
          <div style={{ color: C.muted, fontSize: T.text.sm }}>Seus últimos 7 dias, com base nos hábitos registrados.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: C.orange, fontSize: T.text['5xl'], fontWeight: 800 }}>{loading ? '…' : rate === null ? '—' : `${rate}%`}</div>
          <div style={{ color: C.muted, fontSize: T.text.xs }}>{completed}/{planned} hábitos concluídos</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 14 }}>
        {days.map(date => {
          const day = history[date]
          const total = day?.habits?.length ?? 0
          const done = day?.habits?.filter(h => h.done).length ?? 0
          const pct = total ? Math.round(done / total * 100) : 0
          return <div key={date} title={`${date}: ${done}/${total} hábitos`} style={{ textAlign: 'center' }}>
            <div style={{ height: 48, borderRadius: 8, background: C.card2, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: `${pct}%`, minHeight: 0, background: C.orange, borderRadius: 8 }} />
            </div>
            <div style={{ fontSize: T.text.xs, marginTop: 5, color: C.muted }}>{date.slice(8)}</div>
          </div>
        })}
      </div>
      <p style={{ color: C.muted, fontSize: T.text.sm, lineHeight: 1.6, margin: '0 0 16px' }}>{insight}</p>
      <div style={{ background: C.card2, padding: 14, borderRadius: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.text, fontWeight: 700, marginBottom: 9 }}><Target size={16} color={C.orange} /> As 3 prioridades de hoje</div>
        {priorities.length ? priorities.map((f, i) => <div key={f.id} style={{ padding: '5px 0', color: f.done ? C.muted : C.text, fontSize: T.text.md, textDecoration: f.done ? 'line-through' : 'none' }}>{i + 1}. {f.text}</div>) : <div style={{ color: C.muted, fontSize: T.text.sm }}>Defina até três prioridades na tela Hoje.</div>}
        {priorities.length > 0 && <div style={{ marginTop: 8, color: C.muted, fontSize: T.text.xs }}>{remaining.length === 0 ? 'Prioridades concluídas!' : `${remaining.length} prioridade(s) ainda pendente(s)`}</div>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onOpenToday} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: C.orange, color: '#fff', padding: '10px 13px', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}><Target size={15} /> Organizar meu dia <ArrowRight size={14} /></button>
        <button type="button" onClick={onOpenAgenda} style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.card2, color: C.text, padding: '10px 13px', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}><CalendarCheck2 size={15} /> Ver agenda</button>
      </div>
    </Card>
  )
}
