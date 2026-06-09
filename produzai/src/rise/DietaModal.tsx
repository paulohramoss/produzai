import { useState } from 'react'
import { C } from './data'
import { useWebDietStore, type WebDietGoals, type WebDietMeal } from '../store/useWebDietStore'
import { toast } from '../lib/toast'
import { DIET_TEMPLATES } from './data/templates'
import { estimateMealMacros } from '../lib/anthropic'

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

type MealForm = Omit<WebDietMeal, 'id'>

function itemsToString(items: string[] | unknown): string {
  if (Array.isArray(items)) return items.join(', ')
  return String(items ?? '')
}

function stringToItems(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

interface MealFormBlockProps {
  form: MealForm
  onChange: (k: keyof MealForm, v: string) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  canSubmit: boolean
}

function MealFormBlock({ form, onChange, onSubmit, onCancel, submitLabel, canSubmit }: MealFormBlockProps) {
  const [calcLoading, setCalcLoading] = useState(false)

  async function handleCalc() {
    const items = stringToItems(itemsToString(form.items))
    if (items.length === 0) return
    setCalcLoading(true)
    const result = await estimateMealMacros(items)
    setCalcLoading(false)
    if (result) {
      onChange('cal', String(result.cal))
      onChange('prot', String(result.prot))
      onChange('carb', String(result.carb))
      onChange('fat', String(result.fat))
      toast.success('✨ Macros estimados pela IA!')
    } else {
      toast.error('Não foi possível estimar os macros.')
    }
  }

  const hasItems = itemsToString(form.items).trim().length > 0

  return (
    <div style={{ background: C.card2, borderRadius: 12, padding: 16, border: `1px solid ${C.border2}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Hora</label>
          <input type="text" placeholder="07:00" value={form.time} onChange={e => onChange('time', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Nome</label>
          <input type="text" placeholder="Café da manhã" value={form.name} onChange={e => onChange('name', e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Alimentos (separe por vírgula)</label>
          {hasItems && (
            <button
              onClick={handleCalc}
              disabled={calcLoading}
              style={{ background: calcLoading ? C.card : `${C.green}18`, border: `1px solid ${calcLoading ? C.border : C.green + '44'}`, borderRadius: 6, padding: '3px 10px', color: calcLoading ? C.muted : C.green, fontSize: 11, fontWeight: 600, cursor: calcLoading ? 'not-allowed' : 'pointer' }}>
              {calcLoading ? '⏳ Calculando...' : '✨ Calcular macros'}
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="3 ovos mexidos, Aveia 60g, Banana"
          value={itemsToString(form.items)}
          onChange={e => onChange('items', e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        {([
          { k: 'cal', l: 'Kcal', c: C.orange },
          { k: 'prot', l: 'Prot (g)', c: C.blue },
          { k: 'carb', l: 'Carb (g)', c: C.green },
          { k: 'fat', l: 'Gord (g)', c: C.purple },
        ] as { k: keyof MealForm; l: string; c: string }[]).map(({ k, l, c }) => (
          <div key={k}>
            <label style={labelStyle}>{l}</label>
            <input
              type="number"
              placeholder="0"
              value={(form[k] as number) || ''}
              onChange={e => onChange(k, e.target.value)}
              style={{ ...inputStyle, color: c }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{ flex: 1, background: canSubmit ? C.green : C.card, border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, color: canSubmit ? '#fff' : C.muted, cursor: canSubmit ? 'pointer' : 'default' }}>
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, color: C.muted, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function DietaModal({ onClose }: Props) {
  const store = useWebDietStore()
  const data = store.data!

  const [goals, setGoals] = useState<WebDietGoals>({ ...data.goals })
  const [goalsSaved, setGoalsSaved] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<MealForm>({ ...EMPTY_MEAL })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<MealForm>({ ...EMPTY_MEAL })
  const [showTemplates, setShowTemplates] = useState(false)

  function applyDietTemplate(tpl: typeof DIET_TEMPLATES[0]) {
    store.updateGoals(tpl.goals)
    setGoals({ ...tpl.goals })
    data.meals.forEach(m => store.removeMeal(m.id))
    tpl.meals.forEach(m => store.addMeal({ ...m, done: false, items: [] }))
    toast.success(`🥗 Template "${tpl.name}" aplicado!`)
    setShowTemplates(false)
  }

  const saveGoals = () => {
    store.updateGoals(goals)
    setGoalsSaved(true)
    setTimeout(() => setGoalsSaved(false), 1800)
    toast.success('🥗 Metas nutricionais salvas!')
  }

  function setAddField(k: keyof MealForm, v: string) {
    setAddForm(f => ({ ...f, [k]: v }))
  }

  function submitAdd() {
    if (!addForm.name.trim()) return
    const items = stringToItems(itemsToString(addForm.items))
    store.addMeal({ ...addForm, items, cal: +addForm.cal, prot: +addForm.prot, carb: +addForm.carb, fat: +addForm.fat })
    toast.success(`✅ Refeição "${addForm.name}" adicionada!`)
    setAddForm({ ...EMPTY_MEAL })
    setAdding(false)
  }

  function startEdit(m: WebDietMeal) {
    setEditingId(m.id)
    setEditForm({ time: m.time, name: m.name, cal: m.cal, prot: m.prot, carb: m.carb, fat: m.fat, done: m.done, items: m.items })
    setAdding(false)
  }

  function setEditField(k: keyof MealForm, v: string) {
    setEditForm(f => ({ ...f, [k]: v }))
  }

  function submitEdit() {
    if (!editingId || !editForm.name.trim()) return
    const items = stringToItems(itemsToString(editForm.items))
    store.updateMeal(editingId, { ...editForm, items, cal: +editForm.cal, prot: +editForm.prot, carb: +editForm.carb, fat: +editForm.fat })
    toast.success(`✅ Refeição "${editForm.name}" atualizada!`)
    setEditingId(null)
  }

  const setGoal = (k: keyof WebDietGoals, v: string) =>
    setGoals(g => ({ ...g, [k]: +v || 0 }))

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

          {/* Diet Templates */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowTemplates(s => !s)}
              style={{ width: '100%', background: showTemplates ? C.green : C.card2, border: `1px solid ${showTemplates ? C.green : C.border2}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: showTemplates ? '#fff' : C.muted, cursor: 'pointer', textAlign: 'left' }}>
              📋 {showTemplates ? 'Fechar templates' : 'Usar um template de dieta'}
            </button>
            {showTemplates && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DIET_TEMPLATES.map((tpl, i) => (
                  <div
                    key={i}
                    onClick={() => applyDietTemplate(tpl)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.card2, borderRadius: 10, cursor: 'pointer', border: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{tpl.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{tpl.goal}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>{tpl.goals.cal} kcal</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{tpl.meals.length} refeições</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              style={{ background: C.green, border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
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
              <div key={m.id} style={{ marginBottom: 6 }}>
                {editingId === m.id ? (
                  <MealFormBlock
                    form={editForm}
                    onChange={setEditField}
                    onSubmit={submitEdit}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Salvar alterações"
                    canSubmit={!!editForm.name.trim()}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.card2, borderRadius: 10, borderLeft: `3px solid ${m.done ? C.green : C.border}` }}>
                    <span style={{ fontSize: 11, color: C.muted, minWidth: 38, flexShrink: 0 }}>{m.time}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: C.orange, flexShrink: 0 }}>{m.cal}kcal</span>
                    <span style={{ fontSize: 10, color: C.blue, flexShrink: 0 }}>P:{m.prot}g</span>
                    <span style={{ fontSize: 10, color: C.green, flexShrink: 0 }}>C:{m.carb}g</span>
                    <span style={{ fontSize: 10, color: C.purple, flexShrink: 0 }}>G:{m.fat}g</span>
                    <button
                      onClick={() => startEdit(m)}
                      style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 15, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                      title="Editar">✏️</button>
                    <button
                      onClick={() => store.removeMeal(m.id)}
                      style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 15, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                      title="Remover">🗑</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add meal form */}
          {!adding ? (
            <button
              onClick={() => { setAdding(true); setEditingId(null) }}
              style={{ width: '100%', background: 'transparent', border: `1px dashed ${C.border2}`, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, color: C.green, cursor: 'pointer' }}>
              + Adicionar refeição
            </button>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 }}>Nova refeição</div>
              <MealFormBlock
                form={addForm}
                onChange={setAddField}
                onSubmit={submitAdd}
                onCancel={() => { setAdding(false); setAddForm({ ...EMPTY_MEAL }) }}
                submitLabel="Adicionar"
                canSubmit={!!addForm.name.trim()}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: C.green, border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
