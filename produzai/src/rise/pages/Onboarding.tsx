import { useState, useRef, useEffect } from 'react'
import { T, C, displayStyle } from '../data'
import { CheckCircle2, Gem, Target, Utensils } from 'lucide-react'
import { Tag } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { saveProfile, saveDaily } from '../../lib/db'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { toast } from '../../lib/toast'
import {
  streamCoach, generateOnboardingPlan, hasApiKey,
  type ChatMessage, type OnboardingPlan,
} from '../../lib/anthropic'

// ─────────────────────────────────────────────────────────────────────────
// Onboarding por conversa: a IA entrevista o usuário (objetivos, rotina,
// valores) e gera o sistema inicial (hábitos com "porquê", metas, foco).
// Sem chave de API, cai no wizard rápido por templates.
// ─────────────────────────────────────────────────────────────────────────

export function Onboarding() {
  const apiReady = hasApiKey()
  const [mode, setMode] = useState<'chat' | 'quick'>(apiReady ? 'chat' : 'quick')

  if (mode === 'quick') {
    return <QuickOnboarding onSwitchToChat={apiReady ? () => setMode('chat') : undefined} />
  }
  return <ConversationalOnboarding onSwitchToQuick={() => setMode('quick')} />
}

// ── Onboarding conversacional ───────────────────────────────────────────────

function openingMessage(firstName: string): string {
  return `Oi, ${firstName}! 👋 Eu sou seu assistente de configuração aqui no Rise Plan.\n\nEm vez de te jogar numa tela vazia pra você montar tudo do zero, eu queria te conhecer um pouco antes. Me conta: o que te trouxe até aqui agora? Quais são seus principais objetivos pros próximos meses — em saúde, trabalho, ou na vida em geral?`
}

