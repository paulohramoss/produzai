import { useState, useRef, useEffect, useContext, useMemo } from 'react'
import { Bot, Paperclip, ArrowUp, Download, History, MessageSquare, Trash2 } from 'lucide-react'
import { T, C, type Page, displayStyle } from '../data'
import { Card, Ring } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useCoachStore } from '../../store/useCoachStore'
import { exportAllCSV, exportWorkoutsCSV, exportDietCSV } from '../../lib/exportData'
import {
  streamCoach,
  type ChatMessage, type ChatAttachment, type ChatToolUse, type ChatToolResult,
} from '../../lib/anthropic'
import { buildWorkout, type WorkoutDraft } from '../../lib/workouts'
import { ageFromBirthDate, computeTdee, weightTrend } from '../../lib/body'
import { computeDayStreak } from '../../lib/streaks'
import { computeReadiness } from '../../lib/readiness'
import { computeTrainingLoad } from '../../lib/trainingLoad'
import { nextSession, weekAdherence, WEEKDAY_SHORT } from '../../lib/weekPlan'
import { usePlanStore } from '../../store/usePlanStore'
import { getDailyHistory, getJournalHistory, type DailyData, type ReadinessEntry } from '../../lib/db'
import { lastNDays, todayKey } from '../../lib/date'
import { toast } from '../../lib/toast'
import { LayoutContext } from '../LayoutContext'

