import { useState, useEffect, useRef, useContext } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../lib/firebase'
import { getProgressPhotos, saveProgressPhotos, type ProgressPhoto } from '../../lib/db'
import { useAuthStore } from '../../store/useAuthStore'
import { toast } from '../../lib/toast'
import { T, C, type Page, displayStyle } from '../data'
import { Camera } from 'lucide-react'
import { Card } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { todayKey } from '../../lib/date'

interface Props { setPage: (p: Page) => void }

export function Galeria({ setPage: _setPage }: Props) {
  const user = useAuthStore(s => s.user)
  const { isMobile } = useContext(LayoutContext)
  const fileRef = useRef<HTMLInputElement>(null)

  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<ProgressPhoto | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pending, setPending] = useState<File | null>(null)
  const [form, setForm] = useState({ weight: '', caption: '' })
  const [compareMode, setCompareMode] = useState(false)
  const [compareA, setCompareA] = useState<string | null>(null)
  const [compareB, setCompareB] = useState<string | null>(null)

  useEffect(() => {
    getProgressPhotos().then(p => { setPhotos(p); setLoading(false) })
  }, [user])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem válida'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo 10MB'); return }
    setPending(file)
    setForm({ weight: '', caption: '' })
    setShowForm(true)
    e.target.value = ''
  }

  async function handleUpload() {
    if (!pending || !user) return
    setUploading(true)
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
      const storageRef = ref(storage, `users/${user.uid}/progress/${id}`)
      await uploadBytes(storageRef, pending)
      const url = await getDownloadURL(storageRef)
      const photo: ProgressPhoto = {
        id,
        url,
        date: todayKey(),
        weight: form.weight ? parseFloat(form.weight) : undefined,
        caption: form.caption.trim(),
      }
      const next = [photo, ...photos]
      await saveProgressPhotos(next)
      setPhotos(next)
      setPending(null)
      setShowForm(false)
      toast.success('📸 Foto adicionada à galeria!')
    } catch {
      toast.error('Erro ao fazer upload. Verifique o Storage no Firebase.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    const next = photos.filter(p => p.id !== id)
    await saveProgressPhotos(next)
    setPhotos(next)
    if (selected?.id === id) setSelected(null)
    toast.info('🗑 Foto removida')
  }

  function toggleCompare(id: string) {
    if (compareA === id) { setCompareA(null); return }
    if (compareB === id) { setCompareB(null); return }
    if (!compareA) { setCompareA(id); return }
    if (!compareB) { setCompareB(id); return }
    setCompareA(id); setCompareB(null)
  }

  const photoA = photos.find(p => p.id === compareA)
  const photoB = photos.find(p => p.id === compareB)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: T.text.lg }}>
        Carregando galeria...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><Camera size={20} color={C.orange} /> Galeria de Progresso</div>
          <div style={{ fontSize: T.text.md, color: C.muted }}>{photos.length} foto{photos.length !== 1 ? 's' : ''} · Registre sua evolução</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {photos.length >= 2 && (
            <button
              onClick={() => { setCompareMode(c => !c); setCompareA(null); setCompareB(null) }}
              style={{ background: compareMode ? C.blue : C.card2, border: `1px solid ${compareMode ? C.blue : C.border2}`, borderRadius: T.radius.sm, padding: '8px 14px', color: compareMode ? '#fff' : C.muted, fontSize: T.text.base, fontWeight: T.weight.bold, cursor: 'pointer' }}
            >
              ⚖ Comparar
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: C.orange, border: 'none', borderRadius: T.radius.sm, padding: '8px 16px', color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer' }}
          >
            + Adicionar foto
          </button>
        </div>
      </div>

      {/* Compare mode */}
      {compareMode && (
        <Card style={{ marginBottom: 16, background: `${C.blue}11`, border: `1px solid ${C.blue}44` }}>
          <div style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: C.blue, marginBottom: 10 }}>
            Modo comparação — selecione 2 fotos abaixo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[photoA, photoB].map((ph, i) => (
              <div key={i} style={{ background: C.card2, borderRadius: T.radius.lg, overflow: 'hidden', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}` }}>
                {ph ? (
                  <img src={ph.url} alt={ph.caption || ph.date} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ color: C.muted, fontSize: T.text.md, textAlign: 'center', padding: 20 }}>
                    {i === 0 ? 'Antes' : 'Depois'}<br />
                    <span style={{ fontSize: T.text.sm }}>Clique em uma foto</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {photoA && (
            <div style={{ marginTop: 8, fontSize: T.text.sm, color: C.muted, display: 'flex', justifyContent: 'space-around' }}>
              <span>{photoA.date}{photoA.weight ? ` · ${photoA.weight}kg` : ''}</span>
              {photoB && <span>{photoB.date}{photoB.weight ? ` · ${photoB.weight}kg` : ''}</span>}
            </div>
          )}
        </Card>
      )}

      {/* Upload form */}
      {showForm && pending && (
        <Card style={{ marginBottom: 16, border: `1px solid ${C.orange}44` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, color: C.orange, ...displayStyle }}><Camera size={17} /> Nova foto de progresso</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ width: isMobile ? '100%' : 160, height: 160, borderRadius: T.radius.lg, overflow: 'hidden', flexShrink: 0, background: C.card2 }}>
              <img src={URL.createObjectURL(pending)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: T.text.sm, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Peso atual (kg)</label>
                <input
                  type="number" step="0.1" placeholder="ex: 85.5"
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  style={{ width: '100%', background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '9px 12px', color: C.text, fontSize: T.text.md, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: T.text.sm, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Legenda (opcional)</label>
                <input
                  type="text" placeholder="ex: Semana 4 do programa"
                  value={form.caption}
                  onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  style={{ width: '100%', background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '9px 12px', color: C.text, fontSize: T.text.md, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{ flex: 1, background: uploading ? C.border2 : C.orange, border: 'none', borderRadius: T.radius.sm, padding: '10px', fontSize: T.text.md, fontWeight: T.weight.bold, color: '#fff', cursor: uploading ? 'not-allowed' : 'pointer' }}
            >
              {uploading ? 'Enviando...' : '✓ Salvar foto'}
            </button>
            <button
              onClick={() => { setPending(null); setShowForm(false) }}
              style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.sm, padding: '10px 16px', fontSize: T.text.md, color: C.muted, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </Card>
      )}

      {/* Photos grid */}
      {photos.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 20px', color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <div style={{ fontWeight: T.weight.bold, fontSize: T.text['2xl'], marginBottom: 8, color: C.text }}>Sem fotos ainda</div>
          <div style={{ fontSize: T.text.md, marginBottom: 20 }}>Registre sua evolução física com fotos periódicas</div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: C.orange, border: 'none', borderRadius: T.radius.sm, padding: '10px 24px', color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer' }}
          >
            + Adicionar primeira foto
          </button>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: 12 }}>
          {photos.map(ph => (
            <div
              key={ph.id}
              onClick={() => {
                if (compareMode) { toggleCompare(ph.id); return }
                setSelected(ph)
              }}
              style={{
                borderRadius: T.radius.xl, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                border: `2px solid ${compareMode && (compareA === ph.id || compareB === ph.id) ? C.blue : C.border}`,
                transition: 'border-color .15s',
              }}
            >
              <img src={ph.url} alt={ph.caption || ph.date} style={{ width: '100%', height: isMobile ? 140 : 200, objectFit: 'cover', display: 'block' }} />
              {compareMode && (compareA === ph.id || compareB === ph.id) && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: C.blue, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: T.text.base, color: '#fff', fontWeight: T.weight.bold }}>
                  {compareA === ph.id ? 'A' : 'B'}
                </div>
              )}
              <div style={{ padding: '8px 10px', background: C.card2 }}>
                <div style={{ fontSize: T.text.sm, color: C.muted }}>{ph.date}</div>
                {ph.weight && <div style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.orange }}>{ph.weight} kg</div>}
                {ph.caption && <div style={{ fontSize: T.text.sm, color: C.text, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ph.caption}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Fechar imagem"
          onClick={() => setSelected(null)}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setSelected(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '100%', background: C.card, borderRadius: T.radius['4xl'], overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <div style={{ position: 'relative' }}>
              <img src={selected.url} alt={selected.caption || selected.date} style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: '#000', display: 'block' }} />
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: T.text['4xl'], cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: T.text.md, color: C.muted }}>{selected.date}</div>
                {selected.weight && <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: C.orange }}>{selected.weight} kg</div>}
                {selected.caption && <div style={{ fontSize: T.text.md, color: C.text, marginTop: 4 }}>{selected.caption}</div>}
              </div>
              <button
                onClick={() => { handleDelete(selected.id) }}
                style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '7px 12px', color: C.muted, fontSize: T.text.base, cursor: 'pointer' }}
              >
                🗑 Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