function ConversationalOnboarding({ onSwitchToQuick }: { onSwitchToQuick: () => void }) {
  const { user, setOnboardingDone } = useAuthStore()
  const setupDiet   = useWebDietStore(s => s.setup)
  const setHabitDefs = useHabitsStore(s => s.setDefs)

  const firstName = user?.displayName?.split(' ')[0] || 'atleta'

  const [messages, setMessages]     = useState<ChatMessage[]>([{ role: 'assistant', content: openingMessage(firstName) }])
  const [input, setInput]           = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [streamText, setStreamText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan]             = useState<OnboardingPlan | null>(null)
  const [excluded, setExcluded]     = useState<Set<number>>(new Set())
  const [saving, setSaving]         = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const userTurns = messages.filter(m => m.role === 'user').length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText, plan, generating])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming || generating) return

    const next = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(next)
    setInput('')
    setStreaming(true)
    setStreamText('')

    let full = ''
    await streamCoach(
      next,
      { type: 'onboarding', userName: firstName },
      chunk => { full += chunk; setStreamText(full) },
      () => {
        setMessages(m => [...m, { role: 'assistant', content: full }])
        setStreamText('')
        setStreaming(false)
      },
      err => {
        toast.error('Erro: ' + err)
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

  async function handleGeneratePlan() {
    setGenerating(true)
    const result = await generateOnboardingPlan(messages, user?.displayName || undefined)
    setGenerating(false)
    if (!result || !result.habits || result.habits.length === 0) {
      toast.error('Não consegui gerar seu plano agora. Pode tentar de novo ou usar o modo rápido.')
      return
    }
    setPlan(result)
    setExcluded(new Set())
  }

  function toggleHabit(i: number) {
    setExcluded(s => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  async function confirmPlan() {
    if (!plan) return
    setSaving(true)

    const habits = plan.habits
      .filter((_, i) => !excluded.has(i))
      .map(h => ({
        id: Math.random().toString(36).slice(2),
        icon: h.icon || '🎯',
        label: h.label,
        why: h.why,
        createdAt: Date.now(),
      }))

    if (habits.length > 0) setHabitDefs(habits)
    if (plan.macros && plan.macros.cal > 0) setupDiet(plan.macros)

    if (plan.focusSuggestion) {
      const todayKey = new Date().toISOString().slice(0, 10)
      saveDaily(todayKey, {
        focus: [
          { id: '1', text: plan.focusSuggestion, done: false },
          { id: '2', text: '', done: false },
          { id: '3', text: '', done: false },
        ],
      })
    }

    await saveProfile({
      onboardingDone: true,
      createdAt: Date.now(),
      goals: plan.goals,
      values: plan.values,
      onboardingSummary: plan.summary,
    })
    setOnboardingDone(true)
    toast.success(`🚀 Bem-vindo ao The Rise Plan, ${firstName}!`)
  }

  const inputDisabled = streaming || generating

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', fontFamily: 'system-ui, sans-serif', padding: '20px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 620 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <img src="/rise-plan-logo.svg" alt="The Rise Plan" style={{ width: 120, borderRadius: T.radius.lg, marginBottom: 12 }} />
          <div style={{ fontSize: T.text['4xl'], fontWeight: T.weight.extrabold, color: C.text, marginBottom: 4 }}>
            {plan ? 'Seu sistema inicial está pronto ✨' : 'Vamos te conhecer'}
          </div>
          <div style={{ fontSize: T.text.md, color: C.muted }}>
            {plan
              ? 'Revise e ajuste antes de começar — você pode editar tudo depois.'
              : 'Uma conversa rápida em vez de uma tela vazia. Quando quiser, gere seu plano.'}
          </div>
        </div>

        {!plan ? (
          <>
            {/* Chat */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius['3xl'], overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ maxHeight: 420, minHeight: 280, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%', padding: '10px 14px',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: msg.role === 'user' ? C.orange : C.card2,
                      color: msg.role === 'user' ? '#fff' : C.text,
                      fontSize: T.text.md, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {streaming && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: C.card2, fontSize: T.text.md, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: C.text }}>
                      {streamText || (
                        <span style={{ color: C.muted }}>
                          <span style={{ animation: 'pulse 1s infinite' }}>●</span> digitando...
                        </span>
                      )}
                      {streamText && <span style={{ opacity: 0.5 }}>▌</span>}
                    </div>
                  </div>
                )}

                {generating && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: T.text.base, color: C.orange, fontWeight: T.weight.bold }}>
                      ✨ Montando seu sistema inicial...
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={inputDisabled}
                  placeholder="Conte um pouco sobre você... (Enter para enviar)"
                  rows={1}
                  style={{
                    flex: 1, background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.lg,
                    padding: '10px 14px', color: C.text, fontSize: T.text.md, outline: 'none', resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
                  }}
                  onInput={e => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
                  }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || inputDisabled}
                  style={{
                    background: input.trim() && !inputDisabled ? C.orange : C.border2, border: 'none',
                    borderRadius: T.radius.lg, width: 42, height: 42, flexShrink: 0, fontSize: T.text['3xl'],
                    cursor: input.trim() && !inputDisabled ? 'pointer' : 'default', color: '#fff',
                  }}
                >
                  {streaming ? '⏳' : '↑'}
                </button>
              </div>
            </div>

            {/* Generate plan */}
            <button
              onClick={handleGeneratePlan}
              disabled={userTurns === 0 || inputDisabled}
              style={{
                width: '100%', padding: '14px', borderRadius: T.radius.lg, border: 'none',
                background: userTurns > 0 ? C.green : C.border2,
                color: userTurns > 0 ? '#fff' : C.muted,
                fontSize: T.text.xl, fontWeight: T.weight.bold, cursor: userTurns > 0 && !inputDisabled ? 'pointer' : 'default',
                marginBottom: 10,
              }}
            >
              {generating ? 'Gerando...' : '✨ Gerar meu plano inicial'}
            </button>
            <div style={{ textAlign: 'center' }}>
              {userTurns === 0 && (
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 8 }}>
                  Responda pelo menos uma vez para liberar o seu plano.
                </div>
              )}
              <span onClick={onSwitchToQuick} style={{ fontSize: T.text.base, color: C.muted, cursor: 'pointer', textDecoration: 'underline' }}>
                Prefiro o modo rápido (sem conversa)
              </span>
            </div>
          </>
        ) : (
          <PlanReview
            plan={plan}
            excluded={excluded}
            toggleHabit={toggleHabit}
            saving={saving}
            onBack={() => setPlan(null)}
            onConfirm={confirmPlan}
          />
        )}
      </div>
    </div>
  )
}

