import { useState, useEffect, useContext } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { Target } from 'lucide-react'
import { Card, Tag, Bar } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { getProjects, saveProjects, type Project } from '../../lib/db'
import { toast } from '../../lib/toast'
import { userStorage } from '../../lib/userStorage'
import { LayoutContext } from '../LayoutContext'

interface Props { setPage: (p: Page) => void }

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

const EMPTY: Omit<Project, 'id'> = { name: '', description: '', category: 'pessoal', progress: 0, priority: 'media', dueDate: '' }

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#0C0C0C', border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
  padding: '8px 10px', color: C.text, fontSize: T.text.md, outline: 'none', width: '100%', ...extra,
})

function loadLocal(): Project[] {
  try { const r = userStorage.getItem('projects'); return r ? JSON.parse(r) : DEFAULTS } catch { return DEFAULTS }
}

export function Projetos({ setPage: _s }: Props) {
  const user = useAuthStore(s => s.user)
  const { isMobile } = useContext(LayoutContext)

  const [projects, setProjects] = useState<Project[]>([])
  const [loaded,   setLoaded]   = useState(false)
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState<Omit<Project, 'id'>>({ ...EMPTY })
  const [filter,   setFilter]   = useState<string>('todos')

  useEffect(() => {
    async function load() {
      if (user) {
        const cloud = await getProjects()
        if (cloud !== null) { setProjects(cloud); setLoaded(true); return }
      }
      const local = loadLocal()
      setProjects(local)
      setLoaded(true)
    }
    load()
  }, [user])

  const persist = (next: Project[]) => {
    userStorage.setItem('projects', JSON.stringify(next))
    saveProjects(next)
    setProjects(next)
  }

  const addProject = () => {
    if (!form.name.trim()) return
    const next = [...projects, { ...form, id: Math.random().toString(36).slice(2) }]
    persist(next)
    setForm({ ...EMPTY })
    setModal(false)
    toast.success(`🎯 Projeto "${form.name}" criado!`)
  }

  const remove = (id: string) => {
    const p = projects.find(x => x.id === id)
    persist(projects.filter(x => x.id !== id))
    if (p) toast.info(`🗑 Projeto "${p.name}" removido`)
  }

  const setProgress = (id: string, v: number) => {
    const next = projects.map(x => x.id === id ? { ...x, progress: v } : x)
    persist(next)
    if (v === 100) toast.success('🏆 Projeto concluído!')
  }

  const visible = filter === 'todos' ? projects : projects.filter(p => p.category === filter)
  const done    = projects.filter(p => p.progress >= 100).length

  if (!loaded) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: T.text.lg }}>Carregando...</div>
  }

  return (
    <>
      {modal && (
        <div className="rise-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="rise-modal" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius['4xl'], padding: 'clamp(20px, 6vw, 32px)', maxWidth: 460, width: '100%', position: 'relative' }}>
            <button onClick={() => setModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: T.text['5xl'], cursor: 'pointer' }}>×</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.extrabold, fontSize: 17, marginBottom: 20, ...displayStyle }}><Target size={20} color={C.orange} /> Novo Projeto</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 4 }}>Nome *</div>
                <input style={inp()} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do projeto" />
              </div>
              <div>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 4 }}>Descrição</div>
                <input style={inp()} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva brevemente..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 4 }}>Categoria</div>
                  <select style={inp()} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Project['category'] }))}>
                    <option value="saude">🏃 Saúde</option>
                    <option value="trabalho">💼 Trabalho</option>
                    <option value="pessoal">⭐ Pessoal</option>
                    <option value="aprendizado">📚 Aprendizado</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 4 }}>Prioridade</div>
                  <select style={inp()} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Project['priority'] }))}>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Média</option>
                    <option value="baixa">🔵 Baixa</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 4 }}>Progresso inicial (%)</div>
                <input type="number" min={0} max={100} style={inp()} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: Math.min(100, Math.max(0, +e.target.value)) }))} />
              </div>
              <button
                onClick={addProject}
                disabled={!form.name.trim()}
                style={{ marginTop: 4, background: form.name.trim() ? C.orange : C.card2, border: 'none', borderRadius: T.radius.md, padding: '12px', fontSize: T.text.lg, fontWeight: T.weight.bold, color: form.name.trim() ? '#fff' : C.muted, cursor: form.name.trim() ? 'pointer' : 'default' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 22 : 26, fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><Target size={20} color={C.orange} /> Projetos</div>
            <div style={{ fontSize: T.text.md, color: C.muted }}>{done}/{projects.length} concluídos</div>
          </div>
          <button onClick={() => setModal(true)} style={{ background: C.orange, border: 'none', borderRadius: T.radius.md, padding: '10px 18px', fontSize: T.text.md, fontWeight: T.weight.bold, color: '#fff', cursor: 'pointer' }}>
            + Novo Projeto
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {['todos', 'saude', 'trabalho', 'pessoal', 'aprendizado'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? C.orange : C.card2, border: `1px solid ${filter === f ? C.orange : C.border}`, borderRadius: T.radius.sm, padding: '6px 12px', fontSize: T.text.base, fontWeight: T.weight.semibold, color: filter === f ? '#fff' : C.muted, cursor: 'pointer' }}>
              {f === 'todos' ? 'Todos' : CAT_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Project cards */}
        {visible.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontWeight: T.weight.semibold, marginBottom: 6 }}>Nenhum projeto ainda</div>
            <div style={{ fontSize: T.text.md }}>Clique em "+ Novo Projeto" para começar</div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
            {visible.map(p => (
              <Card key={p.id} style={{ borderTop: `2px solid ${CAT_COLOR[p.category]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.5 }}>{p.description}</div>}
                  </div>
                  <button onClick={() => remove(p.id)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text['2xl'], padding: '0 2px', flexShrink: 0 }}>🗑</button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  <Tag label={CAT_LABEL[p.category]} color={CAT_COLOR[p.category]} />
                  <Tag label={p.priority === 'alta' ? '🔴 Alta' : p.priority === 'media' ? '🟡 Média' : '🔵 Baixa'} color={PRI_COLOR[p.priority]} />
                  {p.progress >= 100 && <Tag label="✓ Concluído" color={C.green} />}
                </div>

                <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: T.text.sm, color: C.muted }}>Progresso</span>
                  <span style={{ fontSize: T.text.md, fontWeight: T.weight.extrabold, color: p.progress >= 100 ? C.green : CAT_COLOR[p.category] }}>{p.progress}%</span>
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
