import { useState, useEffect, useContext } from 'react'
import { C, type Page } from '../data'
import { useDialog } from '../useDialog'
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

// Esta tela usa CLASSES do Tailwind no lugar dos objetos de estilo inline.
//
// A regra do corte: o que é fixo vira classe; o que depende de dado ou de estado
// (a cor da categoria, o número de colunas no celular) continua em `style`,
// porque é valor calculado em tempo de execução e nenhuma classe expressa isso
// sem gerar uma para cada possibilidade.
//
// Os nomes saem do tailwind.config.js, que espelha os mesmos tokens de data.ts:
// `text-md` é o mesmo 13px de `T.text.md`, `bg-surface-card` o mesmo #141414 de
// `C.card`. A migração troca a fonte da verdade, não os pixels.
const INPUT = 'w-full rounded-sm border border-surface-border2 bg-surface px-2.5 py-2 text-md text-fg outline-none'
const FIELD_LABEL = 'text-sm text-fg-muted mb-1'

function loadLocal(): Project[] {
  try { const r = userStorage.getItem('projects'); return r ? JSON.parse(r) : DEFAULTS } catch { return DEFAULTS }
}

export function Projetos({ setPage: _s }: Props) {
  const user = useAuthStore(s => s.user)
  const { isMobile } = useContext(LayoutContext)

  const [projects, setProjects] = useState<Project[]>([])
  const [loaded,   setLoaded]   = useState(false)
  const [modal,    setModal]    = useState(false)
  const dialogRef = useDialog(modal, () => setModal(false))
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
  const nameOk  = !!form.name.trim()

  if (!loaded) {
    return <div className="flex h-[200px] items-center justify-center text-lg text-fg-muted">Carregando...</div>
  }

  return (
    <>
      {modal && (
        <div className="rise-overlay fixed inset-0 z-[300] flex items-center justify-center bg-black/85">
          <div
            className="rise-modal relative w-full max-w-[460px] rounded-4xl border border-surface-border bg-surface-card p-[clamp(20px,6vw,32px)]"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Novo projeto"
            tabIndex={-1}
          >
            <button
              onClick={() => setModal(false)}
              aria-label="Fechar"
              className="absolute right-4 top-[14px] cursor-pointer border-none bg-transparent text-5xl text-fg-muted"
            >
              ×
            </button>
            <div className="mb-5 flex items-center gap-2 font-display text-[17px] font-bold">
              <Target size={20} color={C.orange} /> Novo Projeto
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className={FIELD_LABEL}>Nome *</div>
                <input className={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do projeto" />
              </div>
              <div>
                <div className={FIELD_LABEL}>Descrição</div>
                <input className={INPUT} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva brevemente..." />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className={FIELD_LABEL}>Categoria</div>
                  <select className={INPUT} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Project['category'] }))}>
                    <option value="saude">🏃 Saúde</option>
                    <option value="trabalho">💼 Trabalho</option>
                    <option value="pessoal">⭐ Pessoal</option>
                    <option value="aprendizado">📚 Aprendizado</option>
                  </select>
                </div>
                <div>
                  <div className={FIELD_LABEL}>Prioridade</div>
                  <select className={INPUT} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Project['priority'] }))}>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Média</option>
                    <option value="baixa">🔵 Baixa</option>
                  </select>
                </div>
              </div>
              <div>
                <div className={FIELD_LABEL}>Progresso inicial (%)</div>
                <input type="number" min={0} max={100} className={INPUT} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: Math.min(100, Math.max(0, +e.target.value)) }))} />
              </div>
              <button
                onClick={addProject}
                disabled={!nameOk}
                className={`mt-1 rounded-md border-none p-3 text-lg font-bold ${
                  nameOk ? 'cursor-pointer bg-brand-500 text-white' : 'cursor-default bg-surface-raised text-fg-muted'
                }`}
              >
                Criar Projeto →
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div
              className="mb-1 flex items-center gap-2 font-display font-bold"
              style={{ fontSize: isMobile ? 22 : 26 }}
            >
              <Target size={20} color={C.orange} /> Projetos
            </div>
            <div className="text-md text-fg-muted">{done}/{projects.length} concluídos</div>
          </div>
          <button
            onClick={() => setModal(true)}
            className="cursor-pointer rounded-md border-none bg-brand-500 px-[18px] py-2.5 text-md font-bold text-white"
          >
            + Novo Projeto
          </button>
        </div>

        {/* Filter tabs */}
        <div className="mb-[18px] flex flex-wrap gap-2">
          {['todos', 'saude', 'trabalho', 'pessoal', 'aprendizado'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`cursor-pointer rounded-sm border px-3 py-1.5 text-base font-semibold ${
                filter === f
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-surface-border bg-surface-raised text-fg-muted'
              }`}
            >
              {f === 'todos' ? 'Todos' : CAT_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Project cards */}
        {visible.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div className="mb-3 text-[40px]">🎯</div>
            <div className="mb-1.5 font-semibold">Nenhum projeto ainda</div>
            <div className="text-md">Clique em "+ Novo Projeto" para começar</div>
          </Card>
        ) : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            {visible.map(p => (
              <Card key={p.id} style={{ borderTop: `2px solid ${CAT_COLOR[p.category]}` }}>
                <div className="mb-2.5 flex items-start justify-between">
                  <div className="mr-2 flex-1">
                    <div className="mb-1 text-xl font-bold">{p.name}</div>
                    {p.description && <div className="text-base leading-[1.5] text-fg-muted">{p.description}</div>}
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    aria-label={`Remover ${p.name}`}
                    className="shrink-0 cursor-pointer border-none bg-transparent px-0.5 py-0 text-2xl text-fg-muted"
                  >
                    🗑
                  </button>
                </div>

                <div className="mb-3.5 flex flex-wrap gap-1.5">
                  <Tag label={CAT_LABEL[p.category]} color={CAT_COLOR[p.category]} />
                  <Tag label={p.priority === 'alta' ? '🔴 Alta' : p.priority === 'media' ? '🟡 Média' : '🔵 Baixa'} color={PRI_COLOR[p.priority]} />
                  {p.progress >= 100 && <Tag label="✓ Concluído" color={C.green} />}
                </div>

                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm text-fg-muted">Progresso</span>
                  <span
                    className="text-md font-extrabold"
                    style={{ color: p.progress >= 100 ? C.green : CAT_COLOR[p.category] }}
                  >
                    {p.progress}%
                  </span>
                </div>
                <Bar pct={p.progress} color={p.progress >= 100 ? C.green : CAT_COLOR[p.category]} h={6} />

                <input
                  type="range" min={0} max={100} value={p.progress}
                  aria-label={`Progresso de ${p.name}`}
                  onChange={e => setProgress(p.id, +e.target.value)}
                  className="mt-2.5 w-full"
                  style={{ accentColor: CAT_COLOR[p.category] }}
                />
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
