import { useState } from 'react'
import { C, type Page } from '../data'
import { Card, Tag, Bar } from '../primitives'

interface Props { connected: string[]; setPage: (p: Page) => void }

type Status = 'lendo' | 'quero' | 'pausado' | 'concluido'

interface Book {
  id: string
  title: string
  author: string
  category: string
  pages: number
  pagesRead: number
  status: Status
  rating: number   // 0-5
}

const STATUS_LABEL: Record<Status, string> = { lendo: '📖 Lendo', quero: '🔖 Quero ler', pausado: '⏸ Pausado', concluido: '✅ Concluído' }
const STATUS_COLOR: Record<Status, string> = { lendo: '#60A5FA', quero: '#A78BFA', pausado: '#F97316', concluido: '#22C55E' }

const DEFAULTS: Book[] = [
  { id: '1', title: 'Atomic Habits', author: 'James Clear', category: 'Produtividade', pages: 320, pagesRead: 320, status: 'concluido', rating: 5 },
  { id: '2', title: 'Endure', author: 'Alex Hutchinson', category: 'Esporte', pages: 368, pagesRead: 120, status: 'lendo', rating: 0 },
  { id: '3', title: 'Deep Work', author: 'Cal Newport', category: 'Produtividade', pages: 304, pagesRead: 0, status: 'quero', rating: 0 },
]

function load(): Book[] {
  try { const r = localStorage.getItem('books'); return r ? JSON.parse(r) : DEFAULTS } catch { return DEFAULTS }
}
function save(b: Book[]) { localStorage.setItem('books', JSON.stringify(b)) }

const EMPTY: Omit<Book, 'id'> = { title: '', author: '', category: '', pages: 0, pagesRead: 0, status: 'quero', rating: 0 }

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#0C0C0C', border: `1px solid ${C.border2}`, borderRadius: 8,
  padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none', width: '100%', ...extra,
})

export function Biblioteca({ connected: _c, setPage: _s }: Props) {
  const [books, setBooks] = useState<Book[]>(load)
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState<Omit<Book, 'id'>>({ ...EMPTY })
  const [filter, setFilter] = useState<Status | 'todos'>('todos')

  const upsert = (fn: (b: Book[]) => Book[]) =>
    setBooks(prev => { const next = fn(prev); save(next); return next })

  const add = () => {
    if (!form.title.trim()) return
    upsert(b => [...b, { ...form, id: Math.random().toString(36).slice(2) }])
    setForm({ ...EMPTY }); setModal(false)
  }
  const remove = (id: string) => upsert(b => b.filter(x => x.id !== id))
  const updatePages = (id: string, v: number) =>
    upsert(b => b.map(x => x.id === id ? { ...x, pagesRead: Math.min(v, x.pages), status: v >= x.pages && x.pages > 0 ? 'concluido' : x.status } : x))
  const setRating = (id: string, r: number) =>
    upsert(b => b.map(x => x.id === id ? { ...x, rating: r } : x))

  const visible  = filter === 'todos' ? books : books.filter(b => b.status === filter)
  const reading  = books.filter(b => b.status === 'lendo').length
  const done     = books.filter(b => b.status === 'concluido').length

  return (
    <>
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, maxWidth: 440, width: '100%', position: 'relative' }}>
            <button onClick={() => setModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 18 }}>📚 Adicionar Livro</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input style={inp()} placeholder="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <input style={inp()} placeholder="Autor" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              <input style={inp()} placeholder="Categoria (ex: Esporte, Ficção...)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Total de páginas</div>
                  <input type="number" style={inp()} placeholder="0" value={form.pages || ''} onChange={e => setForm(f => ({ ...f, pages: +e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Status</div>
                  <select style={inp()} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                    <option value="quero">🔖 Quero ler</option>
                    <option value="lendo">📖 Lendo</option>
                    <option value="pausado">⏸ Pausado</option>
                    <option value="concluido">✅ Concluído</option>
                  </select>
                </div>
              </div>
              <button onClick={add} disabled={!form.title.trim()} style={{ background: form.title.trim() ? C.purple : C.card2, border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, color: form.title.trim() ? '#fff' : C.muted, cursor: form.title.trim() ? 'pointer' : 'default', marginTop: 4 }}>
                Adicionar →
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📚 Biblioteca</div>
            <div style={{ fontSize: 13, color: C.muted }}>{reading} lendo · {done} concluídos · {books.length} total</div>
          </div>
          <button onClick={() => setModal(true)} style={{ background: C.purple, border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            + Adicionar Livro
          </button>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {(['todos', 'lendo', 'quero', 'pausado', 'concluido'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ background: filter === s ? C.purple : C.card2, border: `1px solid ${filter === s ? C.purple : C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: filter === s ? '#fff' : C.muted, cursor: 'pointer' }}>
              {s === 'todos' ? `Todos (${books.length})` : `${STATUS_LABEL[s]} (${books.filter(b => b.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Books grid */}
        {visible.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum livro aqui</div>
            <div style={{ fontSize: 13 }}>Adicione livros para acompanhar sua leitura</div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {visible.map(b => {
              const pct = b.pages > 0 ? Math.round(b.pagesRead / b.pages * 100) : 0
              return (
                <Card key={b.id} style={{ borderLeft: `3px solid ${STATUS_COLOR[b.status]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{b.title}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{b.author}</div>
                    </div>
                    <button onClick={() => remove(b.id)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>🗑</button>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    <Tag label={STATUS_LABEL[b.status]} color={STATUS_COLOR[b.status]} />
                    {b.category && <Tag label={b.category} color={C.muted} />}
                  </div>

                  {b.pages > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 5 }}>
                        <span>Progresso</span>
                        <span style={{ color: STATUS_COLOR[b.status], fontWeight: 700 }}>{b.pagesRead}/{b.pages} páginas</span>
                      </div>
                      <Bar pct={pct} color={STATUS_COLOR[b.status]} h={5} />
                      {b.status === 'lendo' && (
                        <input
                          type="range" min={0} max={b.pages} value={b.pagesRead}
                          onChange={e => updatePages(b.id, +e.target.value)}
                          style={{ width: '100%', marginTop: 8, accentColor: STATUS_COLOR[b.status] }}
                        />
                      )}
                    </>
                  )}

                  {b.status === 'concluido' && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <span key={s} onClick={() => setRating(b.id, s)} style={{ cursor: 'pointer', fontSize: 16, opacity: b.rating >= s ? 1 : 0.3 }}>⭐</span>
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