// ── Tela de revisão do plano gerado ─────────────────────────────────────────

function PlanReview({ plan, excluded, toggleHabit, saving, onBack, onConfirm }: {
  plan: OnboardingPlan
  excluded: Set<number>
  toggleHabit: (i: number) => void
  saving: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const includedCount = plan.habits.length - excluded.size

  return (
    <div className="fade-in">
      {/* Summary */}
      <div style={{ background: `${C.orange}11`, border: `1px solid ${C.orange}33`, borderRadius: T.radius.xl, padding: 16, marginBottom: 16, fontSize: T.text.md, lineHeight: 1.7, color: C.text }}>
        {plan.summary}
      </div>

      {/* Goals + values */}
      {(plan.goals?.length > 0 || plan.values?.length > 0) && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius.xl, padding: 16, marginBottom: 16 }}>
          {plan.goals?.length > 0 && (
            <div style={{ marginBottom: plan.values?.length > 0 ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.text.sm, color: C.muted, marginBottom: 8, fontWeight: T.weight.bold, textTransform: 'uppercase', letterSpacing: 0.6, ...displayStyle }}><Target size={17} /> Seus objetivos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {plan.goals.map((g, i) => <Tag key={i} label={g} color={C.orange} />)}
              </div>
            </div>
          )}
          {plan.values?.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.text.sm, color: C.muted, marginBottom: 8, fontWeight: T.weight.bold, textTransform: 'uppercase', letterSpacing: 0.6, ...displayStyle }}><Gem size={17} /> Valores identificados</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {plan.values.map((v, i) => <Tag key={i} label={v} color={C.purple} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Habits */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius.xl, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, ...displayStyle }}><CheckCircle2 size={17} /> Hábitos sugeridos</div>
          <span style={{ fontSize: T.text.sm, color: C.muted }}>{includedCount} selecionados</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plan.habits.map((h, i) => {
            const isOut = excluded.has(i)
            return (
              <div
                key={i}
                onClick={() => toggleHabit(i)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  background: isOut ? C.bg : C.card2, borderRadius: T.radius.md, cursor: 'pointer',
                  border: `1px solid ${isOut ? C.border : C.border2}`, opacity: isOut ? 0.45 : 1,
                  transition: 'all .12s',
                }}
              >
                <span style={{ fontSize: T.text['3xl'], flexShrink: 0 }}>{h.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: T.text.md, fontWeight: T.weight.semibold, textDecoration: isOut ? 'line-through' : 'none' }}>{h.label}</div>
                  {h.why && <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>💭 {h.why}</div>}
                </div>
                <span style={{ fontSize: T.text.base, color: isOut ? C.muted : C.green, flexShrink: 0 }}>{isOut ? '○' : '✓'}</span>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 10, textAlign: 'center' }}>
          Toque para incluir/remover. Você pode editar tudo depois em "Hoje".
        </div>
      </div>

      {/* Focus suggestion */}
      {plan.focusSuggestion && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius.xl, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, marginBottom: 8, ...displayStyle }}><Target size={17} /> Sugestão de foco para hoje</div>
          <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6 }}>{plan.focusSuggestion}</div>
        </div>
      )}

      {/* Macros */}
      {plan.macros && plan.macros.cal > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius.xl, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, marginBottom: 12, ...displayStyle }}><Utensils size={17} /> Metas nutricionais sugeridas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {[
              { l: 'Kcal', v: plan.macros.cal, c: C.orange },
              { l: 'Prot', v: plan.macros.prot, c: C.blue },
              { l: 'Carb', v: plan.macros.carb, c: C.green },
              { l: 'Gord', v: plan.macros.fat, c: C.purple },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: c + '18', borderRadius: T.radius.md, padding: '10px 8px', textAlign: 'center', border: `1px solid ${c}33` }}>
                <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, color: c }}>{v}</div>
                <div style={{ fontSize: T.text.xs, color: C.muted, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 10 }}>Você pode ajustar tudo depois na página de Dieta.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onBack}
          style={{ flex: 1, padding: '13px', borderRadius: T.radius.lg, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontSize: T.text.lg, fontWeight: T.weight.semibold, cursor: 'pointer' }}
        >
          ← Continuar conversa
        </button>
        <button
          onClick={onConfirm}
          disabled={includedCount === 0 || saving}
          style={{
            flex: 2, padding: '13px', borderRadius: T.radius.lg, border: 'none',
            background: includedCount > 0 ? C.green : C.border2,
            color: includedCount > 0 ? '#fff' : C.muted,
            fontSize: T.text.xl, fontWeight: T.weight.bold,
            cursor: includedCount > 0 && !saving ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Salvando...' : '🚀 Confirmar e começar!'}
        </button>
      </div>
    </div>
  )
}

