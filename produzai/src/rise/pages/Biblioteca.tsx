import { useState, useEffect, useContext } from 'react'
import { C, type Page } from '../data'
import { useDialog } from '../useDialog'
import { BookOpen } from 'lucide-react'
import { Card, Tag, Bar } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { getBooks, saveBooks, type Book } from '../../lib/db'
import { toast } from '../../lib/toast'
import { userStorage } from '../../lib/userStorage'
import { LayoutContext } from '../LayoutContext'

interface Props { setPage: (p: Page) => void }

type Status = 'lendo' | 'quero' | 'pausado' | 'concluido'

const STATUS_LABEL: Record<Status, string> = { lendo: '📖 Lendo', quero: '🔖 Quero ler', pausado: '⏸ Pausado', concluido: '✅ Concluído' }
const STATUS_COLOR: Record<Status, string> = { lendo: '#60A5FA', quero: '#A78BFA', pausado: '#F97316', concluido: '#22C55E' }

const DEFAULTS: Book[] = [
  { id: '1', title: 'Atomic Habits', author: 'James Clear', category: 'Produtividade', pages: 320, pagesRead: 320, status: 'concluido', rating: 5 },
  { id: '2', title: 'Endure', author: 'Alex Hutchinson', category: 'Esporte', pages: 368, pagesRead: 120, status: 'lendo', rating: 0 },
  { id: '3', title: 'Deep Work', author: 'Cal Newport', category: 'Produtividade', pages: 304, pagesRead: 0, status: 'quero', rating: 0 },
]

const EMPTY: Omit<Book, 'id'> = { title: '', author: '', category: '', pages: 0, pagesRead: 0, status: 'quero', rating: 0 }

// Tela migrada para classes do Tailwind — mesma regra da Projetos: o fixo vira
// classe, o que depende de dado (a cor do status, as colunas no celular) segue
// em `style`. Os tokens são os mesmos de data.ts, espelhados no
// tailwind.config.js.
const INPUT = 'w-full rounded-sm border border-surface-border2 bg-surface px-2.5 py-2 text-md text-fg outline-none'
const FIELD_LABEL = 'text-sm text-fg-muted mb-1'

function loadLocal(): Book[] {
  try { const r = userStorage.getItem('books'); return r ? JSON.parse(r) : DEFAULTS } catch { return DEFAULTS }
}

