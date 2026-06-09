import { useState } from 'react'
import { C } from '../data'
import { useHabitsStore } from '../../store/useHabitsStore'
import { toast } from '../../lib/toast'

const EMOJI_OPTIONS = [
  '💧','🏋','📚','🧘','😴','🥩','🚶','🏃','🚫','🧠','💪','🍎',
  '☕','🎯','✍️','🎵','🌞','🌙','🥤','🧃','🏊','🚴','⚽','🎾',
  '🧹','💊','🌿','🫁','❤️','🔥','⚡','🎖️','📝','🧘‍♂️','🛌',
]

interface Props { onClose: () => void }

export function HabitosModal({ onClose }: Props) {
  const { defs, addDef, removeDef, updateDef } = useHabitsStore()

  const [adding, setAdding]     = useState(false)
  const [newIcon, setNewIcon]   = useState('🎯')
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing]   = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const inp: React.CSSProperties = {
    background: C.card2, border: `1px solid ${C.border2}`,
    borderRadius: 8, padding: '9px 12px', color: C.text,
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  function submitAdd() {
    if (!newLabel.trim()) return
    addDef({ icon: newIcon, label: newLabel.trim() })
    toast.success(`${newIcon} Hábito "${newLabel.trim()}" criado!`)
    setNewLabel(''); setNewIcon('🎯'); setAdding(false)
  }

  function submitEdit(id: string) {
    if (!editLabel.trim()) return
    updateDef(id, { label: editLabel.trim() })
    toast.success('✏️ Hábito atualizado!')
    setEditing(null)
  }

  function handleRemove(id: string) {
    const d = defs.find(x => x.id === id)
    removeDef(id)
    if (d) toast.info(`🗑 "${d.label}" removido`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>✅ Gerenciar Hábitos</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{defs.length} hábitos configurados</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Habit list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          {defs.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.card2, borderRadius: 10, marginBottom: 8, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{d.icon}</span>

              {editing === d.id ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitEdit(d.id); if (e.key === 'Escape') setEditing(null) }}
                  style={{ ...inp, flex: 1 }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{d.label}</span>
              )}

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {editing === d.id ? (
                  <>
                    <button onClick={() => submitEdit(d.id)} style={{ background: C.green, border: 'none', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Salvar</button>
                    <button onClick={() => setEditing(null)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditing(d.id); setEditLabel(d.label) }} style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: 6, padding: '5px 8px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>✏️</button>
                    {defs.length > 1 && (
                      <button onClick={() => handleRemove(d.id)} style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: 6, padding: '5px 8px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Add form */}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              disabled={defs.length >= 12}
              style={{ width: '100%', background: 'transparent', border: `1px dashed ${C.border2}`, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, color: defs.length >= 12 ? C.muted : C.green, cursor: defs.length >= 12 ? 'default' : 'pointer', marginTop: 4 }}
            >
              {defs.length >= 12 ? 'Máximo de 12 hábitos atingido' : '+ Adicionar hábito'}
            </button>
          ) : (
            <div style={{ background: C.card2, borderRadius: 12, padding: 16, border: `1px solid ${C.border2}`, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 12 }}>Novo hábito</div>

              {/* Emoji picker */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Escolha um ícone</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => setNewIcon(e)}
                      style={{
                        fontSize: 18, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', border: 'none',
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

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitAdd} disabled={!newLabel.trim()} style={{ flex: 1, background: newLabel.trim() ? C.green : C.card2, border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, color: newLabel.trim() ? '#fff' : C.muted, cursor: newLabel.trim() ? 'pointer' : 'default' }}>Criar</button>
                <button onClick={() => { setAdding(false); setNewLabel(''); setNewIcon('🎯') }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, color: C.muted, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', background: C.orange, border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
