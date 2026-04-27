import { useState } from 'react'
import { C } from './data'
import { useWebDietStore, type WebDietGoals, type WebDietMeal } from '../store/useWebDietStore'

interface Props {
  onClose: () => void
}

const EMPTY_MEAL: Omit<WebDietMeal, 'id'> = {
  time: '', name: '', cal: 0, prot: 0, carb: 0, fat: 0, done: false, items: [],
}

const inputStyle = {
  background: C.card,
  border: `1px solid ${C.border2}`,
  borderRadius: 8,
  padding: '8px 10px',
  color: C.text,
  fontSize: 13,
  width: '100%',
  outline: 'none',
} as React.CSSProperties

const labelStyle = {
  fontSize: 10,
  color: C.muted,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
  marginBottom: 4,
  display: 'block',
}

export function DietaModal({ onClose }: Props) {
  const store = useWebDietStore()
  const data = store.data!

  const [goals, setGoals] = useState<WebDietGoals>({ ...data.goals })
  const [goalsSaved, setGoalsSaved] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Omit<WebDietMeal, 'id'>>({ ...EMPTY_MEAL })

  const saveGoals = () => {
    store.updateGoals(goals)
    setGoalsSaved(true)
    setTimeout(() => setGoalsSaved(false), 1800)
  }

  const submitMeal = () => {
    if (!form.name.trim() || !form.cal) return
    const items = (form.items as unknown as string)
      .toString()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    store.addMeal({ ...form, items, cal: +form.cal, prot: +form.prot, carb: +form.carb, fat: +form.fat })
    setForm({ ...EMPTY_MEAL })
    setAdding(false)
  }

  const setGoal = (k: keyof WebDietGoals, v: string) =>
    setGoals(g => ({ ...g, [k]: +v || 0 }))

  const setField = (k: keyof Omit<WebDietMeal, 'id'>, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 18, background: 'transparent', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📊 Editar Plano Alimentar</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Metas diárias e refeições</div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* Goals */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Metas diárias</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {([
                { k: 'cal', l: 'Calorias', u: 'kcal', c: C.orange },
                { k: 'prot', l: 'Proteína', u: 'g', c: C.blue },
                { k: 'carb', l: 'Carboidrato', u: 'g', c: C.green },
                { k: 'fat', l: 'Gordura', u: 'g', c: C.purple },
              ] as { k: keyof WebDietGoals; l: string; u: string; c: string }[]).map(({ k, l, u, c }) => (
                <div key={k}>
                  <label style={labelStyle}>{l} ({u})</label>
                  <input
                    type="number"
                    value={goals[k] || ''}
                    onChange={e => setGoal(k, e.target.value)}
                    style={{ ...inputStyle, color: c }}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={saveGoals}
              style={{ background: goalsSaved ? C.green : C.webdiet, border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', transition: 'background .2s' }}
            >
              {goalsSaved ? '✓ Metas salvas!' : 'Salvar metas'}
            </button>
          </div>

          {/* Meals list */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              Refeições ({data.meals.length})
            </div>

            {data.meals.length === 0 && (
              <div style={{ fontSize: 13, color: C.muted, padding: '12px 0', textAlign: 'center' }}>
                Nenhuma refeição. Adicione abaixo.
              </div>
            )}

            {[...data.meals].sort((a, b) => a.time.localeCompare(b.time)).map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.card2, borderRadius: 10, marginBottom: 6, borderLeft: `3px solid ${m.done ? C.webdiet : C.border}` }}>
                <span style={{ fontSize: 11, color: C.muted, minWidth: 38, flexShrink: 0 }}>{m.time}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                <span style={{ fontSize: 11, color: C.orange, flexShrink: 0 }}>{m.cal}kcal</span>
                <span style={{ fontSize: 10, color: C.blue, flexShrink: 0 }}>P:{m.prot}g</span>
                <span style={{ fontSize: 10, color: C.green, flexShrink: 0 }}>C:{m.carb}g</span>
                <span style={{ fontSize: 10, color: C.purple, flexShrink: 0 }}>G:{m.fat}g</span>
                <button
                  onClick={() => store.removeMeal(m.id)}
                  style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
                  title="Remover"
                >🗑</button>
              </div>
            ))}
          </div>

          {/* Add meal form */}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              style={{ width: '100%', background: 'transparent', border: `1px dashed ${C.border2}`, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, color: C.webdiet, cursor: 'pointer' }}
            >
              + Adicionar refeição
            </button>
          ) : (
            <div style={{ background: C.card2, borderRadius: 12, padding: 16, border: `1px solid ${C.border2}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.webdiet, marginBottom: 12 }}>Nova refeição</div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Hora</label>
                  <input type="text" placeholder="07:00" value={form.time} onChange={e => setField('time', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nome</label>
                  <input type="text" placeholder="Café da manhã" value={form.name} onChange={e => setField('name', e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                {([
                  { k: 'cal', l: 'Kcal', c: C.orange },
                  { k: 'prot', l: 'Prot (g)', c: C.blue },
                  { k: 'carb', l: 'Carb (g)', c: C.green },
                  { k: 'fat', l: 'Gord (g)', c: C.purple },
                ] as { k: keyof typeof form; l: string; c: string }[]).map(({ k, l, c }) => (
                  <div key={k}>
                    <label style={labelStyle}>{l}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={(form[k] as number) || ''}
                      onChange={e => setField(k, e.target.value)}
                      style={{ ...inputStyle, color: c }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Alimentos (separe por vírgula)</label>
                <input
                  type="text"
                  placeholder="3 ovos mexidos, Aveia 60g, Banana"
                  value={(form.items as unknown as string) || ''}
                  onChange={e => setField('items', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={submitMeal}
                  disabled={!form.name.trim() || !form.cal}
                  style={{ flex: 1, background: form.name.trim() && form.cal ? C.webdiet : C.card, border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, color: form.name.trim() && form.cal ? '#fff' : C.muted, cursor: form.name.trim() && form.cal ? 'pointer' : 'default' }}
                >
                  Adicionar
                </button>
                <button
                  onClick={() => { setAdding(false); setForm({ ...EMPTY_MEAL }) }}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, color: C.muted, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: C.webdiet, border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
