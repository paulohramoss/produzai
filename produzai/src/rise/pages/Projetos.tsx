import { useState } from 'react'
import { C, type Page } from '../data'
import { Card, Tag, Bar } from '../primitives'

interface Props { connected: string[]; setPage: (p: Page) => void }

interface Project {
  id: string
  name: string
  description: string
  category: 'saude' | 'trabalho' | 'pessoal' | 'aprendizado'
  progress: number
  priority: 'alta' | 'media' | 'baixa'
  dueDate: string
}

const CAT_COLOR: Record<string, string> = {
  saude: '#22C55E', trabalho: '#60A5FA', pessoal: '#F472B6', aprendizado: '#A78BFA',
}
const CAT_LABEL: Record<string, string> = {
  saude: '🏃 Saúde', trabalho: '💼 Trabalho', pessoal: '⭐ Pessoal', aprendizado: '📚 Aprendizado',
}
const PRI_COLOR: Record<string, string> = { alta: '#EF4444', media: '#F97316', baixa: '#60A5FA' }

const DEFAULTS: Project[] = [
  { id: '1', name: 'Correr 5km sem parar', description: 'Aumentar resistência cardio progressivamente', category: 'saude', progress: 60, priority: 'alta', dueDate: '' },
  { id: '2', name: 'Ler 12 livros no ano', description: '1 livro por mês de não-ficção', category: 'aprendizado', progress: 33, priority: 'media', dueDate: '' },
  { id: '3', name: 'Lançar projeto pessoal', description: 'Construir e publicar um produto digital', category: 'trabalho', progress: 15, priority: 'alta', dueDate: '' },
]

function load(): Project[] {
  try { const r = localStorage.getItem('projects'); return r ? JSON.parse(r) : DEFAULTS } catch { return DEFAULTS }
}
function save(p: Project[]) { localStorage.setItem('projects', JSON.stringify(p)) }

const EMPTY: Omit<Project, 'id'> = { name: '', description: '', category: 'pessoal', progress: 0, priority: 'media', dueDate: '' }

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#0C0C0C', border: `1px solid ${C.border2}`, borderRadius: 8,
  padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none', width: '100%', ...extra,
})

export function Projetos({ connected: _c, setPage: _s }: Props) {
  const [projects, setProjects] = useState<Project[]>(load)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState<Omit<Project, 'id'>>({ ...EMPTY })
  const [filter, setFilter]     = useState<string>('todos')

  const upsert = (fn: (p: Project[]) => Project[]) => {
    setProjects(prev => { const next = fn(prev); save(next); return next })
  }

  const addProject = () => {
    if (!form.name.trim()) return
    upsert(p => [...p, { ...form, id: Math.random().toString(36).slice(2) }])
    setForm({ ...EMPTY })
    setModal(false)
  }

  const remove = (id: string) => upsert(p => p.filter(x => x.id !== id))
  const setProgress = (id: string, v: number) =>
    upsert(p => p.map(x => x.id === id ? { ...x, progress: v } : x))

  const visible = filter === 'todos' ? projects : projects.filter(p => p.category === filter)
  const done    = projects.filter(p => p.progress >= 100).length

  return (
    <>
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, maxWidth: 460, width: '100%', position: 'relative' }}>
            <button onClick={() => setModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 20 }}>🎯 Novo Projeto</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Nome *</div>
                <input style={inp()} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do projeto" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Descrição</div>
                <input style={inp()} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva brevemente..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Categoria</div>
                  <select style={inp()} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Project['category'] }))}>
                    <option value="saude">🏃 Saúde</option>
                    <option value="trabalho">💼 Trabalho</option>
                    <option value="pessoal">⭐ Pessoal</option>
                    <option value="aprendizado">📚 Aprendizado</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Prioridade</div>
                  <select style={inp()} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Project['priority'] }))}>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Média</option>
                    <option value="baixa">🔵 Baixa</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Progresso inicial (%)</div>
                <input type="number" min={0} max={100} style={inp()} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: Math.min(100, Math.max(0, +e.target.value)) }))} />
              </div>
              <button
                onClick={addProject}
                disabled={!form.name.trim()}
                style={{ marginTop: 4, background: form.name.trim() ? C.orange : C.card2, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: form.name.trim() ? '#fff' : C.muted, cursor: form.name.trim() ? 'pointer' : 'default' }}>
                Criar Projeto →
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🎯 Projetos</div>
            <div style={{ fontSize: 13, color: C.muted }}>{done}/{projects.length} concluídos</div>
          </div>
          <button onClick={() => setModal(true)} style={{ background: C.orange, border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            + Novo Projeto
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {['todos', 'saude', 'trabalho', 'pessoal', 'aprendizado'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? C.orange : C.card2, border: `1px solid ${filter === f ? C.orange : C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: filter === f ? '#fff' : C.muted, cursor: 'pointer' }}>
              {f === 'todos' ? 'Todos' : CAT_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Project cards */}
        {visible.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum projeto ainda</div>
            <div style={{ fontSize: 13 }}>Clique em "+ Novo Projeto" para começar</div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {visible.map(p => (
              <Card key={p.id} style={{ borderTop: `2px solid ${CAT_COLOR[p.category]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{p.description}</div>}
                  </div>
                  <button onClick={() => remove(p.id)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, padding: '0 2px', flexShrink: 0 }}>🗑</button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  <Tag label={CAT_LABEL[p.category]} color={CAT_COLOR[p.category]} />
                  <Tag label={p.priority === 'alta' ? '🔴 Alta' : p.priority === 'media' ? '🟡 Média' : '🔵 Baixa'} color={PRI_COLOR[p.priority]} />
                  {p.progress >= 100 && <Tag label="✓ Concluído" color={C.green} />}
                </div>

                <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.muted }}>Progresso</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: p.progress >= 100 ? C.green : CAT_COLOR[p.category] }}>{p.progress}%</span>
                </div>
                <Bar pct={p.progress} color={p.progress >= 100 ? C.green : CAT_COLOR[p.category]} h={6} />

                <input
                  type="range" min={0} max={100} value={p.progress}
                  onChange={e => setProgress(p.id, +e.target.value)}
                  style={{ width: '100%', marginTop: 10, accentColor: CAT_COLOR[p.category] }}
                />
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