// ── Wizard rápido (fallback por template) ───────────────────────────────────

const HABITS_OPTIONS = [
  { id: 'agua',      icon: '💧', label: 'Água 3L',            why: 'Seu corpo e sua mente funcionam melhor hidratados.' },
  { id: 'treino',    icon: '🏋', label: 'Treino diário',       why: 'Cuidar do corpo é a base para ter energia em tudo o resto.' },
  { id: 'leitura',   icon: '📚', label: 'Leitura 30min',       why: 'Investir em conhecimento é investir em quem você está se tornando.' },
  { id: 'meditacao', icon: '🧘', label: 'Meditação',           why: 'Uma mente calma toma decisões melhores.' },
  { id: 'sono',      icon: '😴', label: 'Dormir bem',          why: 'Descanso de qualidade é o multiplicador invisível da sua produtividade.' },
  { id: 'proteina',  icon: '🥩', label: 'Meta de proteína',    why: 'Alimentar bem o corpo sustenta seus objetivos físicos.' },
  { id: 'caminhada', icon: '🚶', label: 'Caminhada diária',    why: 'Movimento diário, mesmo leve, acumula em saúde a longo prazo.' },
  { id: 'sem_acucar',icon: '🚫', label: 'Sem açúcar',          why: 'Reduzir açúcar protege sua energia e seu humor durante o dia.' },
]

const GOALS_OPTIONS = [
  { id: 'perder_peso',  icon: '⚖️',  label: 'Perder peso' },
  { id: 'ganhar_massa', icon: '💪',  label: 'Ganhar massa muscular' },
  { id: 'mais_energia', icon: '⚡',  label: 'Ter mais energia' },
  { id: 'produtividade',icon: '🎯',  label: 'Ser mais produtivo' },
  { id: 'saude_mental', icon: '🧠',  label: 'Melhorar saúde mental' },
  { id: 'correr',       icon: '🏃',  label: 'Correr / cardio' },
]

