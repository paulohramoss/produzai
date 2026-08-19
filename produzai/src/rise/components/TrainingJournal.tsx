import { useState, useEffect, useRef } from 'react'
import { NotebookPen, Sparkles, Mic, Square } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import {
  getJournalEntry, saveJournalEntry, getJournalHistory,
  getJournalInsights, saveJournalInsight, type JournalInsight,
} from '../../lib/db'
import { generateJournalInsights } from '../../lib/anthropic'
import { parseDurationToMinutes } from '../../lib/performance'
import { EFFORT_LEVELS } from '../../lib/calories'
import { useSpeechToText } from '../../lib/useSpeechToText'
import { toast } from '../../lib/toast'
import { userStorage } from '../../lib/userStorage'

const HISTORY_DAYS = 14
const RISK_COLOR: Record<JournalInsight['riskLevel'], string> = {
  baixo: C.green,
  moderado: C.orange,
  alto: C.red,
}
const RISK_LABEL: Record<JournalInsight['riskLevel'], string> = {
  baixo: '🟢 Risco baixo',
  moderado: '🟡 Risco moderado',
  alto: '🔴 Risco alto',
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function lastDates(n: number): string[] {
  const dates: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function friendlyDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export function TrainingJournal() {
  const user = useAuthStore(s => s.user)
  const workouts = useWorkoutStore(s => s.workouts)

  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [history, setHistory] = useState<{ date: string; text: string }[]>([])
  const [insights, setInsights] = useState<JournalInsight[]>([])
  const [generating, setGenerating] = useState(false)

  const lastSavedRef = useRef('')
  const wasRecordingRef = useRef(false)
  const today = todayKey()

  const { recording, toggle: toggleDictation, supported: speechSupported } = useSpeechToText(transcript => {
    setText(prev => (prev ? `${prev} ${transcript}` : transcript))
  })

  useEffect(() => {
    async function load() {
      setLoaded(false)
      const dates = lastDates(HISTORY_DAYS)

      if (user) {
        const [todayEntry, hist, savedInsights] = await Promise.all([
          getJournalEntry(today),
          getJournalHistory(dates),
          getJournalInsights(),
        ])
        const initialText = todayEntry?.text ?? ''
        setText(initialText)
        lastSavedRef.current = initialText
        setHistory(
          Object.entries(hist)
            .filter(([d, e]) => d !== today && e.text.trim())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, e]) => ({ date, text: e.text })),
        )
        setInsights(savedInsights)
      } else {
        const local = userStorage.getItem(`journal_${today}`) ?? ''
        setText(local)
        lastSavedRef.current = local
      }
      setLoaded(true)
    }
    load()
  }, [user, today])

  function persist(next: string) {
    userStorage.setItem(`journal_${today}`, next)
    saveJournalEntry(today, { text: next, updatedAt: Date.now() })
  }

  function saveIfChanged() {
    if (text.trim() === lastSavedRef.current.trim()) return
    lastSavedRef.current = text
    persist(text)
    if (text.trim()) toast.success('📔 Diário salvo')
  }

  useEffect(() => {
    if (wasRecordingRef.current && !recording) saveIfChanged()
    wasRecordingRef.current = recording
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  function buildJournalSummary(): string {
    const dates = lastDates(HISTORY_DAYS)
    const entries = [
      ...(text.trim() ? [{ date: today, text }] : []),
      ...history,
    ].sort((a, b) => b.date.localeCompare(a.date))

    const lines = [`Diário de treino dos últimos ${HISTORY_DAYS} dias:`]
    if (entries.length > 0) {
      for (const e of entries) lines.push(`- ${e.date}: ${e.text}`)
    } else {
      lines.push('- Nenhum registro no diário neste período.')
    }

    const recentWorkouts = workouts.filter(w => dates.includes(w.rawDate))
    lines.push('', `Treinos registrados no mesmo período: ${recentWorkouts.length}`)
    for (const w of recentWorkouts.slice(0, 20)) {
      const effortLabel = w.effort ? EFFORT_LEVELS[w.effort - 1].label : 'não registrado'
      const minutes = parseDurationToMinutes(w.time)
      lines.push(`- ${w.rawDate}: ${w.name} (${w.type}, ${minutes ?? '?'}min, esforço ${effortLabel})`)
    }

    return lines.join('\n')
  }

  async function handleGenerateInsights() {
    setGenerating(true)
    const summary = buildJournalSummary()
    const result = await generateJournalInsights(summary)
    setGenerating(false)
    if (!result) {
      toast.error('Não foi possível gerar os insights agora. Tente novamente em instantes.')
      return
    }
    const insight: JournalInsight = {
      weekKey: getISOWeekKey(new Date()),
      generatedAt: Date.now(),
      ...result,
    }
    await saveJournalInsight(insight)
    setInsights(prev => [insight, ...prev.filter(i => i.weekKey !== insight.weekKey)])
    toast.success('✨ Insights do diário gerados!')
  }

  const hasContent = text.trim().length > 0 || history.length > 0

  if (!loaded) return null

  return (
    <Card style={{ marginBottom: 16, borderTop: `2px solid ${C.purple}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
        <NotebookPen size={17} color={C.purple} /> Diário de treino
      </div>
      <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 14 }}>
        Como você está se sentindo com o treino? Dores, motivação, cansaço, humor — escreva ou fale livremente.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={saveIfChanged}
          placeholder="Ex: hoje o treino foi pesado, senti uma dor leve no joelho e pouca motivação..."
          rows={3}
          style={{
            flex: 1, boxSizing: 'border-box', fontSize: T.text.md, color: C.text, background: C.card2,
            border: `1px solid ${C.border2}`, borderRadius: T.radius.md, padding: '10px 12px',
            lineHeight: 1.6, resize: 'none', fontFamily: 'inherit', outline: 'none',
          }}
        />
        {speechSupported && (
          <button
            onClick={toggleDictation}
            title={recording ? 'Parar gravação' : 'Ditar diário por voz'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, alignSelf: 'flex-start',
              background: recording ? C.red : C.purple, border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            {recording ? <Square size={15} /> : <Mic size={17} />}
          </button>
        )}
      </div>

      {hasContent && (
        <button
          onClick={handleGenerateInsights}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14,
            background: generating ? C.card2 : C.purple, border: 'none', borderRadius: T.radius.sm,
            padding: '8px 16px', color: generating ? C.muted : '#fff', fontSize: T.text.base, fontWeight: T.weight.bold,
            cursor: generating ? 'default' : 'pointer',
          }}
        >
          <Sparkles size={14} /> {generating ? 'Analisando...' : 'Gerar insights do diário'}
        </button>
      )}

      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: history.length > 0 ? 16 : 0 }}>
          {insights.slice(0, 3).map(ins => (
            <div key={ins.weekKey} style={{ background: C.card2, borderRadius: T.radius.md, padding: 14, border: `1px solid ${RISK_COLOR[ins.riskLevel]}44`, borderLeft: `3px solid ${RISK_COLOR[ins.riskLevel]}` }}>
              <div style={{ fontSize: T.text.sm, fontWeight: T.weight.bold, color: RISK_COLOR[ins.riskLevel], marginBottom: 6 }}>
                {RISK_LABEL[ins.riskLevel]}
              </div>
              <div style={{ fontSize: T.text.md, lineHeight: 1.6, marginBottom: ins.signals.length > 0 ? 8 : 0 }}>{ins.summary}</div>
              {ins.signals.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {ins.signals.map((s, i) => (
                    <div key={i} style={{ fontSize: T.text.base, color: C.muted, marginBottom: 3 }}>🔍 {s}</div>
                  ))}
                </div>
              )}
              {ins.recommendation && (
                <div style={{ fontSize: T.text.base, color: C.text, fontStyle: 'italic', marginTop: 4 }}>
                  💡 {ins.recommendation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div style={{ fontSize: T.text.sm, color: C.muted, fontWeight: T.weight.bold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
            Registros anteriores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.slice(0, 7).map(h => (
              <div key={h.date} style={{ background: C.card2, borderRadius: T.radius.sm, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: T.text.xs, color: C.muted, fontWeight: T.weight.bold, marginBottom: 3, textTransform: 'capitalize' }}>
                  {friendlyDayLabel(h.date)}
                </div>
                <div style={{ fontSize: T.text.base, color: C.text, lineHeight: 1.5 }}>{h.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
