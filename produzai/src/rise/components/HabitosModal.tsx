import { useState } from 'react'
import { T, C } from '../data'
import { useHabitsStore } from '../../store/useHabitsStore'
import { toast } from '../../lib/toast'
import { targetOf, DEFAULT_TARGET_PER_WEEK } from '../../lib/streaks'

const EMOJI_OPTIONS = [
  '💧','🏋','📚','🧘','😴','🥩','🚶','🏃','🚫','🧠','💪','🍎',
  '☕','🎯','✍️','🎵','🌞','🌙','🥤','🧃','🏊','🚴','⚽','🎾',
  '🧹','💊','🌿','🫁','❤️','🔥','⚡','🎖️','📝','🧘‍♂️','🛌',
]

/** Frequências oferecidas. 7 = diário, o padrão de sempre. */
const FREQUENCY_OPTIONS = [
  { value: 7, label: 'Todo dia' },
  { value: 6, label: '6x' },
  { value: 5, label: '5x' },
  { value: 4, label: '4x' },
  { value: 3, label: '3x' },
  { value: 2, label: '2x' },
  { value: 1, label: '1x' },
]

function FrequencyPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: T.text.xs, color: C.muted, marginBottom: 6 }}>
        Quantas vezes por semana? Abaixo de "todo dia", o hábito é cobrado na semana —
        dia de descanso planejado deixa de contar como falha.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {FREQUENCY_OPTIONS.map(f => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            style={{
              padding: '5px 11px', borderRadius: T.radius.xs, cursor: 'pointer',
              fontSize: T.text.sm, fontWeight: value === f.value ? T.weight.bold : T.weight.regular,
              background: value === f.value ? C.orange : C.card,
              border: `1px solid ${value === f.value ? C.orange : C.border2}`,
              color: value === f.value ? '#fff' : C.muted,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface Props { onClose: () => void }

export function HabitosModal({ onClose }: Props) {
  const { defs, addDef, removeDef, updateDef } = useHabitsStore()

  const [adding, setAdding]     = useState(false)
  const [newIcon, setNewIcon]   = useState('🎯')
  const [newLabel, setNewLabel] = useState('')
  const [newWhy, setNewWhy]     = useState('')
  const [newTarget, setNewTarget] = useState(DEFAULT_TARGET_PER_WEEK)
  const [editing, setEditing]   = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editWhy, setEditWhy]     = useState('')
  const [editTarget, setEditTarget] = useState(DEFAULT_TARGET_PER_WEEK)

  const inp: React.CSSProperties = {
    background: C.card2, border: `1px solid ${C.border2}`,
    borderRadius: T.radius.sm, padding: '9px 12px', color: C.text,
    fontSize: T.text.md, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  const textarea: React.CSSProperties = {
    ...inp, resize: 'none' as const, lineHeight: 1.5, fontFamily: 'inherit',
  }

  function submitAdd() {
    if (!newLabel.trim()) return
    addDef({ icon: newIcon, label: newLabel.trim(), why: newWhy.trim() || undefined, targetPerWeek: newTarget })
    toast.success(`${newIcon} Hábito "${newLabel.trim()}" criado!`)
    setNewLabel(''); setNewIcon('🎯'); setNewWhy(''); setNewTarget(DEFAULT_TARGET_PER_WEEK); setAdding(false)
  }

  function submitEdit(id: string) {
    if (!editLabel.trim()) return
    updateDef(id, { label: editLabel.trim(), why: editWhy.trim() || undefined, targetPerWeek: editTarget })
    toast.success('✏️ Hábito atualizado!')
    setEditing(null)
  }

  function handleRemove(id: string) {
    const d = defs.find(x => x.id === id)
    removeDef(id)
    if (d) toast.info(`🗑 "${d.label}" removido`)
  }

  return (
    <div className="rise-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius['4xl'], width: '100%', maxWidth: 480, maxHeight: 'calc(100dvh - 48px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: T.weight.extrabold, fontSize: 17 }}>✅ Gerenciar Hábitos</div>
            <div style={{ fontSize: T.text.base, color: C.muted, marginTop: 2 }}>{defs.length} hábitos configurados</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: T.text['5xl'], cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Habit list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          {defs.map(d => (
            <div key={d.id} style={{ padding: '10px 12px', background: C.card2, borderRadius: T.radius.md, marginBottom: 8, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: T.text['4xl'], flexShrink: 0 }}>{d.icon}</span>

                {editing === d.id ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditing(null) }}
                    style={{ ...inp, flex: 1 }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: T.text.md, fontWeight: T.weight.medium }}>{d.label}</span>
                )}

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {editing === d.id ? (
                    <>
                      <button onClick={() => submitEdit(d.id)} style={{ background: C.green, border: 'none', borderRadius: T.radius.xs, padding: '5px 10px', color: '#fff', fontSize: T.text.sm, fontWeight: T.weight.bold, cursor: 'pointer' }}>Salvar</button>
                      <button onClick={() => setEditing(null)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius.xs, padding: '5px 10px', color: C.muted, fontSize: T.text.sm, cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditing(d.id); setEditLabel(d.label); setEditWhy(d.why ?? ''); setEditTarget(targetOf(d)) }} style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '5px 8px', color: C.muted, fontSize: T.text.sm, cursor: 'pointer' }}>✏️</button>
                      {defs.length > 1 && (
                        <button onClick={() => handleRemove(d.id)} style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '5px 8px', color: C.muted, fontSize: T.text.sm, cursor: 'pointer' }}>🗑</button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {editing === d.id ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: T.text.xs, color: C.muted, marginBottom: 4 }}>💭 Por que esse hábito importa pra você?</div>
                    <textarea
                      value={editWhy}
                      onChange={e => setEditWhy(e.target.value)}
                      placeholder="Ex: porque dormir bem me deixa com mais paciência com meus filhos"
                      rows={2}
                      style={{ ...textarea, fontSize: T.text.base }}
                    />
                  </div>
                  <FrequencyPicker value={editTarget} onChange={setEditTarget} />
                </div>
              ) : (
                <>
                  {targetOf(d) < 7 && (
                    <div style={{ marginTop: 6, fontSize: T.text.sm, color: C.orange, paddingLeft: 30 }}>
                      🎯 {targetOf(d)}x por semana
                    </div>
                  )}
                  {d.why && (
                    <div style={{ marginTop: 8, fontSize: T.text.sm, color: C.muted, lineHeight: 1.5, paddingLeft: 30 }}>
                      💭 {d.why}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Add form */}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              disabled={defs.length >= 12}
              style={{ width: '100%', background: 'transparent', border: `1px dashed ${C.border2}`, borderRadius: T.radius.md, padding: '11px', fontSize: T.text.md, fontWeight: T.weight.bold, color: defs.length >= 12 ? C.muted : C.green, cursor: defs.length >= 12 ? 'default' : 'pointer', marginTop: 4 }}
            >
              {defs.length >= 12 ? 'Máximo de 12 hábitos atingido' : '+ Adicionar hábito'}
            </button>
          ) : (
            <div style={{ background: C.card2, borderRadius: T.radius.lg, padding: 16, border: `1px solid ${C.border2}`, marginTop: 4 }}>
              <div style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.green, marginBottom: 12 }}>Novo hábito</div>

              {/* Emoji picker */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 8 }}>Escolha um ícone</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => setNewIcon(e)}
                      style={{
                        fontSize: T.text['3xl'], padding: '6px 8px', borderRadius: T.radius.sm, cursor: 'pointer', border: 'none',
                        background: newIcon === e ? `${C.orange}33` : C.card,
                        outline: newIcon === e ? `2px solid ${C.orange}` : 'none',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <input
                  autoFocus
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitAdd() }}
                  placeholder="Nome do hábito..."
                  style={inp}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 6 }}>💭 Por que esse hábito importa pra você? (opcional)</div>
                <textarea
                  value={newWhy}
                  onChange={e => setNewWhy(e.target.value)}
                  placeholder="Ex: porque ter mais energia me deixa mais presente com quem eu amo"
                  rows={2}
                  style={{ ...textarea, fontSize: T.text.base }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <FrequencyPicker value={newTarget} onChange={setNewTarget} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitAdd} disabled={!newLabel.trim()} style={{ flex: 1, background: newLabel.trim() ? C.green : C.card2, border: 'none', borderRadius: T.radius.sm, padding: '10px', fontSize: T.text.md, fontWeight: T.weight.bold, color: newLabel.trim() ? '#fff' : C.muted, cursor: newLabel.trim() ? 'pointer' : 'default' }}>Criar</button>
                <button onClick={() => { setAdding(false); setNewLabel(''); setNewIcon('🎯'); setNewWhy(''); setNewTarget(DEFAULT_TARGET_PER_WEEK) }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius.sm, padding: '10px 16px', fontSize: T.text.md, color: C.muted, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', background: C.orange, border: 'none', borderRadius: T.radius.md, padding: '11px', fontSize: T.text.lg, fontWeight: T.weight.bold, color: '#fff', cursor: 'pointer' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
