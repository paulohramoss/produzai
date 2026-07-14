import { useState, useRef, useEffect, useContext } from 'react'
import { Bot, Paperclip, ArrowUp, Download, MessageSquare } from 'lucide-react'
import { T, C, type Page, displayStyle } from '../data'
import { Card, Ring } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useCoachStore } from '../../store/useCoachStore'
import { exportAllCSV, exportWorkoutsCSV, exportDietCSV } from '../../lib/exportData'
import { streamCoach, type ChatMessage, type ChatAttachment } from '../../lib/anthropic'
import { toast } from '../../lib/toast'
import { LayoutContext } from '../LayoutContext'

interface Props { setPage: (p: Page) => void }

const SUGGESTIONS = [
  { icon: '📊', text: 'Como foi minha semana?' },
  { icon: '🥗', text: 'O que devo comer pré-treino?' },
  { icon: '💤', text: 'Como melhorar minha recuperação?' },
  { icon: '🏋', text: 'Me sugira um treino para hoje' },
  { icon: '⚡', text: 'Como aumentar minha energia?' },
  { icon: '📅', text: 'Me dê um plano para essa semana' },
]

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
const ACCEPTED_ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function Coach({ setPage }: Props) {
  const { isMobile } = useContext(LayoutContext)
  const workouts  = useWorkoutStore(s => s.workouts)
  const wd        = useWebDietStore(s => s.data)
  const habitDefs = useHabitsStore(s => s.defs)
  const user      = useAuthStore(s => s.user)

  const messages    = useCoachStore(s => s.messages)
  const setMessages = useCoachStore(s => s.setMessages)
  const clearCoach  = useCoachStore(s => s.clear)

  const [showExport, setShowExport] = useState(false)
  const [input, setInput]           = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [streamText, setStreamText] = useState('')
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Derived data ─────────────────────────────────────────────────────────
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    d.setHours(0, 0, 0, 0)
    return d
  })()
  const weekWorkouts = workouts.filter(w => {
    const [y, m, d] = w.rawDate.split('-').map(Number)
    return new Date(y, m - 1, d) >= weekStart
  })

  const doneMeals   = wd?.meals.filter(m => m.done) ?? []
  const calConsumed = doneMeals.reduce((s, m) => s + m.cal, 0)
  const calPct      = wd && wd.goals.cal > 0
    ? Math.min(Math.round(calConsumed / wd.goals.cal * 100), 100) : 0
  const treinoScore = Math.min(weekWorkouts.length * 20, 60)
  const dietaScore  = wd ? Math.round(calPct * 0.4) : 0
  const perf        = treinoScore + dietaScore

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // ── Send ──────────────────────────────────────────────────────────────────
  async function send(text: string) {
    const trimmed = text.trim()
    if ((!trimmed && !attachment) || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed, attachment: attachment ?? undefined }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setAttachment(null)
    setStreaming(true)
    setStreamText('')

    let full = ''
    await streamCoach(
      next,
      { type: 'coach', workouts, weekWorkouts, wd, habitDefs, userName: user?.displayName || undefined },
      chunk => { full += chunk; setStreamText(full) },
      () => {
        setMessages(m => [...m, { role: 'assistant', content: full }])
        setStreamText('')
        setStreaming(false)
      },
      err => {
        toast.error('Erro no Coach: ' + err)
        setStreaming(false)
      },
    )
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  function handleExport(type: 'all' | 'workouts' | 'diet') {
    try {
      if (type === 'all')            exportAllCSV(workouts, wd)
      if (type === 'workouts')       exportWorkoutsCSV(workouts)
      if (type === 'diet' && wd)     exportDietCSV(wd)
      toast.success('Arquivo CSV baixado!')
      setShowExport(false)
    } catch { toast.error('Erro ao exportar dados') }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
      toast.error('Envie um PDF ou imagem (JPG, PNG, WEBP, GIF).')
      return
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error('Arquivo muito grande. Máximo 5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setAttachment({ name: file.name, mediaType: file.type, data: result.split(',')[1] })
    }
    reader.readAsDataURL(file)
  }

  const canSend = (input.trim() !== '' || attachment !== null) && !streaming

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Bot size={22} style={{ color: C.orange }} />
            <span style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, ...displayStyle }}>Coach</span>
          </div>
          <div style={{ fontSize: T.text.md, color: C.muted }}>Assistente pessoal de performance</div>
        </div>
        <button
          onClick={() => setShowExport(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '8px 14px', color: C.muted, fontSize: T.text.base, fontWeight: T.weight.bold, cursor: 'pointer' }}
        >
          <Download size={13} />
          Exportar dados
        </button>
      </div>

      {/* Export panel */}
      {showExport && (
        <Card style={{ marginBottom: 20, border: `1px solid ${C.blue}44` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, marginBottom: 12, color: C.blue }}>
            <Download size={14} />
            Exportar dados (CSV)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Tudo',       action: () => handleExport('all'),      color: C.blue,  text: '#fff' },
              { label: 'Treinos',    action: () => workouts.length > 0 ? handleExport('workouts') : toast.error('Nenhum treino'), color: C.card2, text: C.text },
              { label: 'Dieta',      action: () => wd ? handleExport('diet') : toast.error('Configure a dieta'), color: C.card2, text: C.text },
            ].map((b, i) => (
              <button key={i} onClick={b.action} style={{ background: b.color, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '8px 16px', color: b.text, fontSize: T.text.base, fontWeight: T.weight.semibold, cursor: 'pointer' }}>
                {b.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 10 }}>Abre no Excel, Google Sheets ou qualquer planilha.</div>
        </Card>
      )}

      {/* Performance score + quick stats */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg,#F9731611,#A78BFA11)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Ring pct={perf} size={80} stroke={7} color={perf >= 70 ? C.green : perf >= 40 ? C.orange : C.red} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, marginBottom: 4 }}>Performance Score</div>
            <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.5 }}>
              {perf === 0 ? 'Registre treinos e configure a dieta para calcular.'
                : perf >= 80 ? '🔥 Semana excelente! No limite do potencial.'
                : perf >= 60 ? '💪 Boa semana. Pequenos ajustes vão otimizar mais.'
                : perf >= 40 ? '📈 Em progresso. Foque na consistência.'
                : '🎯 Comece devagar — consistência é tudo.'}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              <span onClick={() => setPage('treino')} style={{ fontSize: T.text.sm, color: C.orange, cursor: 'pointer' }}>
                {weekWorkouts.length > 0 ? `${weekWorkouts.length} treinos esta semana` : '+ Registrar treino'}
              </span>
              <span onClick={() => setPage('dieta')} style={{ fontSize: T.text.sm, color: C.green, cursor: 'pointer' }}>
                {wd ? `${calPct}% da meta calórica` : '+ Configurar dieta'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── CHAT ─────────────────────────────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl }}>
              <MessageSquare size={16} style={{ color: C.muted }} />
              Conversa com o Coach
            </div>
            <div style={{ fontSize: T.text.sm, color: C.green, marginTop: 2 }}>● Disponível</div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { clearCoach(); setStreamText('') }}
              style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '4px 10px', fontSize: T.text.sm, color: C.muted, cursor: 'pointer' }}
            >
              Nova conversa
            </button>
          )}
        </div>

        {/* Message area */}
        <div style={{ minHeight: isMobile ? 300 : 380, maxHeight: isMobile ? 400 : 520, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Empty state — suggestions */}
          {messages.length === 0 && !streaming && (
            <div>
              <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 14, textAlign: 'center' }}>
                Olá! Pergunte qualquer coisa sobre treino, dieta ou performance.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s.text)}
                    style={{
                      background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.md,
                      padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                      transition: 'border-color .12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = C.orange)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                  >
                    <span style={{ marginRight: 8 }}>{s.icon}</span>
                    <span style={{ fontSize: T.text.base, color: C.text }}>{s.text}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 14, textAlign: 'center' }}>
                Anexe um PDF ou foto do seu treino para receber uma análise do coach.
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? C.orange : C.card2,
                  color: msg.role === 'user' ? '#fff' : C.text,
                  fontSize: T.text.md,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.attachment && (
                  <div style={{ marginBottom: msg.content ? 8 : 0 }}>
                    {msg.attachment.mediaType.startsWith('image/') && msg.attachment.data ? (
                      <img
                        src={`data:${msg.attachment.mediaType};base64,${msg.attachment.data}`}
                        alt={msg.attachment.name}
                        style={{ maxWidth: '100%', maxHeight: 200, borderRadius: T.radius.md, display: 'block' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.15)', borderRadius: T.radius.sm, padding: '6px 10px' }}>
                        <span style={{ fontSize: T.text.lg }}>📄</span>
                        <span style={{ fontSize: T.text.base }}>{msg.attachment.name}</span>
                      </div>
                    )}
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming bubble */}
          {streaming && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: C.card2, fontSize: T.text.md, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: C.text }}>
                {streamText || <span style={{ color: C.muted }}>Pensando...</span>}
                {streamText && <span style={{ opacity: 0.5 }}>▌</span>}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
          {/* Attachment preview */}
          {attachment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.md, padding: '6px 10px', marginBottom: 8 }}>
              {attachment.mediaType.startsWith('image/') ? (
                <img
                  src={`data:${attachment.mediaType};base64,${attachment.data}`}
                  alt={attachment.name}
                  style={{ width: 32, height: 32, borderRadius: T.radius.xs, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span style={{ fontSize: T.text['3xl'] }}>📄</span>
              )}
              <span style={{ fontSize: T.text.base, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attachment.name}
              </span>
              <button
                onClick={() => setAttachment(null)}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text['2xl'], padding: '0 2px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={streaming}
              title="Anexar PDF ou foto do treino"
              style={{
                background: attachment ? `${C.blue}22` : C.card2,
                border: `1px solid ${attachment ? C.blue : C.border2}`,
                borderRadius: T.radius.lg,
                width: 42,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: streaming ? 'default' : 'pointer',
                opacity: streaming ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              <Paperclip size={17} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={streaming}
              placeholder={attachment ? 'Adicione uma mensagem (opcional)...' : 'Pergunte ao seu coach... (Enter para enviar)'}
              rows={1}
              style={{
                flex: 1,
                background: C.card2,
                border: `1px solid ${C.border2}`,
                borderRadius: T.radius.lg,
                padding: '10px 14px',
                color: C.text,
                fontSize: T.text.md,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                maxHeight: 100,
                overflowY: 'auto',
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 100) + 'px'
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!canSend}
              style={{
                background: canSend ? C.orange : C.border2,
                border: 'none',
                borderRadius: T.radius.lg,
                width: 42,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canSend ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'background .15s',
              }}
            >
              <ArrowUp size={18} style={{ color: canSend ? '#fff' : C.muted }} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
