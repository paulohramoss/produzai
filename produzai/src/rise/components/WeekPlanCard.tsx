// Plano da semana: a grade do que está previsto, e a aderência entre planejado
// e executado. É o que tira o app do modo puramente retrospectivo.

import { useContext, useMemo, useState } from 'react'
import { CalendarRange, Plus } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, Bar } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { usePlanStore } from '../../store/usePlanStore'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import {
  weekAdherence, WEEKDAY_SHORT, WEEKDAY_NAMES, type Weekday,
} from '../../lib/weekPlan'
import { ACTIVITY_TYPES, DEFAULT_DURATION, DEFAULT_NAMES } from '../../lib/workouts'
import { EFFORT_LEVELS, type EffortLevel } from '../../lib/calories'
import { toast } from '../../lib/toast'

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

const inp: React.CSSProperties = {
  width: '100%', background: C.card, border: `1px solid ${C.border2}`,
  borderRadius: T.radius.sm, padding: '9px 11px', color: C.text,
  fontSize: T.text.md, outline: 'none', boxSizing: 'border-box',
}

function typeColor(type: string): string {
  switch (type) {
    case 'Corrida': return C.running
    case 'Caminhada': return C.green
    case 'Academia': return C.purple
    case 'Ciclismo': return C.orange
    case 'Natação': return C.blue
    case 'Futebol': return C.green
    default: return C.muted2
  }
}