export function Biblioteca({ setPage: _s }: Props) {
  const user = useAuthStore(s => s.user)
  const { isMobile } = useContext(LayoutContext)

  const [books,  setBooks]  = useState<Book[]>([])
  const [loaded, setLoaded] = useState(false)
  const [modal,  setModal]  = useState(false)
  const dialogRef = useDialog(modal, () => setModal(false))
  const [form,   setForm]   = useState<Omit<Book, 'id'>>({ ...EMPTY })
  const [filter, setFilter] = useState<Status | 'todos'>('todos')

  useEffect(() => {
    async function load() {
      if (user) {
        const cloud = await getBooks()
        if (cloud !== null) { setBooks(cloud); setLoaded(true); return }
      }
      setBooks(loadLocal())
      setLoaded(true)
    }
    load()
  }, [user])

  const persist = (next: Book[]) => {
    userStorage.setItem('books', JSON.stringify(next))
    saveBooks(next)
    setBooks(next)
  }

  const add = () => {
    if (!form.title.trim()) return
    const next = [...books, { ...form, id: Math.random().toString(36).slice(2) }]
    persist(next)
    setForm({ ...EMPTY })
    setModal(false)
    toast.success(`📚 "${form.title}" adicionado à biblioteca!`)
  }

  const remove = (id: string) => {
    const b = books.find(x => x.id === id)
    persist(books.filter(x => x.id !== id))
    if (b) toast.info(`🗑 "${b.title}" removido`)
  }

  const updatePages = (id: string, v: number) => {
    const next = books.map(x => {
      if (x.id !== id) return x
      const pagesRead = Math.min(v, x.pages)
      const status = pagesRead >= x.pages && x.pages > 0 ? 'concluido' : x.status
      if (status === 'concluido' && x.status !== 'concluido') {
        toast.success(`🎉 "${x.title}" concluído! Ótima leitura!`)
      }
      return { ...x, pagesRead, status }
    })
    persist(next)
  }

  const setRating = (id: string, r: number) => {
    const next = books.map(x => x.id === id ? { ...x, rating: r } : x)
    persist(next)
    const b = next.find(x => x.id === id)
    if (b) toast.success(`⭐ ${r} estrelas para "${b.title}"`)
  }

  const visible = filter === 'todos' ? books : books.filter(b => b.status === filter)
  const reading = books.filter(b => b.status === 'lendo').length
  const done    = books.filter(b => b.status === 'concluido').length
  const titleOk = !!form.title.trim()

  if (!loaded) {
    return <div className="flex h-[200px] items-center justify-center text-lg text-fg-muted">Carregando...</div>
  }

  return (
    <>
      {modal && (
        <div className="rise-overlay fixed inset-0 z-[300] flex items-center justify-center bg-black/85">
          <div
            className="rise-modal relative w-full max-w-[440px] rounded-4xl border border-surface-border bg-surface-card p-[clamp(20px,6vw,28px)]"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar livro"
            tabIndex={-1}
          >
            <button
              onClick={() => setModal(false)}
              aria-label="Fechar"
              className="absolute right-4 top-[14px] cursor-pointer border-none bg-transparent text-5xl text-fg-muted"
            >
              ×
            </button>
            <div className="mb-[18px] flex items-center gap-2 font-display text-[17px] font-bold">
              <BookOpen size={20} color={C.orange} /> Adicionar Livro
            </div>
            <div className="flex flex-col gap-2.5">
              <input className={INPUT} placeholder="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <input className={INPUT} placeholder="Autor" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              <input className={INPUT} placeholder="Categoria (ex: Esporte, Ficção...)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className={FIELD_LABEL}>Total de páginas</div>
                  <input type="number" className={INPUT} placeholder="0" value={form.pages || ''} onChange={e => setForm(f => ({ ...f, pages: +e.target.value }))} />
                </div>
                <div>
                  <div className={FIELD_LABEL}>Status</div>
                  <select className={INPUT} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                    <option value="quero">🔖 Quero ler</option>
                    <option value="lendo">📖 Lendo</option>
                    <option value="pausado">⏸ Pausado</option>
                    <option value="concluido">✅ Concluído</option>
                  </select>
                </div>
              </div>
              <button
                onClick={add}
                disabled={!titleOk}
                className={`mt-1 rounded-md border-none p-[11px] text-lg font-bold ${
                  titleOk ? 'cursor-pointer bg-accent text-white' : 'cursor-default bg-surface-raised text-fg-muted'
                }`}
              >
                Adicionar →
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
              <BookOpen size={20} color={C.orange} /> Biblioteca
            </div>
            <div className="text-md text-fg-muted">{reading} lendo · {done} concluídos · {books.length} total</div>
          </div>
          <button
            onClick={() => setModal(true)}
            className="cursor-pointer rounded-md border-none bg-accent px-[18px] py-2.5 text-md font-bold text-white"
          >
            + Adicionar Livro
          </button>
        </div>

        {/* Status filter */}
        <div className="mb-[18px] flex flex-wrap gap-2">
          {(['todos', 'lendo', 'quero', 'pausado', 'concluido'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`cursor-pointer rounded-sm border px-3 py-1.5 text-base font-semibold ${
                filter === s
                  ? 'border-accent bg-accent text-white'
                  : 'border-surface-border bg-surface-raised text-fg-muted'
              }`}
            >
              {s === 'todos' ? `Todos (${books.length})` : `${STATUS_LABEL[s]} (${books.filter(b => b.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Books grid */}
        {visible.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
            <div className="mb-3 text-[40px]">📚</div>
            <div className="mb-1.5 font-semibold">Nenhum livro aqui</div>
            <div className="text-md">Adicione livros para acompanhar sua leitura</div>
          </Card>
        ) : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            {visible.map(b => {
              const pct = b.pages > 0 ? Math.round(b.pagesRead / b.pages * 100) : 0
              return (
                <Card key={b.id} style={{ borderLeft: `3px solid ${STATUS_COLOR[b.status]}` }}>
                  <div className="mb-2 flex items-start justify-between">
                    <div className="mr-2 flex-1">
                      <div className="mb-0.5 text-xl font-bold">{b.title}</div>
                      <div className="text-base text-fg-muted">{b.author}</div>
                    </div>
                    <button
                      onClick={() => remove(b.id)}
                      aria-label={`Remover ${b.title}`}
                      className="shrink-0 cursor-pointer border-none bg-transparent px-0.5 py-0 text-lg text-fg-muted"
                    >
                      🗑
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <Tag label={STATUS_LABEL[b.status]} color={STATUS_COLOR[b.status]} />
                    {b.category && <Tag label={b.category} color={C.muted} />}
                  </div>

                  {b.pages > 0 && (
                    <>
                      <div className="mb-[5px] flex justify-between text-sm text-fg-muted">
                        <span>Progresso</span>
                        <span className="font-bold" style={{ color: STATUS_COLOR[b.status] }}>
                          {b.pagesRead}/{b.pages} páginas
                        </span>
                      </div>
                      <Bar pct={pct} color={STATUS_COLOR[b.status]} h={5} />
                      {b.status === 'lendo' && (
                        <input
                          type="range" min={0} max={b.pages} value={b.pagesRead}
                          aria-label={`Páginas lidas de ${b.title}`}
                          onChange={e => updatePages(b.id, +e.target.value)}
                          className="mt-2 w-full"
                          style={{ accentColor: STATUS_COLOR[b.status] }}
                        />
                      )}
                    </>
                  )}

                  {b.status === 'concluido' && (
                    <div className="mt-2.5 flex gap-1">
                      {/* Botão, não `span` com onClick: a nota era inalcançável
                          por teclado e invisível para leitor de tela. */}
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          onClick={() => setRating(b.id, s)}
                          aria-label={`Dar ${s} ${s === 1 ? 'estrela' : 'estrelas'} para ${b.title}`}
                          aria-pressed={b.rating >= s}
                          className="cursor-pointer border-none bg-transparent p-0 text-2xl leading-none"
                          style={{ opacity: b.rating >= s ? 1 : 0.3 }}
                        >
                          ⭐
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