function formatConversationDate(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props { setPage: (p: Page) => void }

const SUGGESTIONS = [
  { icon: '🏃', text: 'Acabei de correr 5km em 30 minutos' },
  { icon: '📊', text: 'Como foi minha semana?' },
  { icon: '🥗', text: 'O que devo comer pré-treino?' },
  { icon: '💤', text: 'Como melhorar minha recuperação?' },
  { icon: '🏋', text: 'Me sugira um treino para hoje' },
  { icon: '📅', text: 'Me dê um plano para essa semana' },
]

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
const ACCEPTED_ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
const EMPTY_MESSAGES: ChatMessage[] = []

// Teto de segurança para o ciclo pedir ferramenta → executar → comentar.
// Na prática o Coach registra e comenta em uma volta só.
const MAX_TOOL_ROUNDS = 3

function isToolResultMessage(msg: ChatMessage): boolean {
  return Boolean(msg.toolResults?.length) && !msg.content.trim()
}

export function Coach({ setPage }: Props) {
  const { isMobile } = useContext(LayoutContext)
  const workouts  = useWorkoutStore(s => s.workouts)
  const addWorkout = useWorkoutStore(s => s.add)
  const wd        = useWebDietStore(s => s.data)
  const habitDefs = useHabitsStore(s => s.defs)
  const user      = useAuthStore(s => s.user)
  const weightKg  = useAuthStore(s => s.body.weightKg)
  const body      = useAuthStore(s => s.body)
  const weightLog = useAuthStore(s => s.weightLog)
  const planSessions = usePlanStore(s => s.sessions)

  const conversations       = useCoachStore(s => s.conversations)
  const activeId            = useCoachStore(s => s.activeId)
  const startNewConv        = useCoachStore(s => s.startNew)
  const setActiveConv       = useCoachStore(s => s.setActive)
  const setConvMessages     = useCoachStore(s => s.setMessages)
  const removeConversation  = useCoachStore(s => s.removeConversation)

  const activeConversation = conversations.find(c => c.id === activeId) ?? null
  const messages = activeConversation?.messages ?? EMPTY_MESSAGES
  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  )

  // Histórico recente: dá ao Coach a prontidão de hoje e a sequência de dias.
  const [dailyHistory, setDailyHistory] = useState<Record<string, DailyData>>({})
  useEffect(() => {
    if (!user) return
    getDailyHistory(lastNDays(45)).then(setDailyHistory)
  }, [user])

  // Diário de treino recente: sentimentos, dores, motivação — para o Coach
  // perceber sinais de cansaço ou queda de motivação nas respostas.
  const [journalEntries, setJournalEntries] = useState<{ date: string; text: string }[]>([])
  useEffect(() => {
    if (!user) return
    getJournalHistory(lastNDays(10)).then(hist => {
      setJournalEntries(
        Object.entries(hist)
          .filter(([, e]) => e.text.trim())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, e]) => ({ date, text: e.text })),
      )
    })
  }, [user])

  const [showExport, setShowExport] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
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

  // Contexto corporal e de prontidão enviado junto de cada mensagem.
  const bodyContext = useMemo(() => {
    const trend = weightTrend(weightLog, 30)
    return {
      weightKg: body.weightKg,
      heightCm: body.heightCm,
      age: ageFromBirthDate(body.birthDate),
      sex: body.sex,
      ...(trend ? { weightTrend: `${trend.direction} ${Math.abs(trend.perWeek)} kg/semana nos últimos ${trend.days} dias` } : {}),
    }
  }, [body, weightLog])

  const readinessContext = useMemo(() => {
    const today = dailyHistory[todayKey()]?.readiness as ReadinessEntry | undefined
    if (!today) return undefined
    const past = Object.entries(dailyHistory)
      .filter(([d]) => d !== todayKey())
      .map(([, d]) => d.readiness)
      .filter((r): r is ReadinessEntry => Boolean(r))
    const result = computeReadiness(today, past)
    return {
      score: result.score,
      headline: result.headline,
      sleepHours: today.sleepHours,
      sleepQuality: today.sleepQuality,
      soreness: today.soreness,
      drive: today.drive,
      ...(today.restingHr ? { restingHr: today.restingHr } : {}),
    }
  }, [dailyHistory])

  const dayStreak = useMemo(
    () => computeDayStreak(habitDefs, dailyHistory).count,
    [habitDefs, dailyHistory],
  )

  const loadContext = useMemo(() => {
    const l = computeTrainingLoad(workouts)
    return { acute: l.acute, chronic: l.chronic, acwr: l.acwr, zone: l.zone, headline: l.headline }
  }, [workouts])

  const planContext = useMemo(() => {
    if (planSessions.length === 0) return undefined
    const adherence = weekAdherence(planSessions, workouts)
    const next = nextSession(planSessions, workouts)
    return {
      sessions: planSessions.map(p => `${WEEKDAY_SHORT[p.weekday]}: ${p.name} (${p.type}, ${p.durationMin}min)`),
      adherencePct: adherence.pct,
      matched: adherence.matchedCount,
      planned: adherence.plannedCount,
      ...(next ? { next: `${WEEKDAY_SHORT[next.session.weekday]} — ${next.session.name}` } : {}),
    }
  }, [planSessions, workouts])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // Nunca deixa a página sem sessão aberta: se nenhuma conversa estiver ativa
  // (entrada na página, ou histórico que acabou de chegar da nuvem), reabre a
  // mais recente em vez de mostrar um chat vazio.
  useEffect(() => {
    if (activeId === null && sortedConversations.length > 0) {
      setActiveConv(sortedConversations[0].id)
    }
  }, [activeId, sortedConversations, setActiveConv])

  // ── Ferramentas do Coach ──────────────────────────────────────────────────
  // O histórico de treinos vive no cliente, então quem executa a ferramenta
  // somos nós — o servidor só declara o contrato dela.
  function runTool(use: ChatToolUse): ChatToolResult {
    if (use.name !== 'registrar_treino') {
      return { id: use.id, content: `Ferramenta desconhecida: ${use.name}`, isError: true }
    }
    try {
      const workout = buildWorkout({ ...(use.input as WorkoutDraft), weightKg })
      addWorkout(workout)
      toast.success(`🏋 ${workout.name} registrado`)
      return {
        id: use.id,
        content: JSON.stringify({
          registrado: true,
          tipo: workout.type,
          nome: workout.name,
          data: workout.rawDate,
          duracao: workout.time,
          distanciaKm: workout.dist,
          pace: workout.pace,
          calorias: workout.cal,
        }),
      }
    } catch {
      return { id: use.id, content: 'Não foi possível registrar o treino.', isError: true }
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function runTurn(convId: string, history: ChatMessage[], round: number): Promise<void> {
    setStreamText('')

    let full = ''
    let toolUses: ChatToolUse[] = []
    let failed = false

    // Contexto sempre do estado atual: um treino registrado na volta anterior
    // precisa aparecer aqui para o Coach comentar em cima do número certo.
    const current = useWorkoutStore.getState().workouts

    await streamCoach(
      history,
      {
        type: 'coach',
        workouts: current,
        weekWorkouts: current.filter(w => {
          const [y, m, d] = w.rawDate.split('-').map(Number)
          return new Date(y, m - 1, d) >= weekStart
        }),
        wd,
        habitDefs,
        userName: user?.displayName || undefined,
        body: bodyContext,
        tdee: computeTdee(body),
        readiness: readinessContext,
        dayStreak,
        load: loadContext,
        plan: planContext,
        journalEntries,
      },
      chunk => { full += chunk; setStreamText(full) },
      uses => { toolUses = uses },
      err => {
        toast.error('Erro no Coach: ' + err)
        failed = true
      },
    )

    setStreamText('')
    if (failed) {
      setStreaming(false)
      return
    }

    let next: ChatMessage[] = [
      ...history,
      { role: 'assistant', content: full, ...(toolUses.length > 0 ? { toolUses } : {}) },
    ]
    setConvMessages(convId, next)

    if (toolUses.length === 0) {
      setStreaming(false)
      return
    }

    // Todo tool_use precisa de um tool_result, mesmo no teto de rodadas —
    // um pedido sem resposta invalidaria as próximas mensagens da conversa.
    next = [...next, { role: 'user', content: '', toolResults: toolUses.map(runTool) }]
    setConvMessages(convId, next)

    if (round >= MAX_TOOL_ROUNDS) {
      setStreaming(false)
      return
    }
    await runTurn(convId, next, round + 1)
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if ((!trimmed && !attachment) || streaming) return

    const convId = activeId ?? startNewConv()
    const userMsg: ChatMessage = { role: 'user', content: trimmed, attachment: attachment ?? undefined }
    const next = [...messages, userMsg]
    setConvMessages(convId, next)
    setInput('')
    setAttachment(null)
    setStreaming(true)

    await runTurn(convId, next, 1)
  }

  function handleStartNew() {
    startNewConv()
    setConfirmDeleteId(null)
    setShowHistory(false)
  }

  // Exclusão em dois toques — o histórico do Coach só sai daqui por decisão
  // explícita do usuário, nunca por um clique acidental no ícone da lixeira.
  function handleRemoveConversation(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    removeConversation(id)
    toast.info('🗑 Conversa removida')
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
          <div style={{ display: 'flex', gap: 8 }}>
            {conversations.length > 0 && (
              <button
                onClick={() => { setConfirmDeleteId(null); setShowHistory(true) }}
                title="Ver conversas anteriores"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '4px 10px', fontSize: T.text.sm, color: C.muted, cursor: 'pointer' }}
              >
                <History size={13} /> Histórico
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleStartNew}
                style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '4px 10px', fontSize: T.text.sm, color: C.muted, cursor: 'pointer' }}
              >
                Nova conversa
              </button>
            )}
          </div>
        </div>

        {/* Message area */}
        <div style={{ minHeight: isMobile ? 300 : 380, maxHeight: isMobile ? 400 : 520, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Empty state — suggestions */}
          {messages.length === 0 && !streaming && (
            <div>
              <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 14, textAlign: 'center' }}>
                Olá! Conte o treino que você fez — eu registro e comento — ou pergunte
                qualquer coisa sobre treino, dieta e performance.
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
                Anexe o print do seu relógio, da esteira ou do app de corrida — eu leio os
                números, registro o treino e comento.
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => {
            // O turno que devolve o resultado da ferramenta é protocolo, não conversa.
            if (isToolResultMessage(msg)) return null
            const registered = msg.toolUses?.filter(t => t.name === 'registrar_treino') ?? []
            const hasBubble = Boolean(msg.content.trim() || msg.attachment)

            return (
              <div
                key={i}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {hasBubble && (
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
                )}

                {registered.map(use => {
                  const w = buildWorkout({ ...(use.input as WorkoutDraft), weightKg })
                  return (
                    <div
                      key={use.id}
                      onClick={() => setPage('treino')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        background: `${C.purple}18`, border: `1px solid ${C.purple}55`,
                        borderRadius: T.radius.md, padding: '8px 12px', maxWidth: '82%',
                      }}
                    >
                      <span style={{ fontSize: T.text.xl }}>🏋</span>
                      <div>
                        <div style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.text }}>
                          {w.name} · {w.date}
                        </div>
                        <div style={{ fontSize: T.text.sm, color: C.muted }}>
                          {[w.time, w.dist > 0 ? `${w.dist} km` : null, `${w.cal} kcal`]
                            .filter(Boolean).join(' · ')} — registrado no seu treino
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

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

      {/* Histórico de conversas */}
      {showHistory && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowHistory(false) }}
          className="rise-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius['3xl'], padding: 24, width: '100%', maxWidth: 460, maxHeight: 'calc(100dvh - 48px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold }}>Conversas anteriores</div>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <button
              onClick={handleStartNew}
              style={{ width: '100%', background: C.orange, border: 'none', borderRadius: T.radius.md, padding: '10px', color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer', marginBottom: 14, flexShrink: 0 }}
            >
              + Nova conversa
            </button>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedConversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setActiveConv(c.id); setShowHistory(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: T.radius.md, cursor: 'pointer',
                    background: c.id === activeId ? `${C.orange}18` : C.card2,
                    border: `1px solid ${c.id === activeId ? C.orange + '44' : C.border}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: T.text.md, fontWeight: T.weight.semibold, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 2 }}>
                      {formatConversationDate(c.updatedAt)} · {c.messages.length} mensagens
                    </div>
                  </div>
                  {confirmDeleteId === c.id ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveConversation(c.id) }}
                        style={{ background: C.red, border: 'none', borderRadius: T.radius.xs, padding: '4px 10px', color: '#fff', fontSize: T.text.sm, fontWeight: T.weight.bold, cursor: 'pointer' }}
                      >
                        Excluir
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '4px 10px', color: C.muted, fontSize: T.text.sm, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); handleRemoveConversation(c.id) }}
                      title="Excluir conversa"
                      style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, flexShrink: 0 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