export function WeekPlanCard() {
  const { isMobile } = useContext(LayoutContext)
  const sessions = usePlanStore(s => s.sessions)
  const addSession = usePlanStore(s => s.add)
  const removeSession = usePlanStore(s => s.remove)
  const workouts = useWorkoutStore(s => s.workouts)

  const [adding, setAdding] = useState<Weekday | null>(null)
  const [draft, setDraft] = useState({ type: 'Corrida', name: '', durationMin: '40', effort: 3 as EffortLevel })

  const adherence = useMemo(() => weekAdherence(sessions, workouts), [sessions, workouts])

  function openAdd(weekday: Weekday) {
    setDraft({ type: 'Corrida', name: '', durationMin: '40', effort: 3 })
    setAdding(weekday)
  }

  function submit() {
    if (adding === null) return
    const durationMin = parseInt(draft.durationMin) || DEFAULT_DURATION[draft.type] || 45
    addSession({
      weekday: adding,
      type: draft.type,
      name: draft.name.trim() || DEFAULT_NAMES[draft.type] || draft.type,
      durationMin,
      effort: draft.effort,
    })
    toast.success(`📅 ${WEEKDAY_NAMES[adding]}: ${draft.name.trim() || draft.type} no plano`)
    setAdding(null)
  }

  return (
    <Card style={{ borderTop: `2px solid ${C.blue}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}>
            <CalendarRange size={17} color={C.blue} /> Plano da semana
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted, marginTop: 4 }}>
            A grade se repete toda semana. Toque num dia para adicionar.
          </div>
        </div>
        {adherence.plannedCount > 0 && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: adherence.pct >= 80 ? C.green : adherence.pct >= 50 ? C.orange : C.red, ...displayStyle }}>
              {adherence.pct}%
            </div>
            <div style={{ fontSize: T.text.xs, color: C.muted }}>
              {adherence.matchedCount}/{adherence.plannedCount} até aqui
            </div>
          </div>
        )}
      </div>

      {adherence.plannedCount > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Bar pct={adherence.pct} color={adherence.pct >= 80 ? C.green : C.orange} h={4} />
        </div>
      )}

      {/* Grade */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(7, 1fr)', gap: 8 }}>
        {WEEKDAYS.map(wd => {
          const day = adherence.days.find(d => d.weekday === wd)
          const planned = day?.planned ?? []
          return (
            <div
              key={wd}
              style={{
                background: C.card2, borderRadius: T.radius.md, padding: 9,
                border: `1px solid ${C.border}`,
                minHeight: isMobile ? undefined : 96,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: T.text.xs, color: C.muted, fontWeight: T.weight.bold, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {isMobile ? WEEKDAY_NAMES[wd] : WEEKDAY_SHORT[wd]}
                </span>
                <button
                  onClick={() => openAdd(wd)}
                  title={`Adicionar treino em ${WEEKDAY_NAMES[wd]}`}
                  style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <Plus size={13} />
                </button>
              </div>

              {planned.length === 0 ? (
                <div style={{ fontSize: T.text.xs, color: C.border2, textAlign: 'center', padding: '8px 0' }}>descanso</div>
              ) : (
                planned.map((p, idx) => {
                  // As primeiras `matched` sessões do dia foram cumpridas.
                  const done = day ? idx < day.matched : false
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: C.card, borderRadius: T.radius.xs, padding: '6px 7px', marginBottom: 4,
                        borderLeft: `3px solid ${typeColor(p.type)}`,
                        opacity: day?.future ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ flex: 1, fontSize: T.text.xs, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        <button
                          onClick={() => removeSession(p.id)}
                          title="Remover do plano"
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text.md, lineHeight: 1, padding: 0, flexShrink: 0 }}
                        >×</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: T.text['2xs'], color: C.muted }}>{p.durationMin}min</span>
                        {done && <span style={{ fontSize: T.text['2xs'], color: C.green, fontWeight: T.weight.bold }}>✓ feito</span>}
                        {!done && day && !day.future && <span style={{ fontSize: T.text['2xs'], color: C.red }}>não feito</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>

      {/* Resumo */}
      {(adherence.extraCount > 0 || adherence.missed.length > 0) && (
        <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
          {adherence.missed.length > 0 && `${adherence.missed.length} ${adherence.missed.length === 1 ? 'sessão prevista ficou' : 'sessões previstas ficaram'} para trás nesta semana. `}
          {adherence.extraCount > 0 && `${adherence.extraCount} ${adherence.extraCount === 1 ? 'treino extra' : 'treinos extras'} fora do plano.`}
        </div>
      )}

      {/* Modal de adição */}
      {adding !== null && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setAdding(null) }}
          className="rise-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="rise-modal" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius['3xl'], padding: 'clamp(18px, 5vw, 24px)', width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, ...displayStyle }}>
                Treino de {WEEKDAY_NAMES[adding].toLowerCase()}
              </div>
              <button onClick={() => setAdding(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 7 }}>Tipo</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setDraft(d => ({ ...d, type: t, durationMin: String(DEFAULT_DURATION[t] ?? 45) }))}
                    style={{
                      padding: '6px 12px', borderRadius: T.radius.sm, border: 'none', cursor: 'pointer',
                      fontSize: T.text.base, fontWeight: draft.type === t ? T.weight.bold : T.weight.regular,
                      background: draft.type === t ? typeColor(t) : C.card2,
                      color: draft.type === t ? '#fff' : C.muted,
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 7 }}>Nome</div>
                <input
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder={DEFAULT_NAMES[draft.type]}
                  style={inp}
                />
              </div>
              <div>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 7 }}>Minutos</div>
                <input
                  type="number" min={5} max={600}
                  value={draft.durationMin}
                  onChange={e => setDraft(d => ({ ...d, durationMin: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 7 }}>Esforço previsto</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {EFFORT_LEVELS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setDraft(d => ({ ...d, effort: value }))}
                    style={{
                      flex: 1, padding: '8px 2px', borderRadius: T.radius.sm, border: 'none', cursor: 'pointer',
                      fontSize: T.text.xs, fontWeight: draft.effort === value ? T.weight.bold : T.weight.regular,
                      background: draft.effort === value ? typeColor(draft.type) : C.card2,
                      color: draft.effort === value ? '#fff' : C.muted,
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            <button
              onClick={submit}
              style={{
                width: '100%', padding: 11, borderRadius: T.radius.md, border: 'none',
                background: C.blue, color: '#fff', fontSize: T.text.xl, fontWeight: T.weight.bold, cursor: 'pointer',
              }}
            >
              Adicionar ao plano
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