function QuickOnboarding({ onSwitchToChat }: { onSwitchToChat?: () => void }) {
  const { user, setOnboardingDone } = useAuthStore()
  const setupDiet = useWebDietStore(s => s.setup)
  const setHabitDefs = useHabitsStore(s => s.setDefs)

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 0 — objetivos
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])

  // Step 1 — metas nutricionais
  const [macros, setMacros] = useState({ cal: 2000, prot: 150, carb: 200, fat: 60 })

  // Step 2 — hábitos
  const [selectedHabits, setSelectedHabits] = useState<string[]>(['agua', 'treino', 'leitura', 'proteina'])

  const STEPS = ['Seus objetivos', 'Nutrição', 'Hábitos diários']
  const firstName = user?.displayName?.split(' ')[0] || 'atleta'

  function toggleGoal(id: string) {
    setSelectedGoals(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function toggleHabit(id: string) {
    setSelectedHabits(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  async function finish() {
    setSaving(true)
    // Salva plano de dieta com as metas definidas
    setupDiet(macros)
    // Cria definições de hábitos com o "porquê" embutido
    const habits = HABITS_OPTIONS
      .filter(h => selectedHabits.includes(h.id))
      .map(h => ({ id: Math.random().toString(36).slice(2), icon: h.icon, label: h.label, why: h.why, createdAt: Date.now() }))
    setHabitDefs(habits)
    // Marca onboarding como concluído no Firestore
    const goals = GOALS_OPTIONS.filter(g => selectedGoals.includes(g.id)).map(g => g.label)
    await saveProfile({ onboardingDone: true, createdAt: Date.now(), goals })
    setOnboardingDone(true)
    toast.success(`🚀 Bem-vindo ao The Rise Plan, ${firstName}!`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/rise-plan-logo.svg" alt="The Rise Plan" style={{ width: 160, borderRadius: T.radius.lg, marginBottom: 16 }} />
          <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: C.text, marginBottom: 6, ...displayStyle }}>
            Olá, {firstName}! 👋
          </div>
          <div style={{ fontSize: T.text.lg, color: C.muted }}>Vamos configurar seu plano em 3 passos rápidos</div>
          {onSwitchToChat && (
            <div style={{ marginTop: 10 }}>
              <span onClick={onSwitchToChat} style={{ fontSize: T.text.base, color: C.orange, cursor: 'pointer', textDecoration: 'underline' }}>
                ✨ Prefiro conversar com a IA pra montar meu plano
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                height: 4, width: '100%', borderRadius: T.radius['2xs'],
                background: i <= step ? C.orange : C.border2,
                transition: 'background 0.3s',
              }} />
              <div style={{ fontSize: T.text.xs, color: i <= step ? C.orange : C.muted, fontWeight: i === step ? 700 : 400 }}>
                {s}
              </div>
            </div>
          ))}
        </div>

        {/* ── STEP 0: Objetivos ── */}
        {step === 0 && (
          <div className="fade-in">
            <div style={{ fontWeight: T.weight.bold, fontSize: 17, marginBottom: 6 }}>Quais são seus objetivos?</div>
            <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 20 }}>Selecione todos que se aplicam</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {GOALS_OPTIONS.map(g => {
                const sel = selectedGoals.includes(g.id)
                return (
                  <div
                    key={g.id}
                    onClick={() => toggleGoal(g.id)}
                    style={{
                      padding: '14px 16px', borderRadius: T.radius.lg, cursor: 'pointer',
                      background: sel ? `${C.orange}18` : '#1A1A1A',
                      border: `2px solid ${sel ? C.orange : C.border}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: T.text['4xl'] }}>{g.icon}</span>
                    <span style={{ fontSize: T.text.md, fontWeight: sel ? 700 : 400, color: sel ? C.text : C.muted }}>
                      {g.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setStep(1)}
              style={{
                width: '100%', padding: '14px', borderRadius: T.radius.lg,
                background: C.orange, border: 'none',
                color: '#fff', fontSize: T.text.xl, fontWeight: T.weight.bold, cursor: 'pointer',
              }}
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ── STEP 1: Nutrição ── */}
        {step === 1 && (
          <div className="fade-in">
            <div style={{ fontWeight: T.weight.bold, fontSize: 17, marginBottom: 6 }}>Metas nutricionais diárias</div>
            <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 20 }}>Você pode ajustar depois na página de Dieta</div>

            <div style={{
              background: '#1A1A1A', borderRadius: T.radius.lg, padding: 16, marginBottom: 20,
              border: `1px solid ${C.border}`,
            }}>
              {[
                { k: 'cal'  as const, label: 'Calorias', unit: 'kcal', color: C.orange, min: 1200, max: 5000, step: 50 },
                { k: 'prot' as const, label: 'Proteína', unit: 'g',    color: C.blue,   min: 50,   max: 400,  step: 5  },
                { k: 'carb' as const, label: 'Carboidratos', unit: 'g', color: C.green, min: 50,   max: 600,  step: 5  },
                { k: 'fat'  as const, label: 'Gorduras',  unit: 'g',   color: C.purple, min: 20,   max: 200,  step: 5  },
              ].map(({ k, label, unit, color, min, max, step: s }, i, arr) => (
                <div key={k} style={{ marginBottom: i === arr.length - 1 ? 0 : 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: T.text.md, color: C.muted }}>{label}</span>
                    <span style={{ fontSize: T.text.lg, fontWeight: T.weight.extrabold, color }}>
                      {macros[k]} {unit}
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={s}
                    value={macros[k]}
                    onChange={e => setMacros(m => ({ ...m, [k]: +e.target.value }))}
                    style={{ width: '100%', accentColor: color }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
              {[
                { l: 'Kcal',  v: macros.cal,  c: C.orange },
                { l: 'Prot',  v: macros.prot, c: C.blue   },
                { l: 'Carb',  v: macros.carb, c: C.green  },
                { l: 'Gord',  v: macros.fat,  c: C.purple },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: c + '18', borderRadius: T.radius.md, padding: '10px 8px', textAlign: 'center', border: `1px solid ${c}33` }}>
                  <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, color: c }}>{v}</div>
                  <div style={{ fontSize: T.text.xs, color: C.muted, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(0)}
                style={{ flex: 1, padding: '13px', borderRadius: T.radius.lg, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontSize: T.text.lg, fontWeight: T.weight.semibold, cursor: 'pointer' }}
              >
                ← Voltar
              </button>
              <button
                onClick={() => setStep(2)}
                style={{ flex: 2, padding: '13px', borderRadius: T.radius.lg, background: C.orange, border: 'none', color: '#fff', fontSize: T.text.xl, fontWeight: T.weight.bold, cursor: 'pointer' }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Hábitos ── */}
        {step === 2 && (
          <div className="fade-in">
            <div style={{ fontWeight: T.weight.bold, fontSize: 17, marginBottom: 6 }}>Quais hábitos quer desenvolver?</div>
            <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 20 }}>Estes aparecerão no seu checklist diário</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {HABITS_OPTIONS.map(h => {
                const sel = selectedHabits.includes(h.id)
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHabit(h.id)}
                    style={{
                      padding: '13px 14px', borderRadius: T.radius.lg, cursor: 'pointer',
                      background: sel ? `${C.green}15` : '#1A1A1A',
                      border: `2px solid ${sel ? C.green : C.border}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: T.text['3xl'] }}>{h.icon}</span>
                    <span style={{ fontSize: T.text.md, fontWeight: sel ? 700 : 400, color: sel ? C.text : C.muted }}>
                      {h.label}
                    </span>
                    {sel && <span style={{ marginLeft: 'auto', color: C.green, fontSize: T.text.base }}>✓</span>}
                  </div>
                )
              })}
            </div>

            {selectedHabits.length === 0 && (
              <div style={{ fontSize: T.text.base, color: C.red, textAlign: 'center', marginBottom: 16 }}>
                Selecione ao menos 1 hábito
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{ flex: 1, padding: '13px', borderRadius: T.radius.lg, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontSize: T.text.lg, fontWeight: T.weight.semibold, cursor: 'pointer' }}
              >
                ← Voltar
              </button>
              <button
                onClick={finish}
                disabled={selectedHabits.length === 0 || saving}
                style={{
                  flex: 2, padding: '13px', borderRadius: T.radius.lg, border: 'none',
                  background: selectedHabits.length > 0 ? C.green : C.border2,
                  color: selectedHabits.length > 0 ? '#fff' : C.muted,
                  fontSize: T.text.xl, fontWeight: T.weight.bold,
                  cursor: selectedHabits.length > 0 && !saving ? 'pointer' : 'default',
                }}
              >
                {saving ? 'Salvando...' : '🚀 Começar agora!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
