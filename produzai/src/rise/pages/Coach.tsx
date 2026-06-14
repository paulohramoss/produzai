import { useState, useRef, useEffect, useContext } from 'react'
import { C, type Page } from '../data'
import { Card, Ring } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useCoachStore } from '../../store/useCoachStore'
import { exportAllCSV, exportWorkoutsCSV, exportDietCSV } from '../../lib/exportData'
import { streamCoach, buildSystemPrompt, hasApiKey, type ChatMessage, type ChatAttachment } from '../../lib/anthropic'
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

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024 // 5MB
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
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

    const system = buildSystemPrompt({
      workouts,
      weekWorkouts,
      wd,
      habitDefs,
      userName: user?.displayName || undefined,
    })

    let full = ''
    await streamCoach(
      next,
      system,
      chunk => { full += chunk; setStreamText(full) },
      () => {
        setMessages(m => [...m, { role: 'assistant', content: full }])
        setStreamText('')
        setStreaming(false)
      },
      err => {
        toast.error('Coach IA: ' + err)
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
      if (type === 'all')      exportAllCSV(workouts, wd)
      if (type === 'workouts') exportWorkoutsCSV(workouts)
      if (type === 'diet' && wd) exportDietCSV(wd)
      toast.success('📊 Arquivo CSV baixado!')
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

  const apiReady = hasApiKey()

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
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🤖 Coach IA</div>
          <div style={{ fontSize: 13, color: C.muted }}>Assistente pessoal de performance</div>
        </div>
        <button
          onClick={() => setShowExport(s => !s)}
          style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 14px', color: C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          📊 Exportar dados
        </button>
      </div>

      {/* Export panel */}
      {showExport && (
        <Card style={{ marginBottom: 20, border: `1px solid ${C.blue}44` }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: C.blue }}>📊 Exportar dados (CSV)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Tudo (CSV)', action: () => handleExport('all'), color: C.blue, text: '#fff' },
              { label: 'Só treinos', action: () => workouts.length > 0 ? handleExport('workouts') : toast.error('Nenhum treino'), color: C.card2, text: C.text },
              { label: 'Só dieta', action: () => wd ? handleExport('diet') : toast.error('Configure a dieta'), color: C.card2, text: C.text },
            ].map((b, i) => (
              <button key={i} onClick={b.action} style={{ background: b.color, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 16px', color: b.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {b.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Abre no Excel, Google Sheets ou qualquer planilha.</div>
        </Card>
      )}

      {/* Performance score + quick stats */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg,#F9731611,#A78BFA11)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Ring pct={perf} size={80} stroke={7} color={perf >= 70 ? C.green : perf >= 40 ? C.orange : C.red} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Performance Score</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              {perf === 0 ? 'Registre treinos e configure a dieta para calcular.'
                : perf >= 80 ? '🔥 Semana excelente! No limite do potencial.'
                : perf >= 60 ? '💪 Boa semana. Pequenos ajustes vão otimizar mais.'
                : perf >= 40 ? '📈 Em progresso. Foque na consistência.'
                : '🎯 Comece devagar — consistência é tudo.'}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              <span onClick={() => setPage('treino')} style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}>
                {weekWorkouts.length > 0 ? `🏋 ${weekWorkouts.length} treinos esta semana` : '+ Registrar treino'}
              </span>
              <span onClick={() => setPage('dieta')} style={{ fontSize: 11, color: C.green, cursor: 'pointer' }}>
                {wd ? `🥗 ${calPct}% da meta calórica` : '+ Configurar dieta'}
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
            <div style={{ fontWeight: 700, fontSize: 15 }}>💬 Conversa com o Coach</div>
            <div style={{ fontSize: 11, color: apiReady ? C.green : C.orange, marginTop: 2 }}>
              {apiReady ? '● Online — Claude Sonnet 4.6' : '● Configure VITE_ANTHROPIC_API_KEY no .env'}
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { clearCoach(); setStreamText('') }}
              style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, color: C.muted, cursor: 'pointer' }}
            >
              Nova conversa
            </button>
          )}
        </div>

        {/* Message area */}
        <div style={{ minHeight: isMobile ? 300 : 380, maxHeight: isMobile ? 400 : 520, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* No API key warning */}
          {!apiReady && (
            <div style={{ background: `${C.orange}18`, border: `1px solid ${C.orange}44`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.orange, marginBottom: 6 }}>⚠️ Chave da API não configurada</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                Adicione sua chave Anthropic no arquivo <code style={{ background: C.card2, padding: '1px 5px', borderRadius: 4 }}>.env</code>:<br />
                <code style={{ color: C.green, fontSize: 11 }}>VITE_ANTHROPIC_API_KEY=sk-ant-...</code><br /><br />
                Crie sua chave em <strong style={{ color: C.text }}>console.anthropic.com</strong> e reinicie o servidor.
              </div>
            </div>
          )}

          {/* Empty state — suggestions */}
          {messages.length === 0 && !streaming && (
            <div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14, textAlign: 'center' }}>
                {apiReady ? 'Olá! Pergunte qualquer coisa sobre treino, dieta ou performance.' : 'Configure a API para ativar o chat.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => apiReady && send(s.text)}
                    style={{
                      background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10,
                      padding: '10px 14px', textAlign: 'left', cursor: apiReady ? 'pointer' : 'default',
                      opacity: apiReady ? 1 : 0.4, transition: 'border-color .12s',
                    }}
                    onMouseEnter={e => apiReady && (e.currentTarget.style.borderColor = C.orange)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                  >
                    <span style={{ marginRight: 8 }}>{s.icon}</span>
                    <span style={{ fontSize: 12, color: C.text }}>{s.text}</span>
                  </button>
                ))}
              </div>
              {apiReady && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 14, textAlign: 'center' }}>
                  📎 Anexe um PDF ou foto do seu treino para receber uma análise do coach.
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? C.orange : C.card2,
                  color: msg.role === 'user' ? '#fff' : C.text,
                  fontSize: 13,
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
                        style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.15)', borderRadius: 8, padding: '6px 10px' }}>
                        <span>📄</span>
                        <span style={{ fontSize: 12 }}>{msg.attachment.name}</span>
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
              <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: C.card2, fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: C.text }}>
                {streamText || (
                  <span style={{ color: C.muted }}>
                    <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                    {' '}Pensando...
                  </span>
                )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '6px 10px', marginBottom: 8 }}>
              {attachment.mediaType.startsWith('image/') ? (
                <img
                  src={`data:${attachment.mediaType};base64,${attachment.data}`}
                  alt={attachment.name}
                  style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span style={{ fontSize: 18 }}>📄</span>
              )}
              <span style={{ fontSize: 12, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attachment.name}
              </span>
              <button
                onClick={() => setAttachment(null)}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!apiReady || streaming}
              title="Anexar PDF ou foto do treino"
              style={{
                background: attachment ? `${C.blue}22` : C.card2,
                border: `1px solid ${attachment ? C.blue : C.border2}`,
                borderRadius: 12,
                width: 42,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: apiReady && !streaming ? 'pointer' : 'default',
                opacity: apiReady && !streaming ? 1 : 0.4,
                flexShrink: 0,
                fontSize: 18,
              }}
            >
              📎
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={!apiReady || streaming}
              placeholder={apiReady ? (attachment ? 'Adicione uma mensagem (opcional)...' : 'Pergunte ao seu coach... (Enter para enviar)') : 'Configure a API key para ativar'}
              rows={1}
              style={{
                flex: 1,
                background: C.card2,
                border: `1px solid ${C.border2}`,
                borderRadius: 12,
                padding: '10px 14px',
                color: apiReady ? C.text : C.muted,
                fontSize: 13,
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
              disabled={!apiReady || (!input.trim() && !attachment) || streaming}
              style={{
                background: apiReady && (input.trim() || attachment) && !streaming ? C.orange : C.border2,
                border: 'none',
                borderRadius: 12,
                width: 42,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: apiReady && (input.trim() || attachment) && !streaming ? 'pointer' : 'default',
                flexShrink: 0,
                fontSize: 18,
                transition: 'background .15s',
              }}
            >
              {streaming ? '⏳' : '↑'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
