import { useState, useEffect, useContext } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { Brain, Flame, Lightbulb, Moon, NotebookPen, PenLine, Smile, TrendingUp, Zap } from 'lucide-react'
import { Card } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { getMental, saveMental, getMentalHistory, getDaily, type MentalEntry } from '../../lib/db'
import { toast } from '../../lib/toast'
import { userStorage } from '../../lib/userStorage'
import { LayoutContext } from '../LayoutContext'
import { hasApiKey, generateReflectionQuestion, fallbackReflectionQuestion } from '../../lib/anthropic'
import { useSpeechToText } from '../../lib/useSpeechToText'
import { RecoveryCheckin } from '../components/RecoveryCheckin'

interface Props { setPage: (p: Page) => void }

function dateSeed(dateKey: string): number {
  return Number(dateKey.replace(/-/g, ''))
}

const MOODS       = ['😞', '😕', '😐', '🙂', '😄']
const MOOD_LABELS = ['Ruim', 'Regular', 'Ok', 'Bom', 'Ótimo']
const MOOD_COLORS = [C.red, '#F97316', '#EAB308', C.green, '#22C55E']

const todayKey = () => new Date().toISOString().slice(0, 10)

const EMPTY: MentalEntry = { mood: 0, energy: 0, gratitude: ['', '', ''], note: '' }

function loadLocalEntry(key: string): MentalEntry {
  try {
    const r = userStorage.getItem(`mental_${key}`)
    return r ? JSON.parse(r) : { ...EMPTY }
  } catch { return { ...EMPTY } }
}

const inp: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
  padding: '9px 10px', color: C.text, fontSize: T.text.md, outline: 'none', width: '100%',
}

export function Mental({ setPage: _s }: Props) {
  const user = useAuthStore(s => s.user)
  const { isMobile } = useContext(LayoutContext)
  const today = todayKey()

  const [entry,   setEntry]   = useState<MentalEntry>({ ...EMPTY })
  const [history, setHistory] = useState<{ date: string; mood: number }[]>([])
  const [loaded,  setLoaded]  = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [reflectionLoading, setReflectionLoading] = useState(false)
  const [savedReflection, setSavedReflection] = useState(false)

  // Carrega entrada de hoje e histórico
  useEffect(() => {
    async function load() {
      // Histórico: últimos 7 dias
      const dates: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        dates.push(d.toISOString().slice(0, 10))
      }

      if (user) {
        const [cloudEntry, cloudHistory] = await Promise.all([
          getMental(today),
          getMentalHistory(dates),
        ])
        setEntry(cloudEntry ?? loadLocalEntry(today))
        setHistory(dates.map(d => ({ date: d, mood: cloudHistory[d]?.mood ?? 0 })))
      } else {
        setEntry(loadLocalEntry(today))
        setHistory(dates.map(d => ({ date: d, mood: loadLocalEntry(d).mood })))
      }
      setLoaded(true)
    }
    load()
  }, [user, today])

  // Reflexão diária assistida: gera (uma vez por dia) uma pergunta
  // metacognitiva baseada nos dados do dia — com fallback offline
  useEffect(() => {
    if (!loaded || entry.reflectionQuestion) return
    let cancelled = false
    async function gen() {
      setReflectionLoading(true)
      const daily = user ? await getDaily(today) : null
      const habitsTotal = daily?.habits?.length ?? 0
      const habitsDone  = daily?.habits?.filter(h => h.done).length ?? 0
      const focusItems  = (daily?.focus ?? []).filter(f => f.text.trim())
      const focusTotal  = focusItems.length
      const focusDone   = focusItems.filter(f => f.done).length

      let question: string | null = null
      if (hasApiKey()) {
        question = await generateReflectionQuestion({
          habitsDone, habitsTotal, focusDone, focusTotal,
          mood: entry.mood, energy: entry.energy,
          userName: user?.displayName?.split(' ')[0],
        })
      }
      if (!question) question = fallbackReflectionQuestion(dateSeed(today))

      if (!cancelled) {
        setReflectionLoading(false)
        update({ reflectionQuestion: question })
      }
    }
    gen()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const persist = (next: MentalEntry) => {
    userStorage.setItem(`mental_${today}`, JSON.stringify(next))
    saveMental(today, next)
  }

  const update = (patch: Partial<MentalEntry>) => {
    setEntry(prev => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }

  const setMood = (mood: number) => {
    update({ mood })
    setHistory(h => h.map((d, i) => i === 6 ? { ...d, mood } : d))
    toast.success(`${MOODS[mood - 1]} Humor registrado: ${MOOD_LABELS[mood - 1]}`)
  }

  const setEnergy = (energy: number) => {
    update({ energy })
    toast.info(`⚡ Energia ${energy}/5 registrada`)
  }

  const setSleep = (sleepHours: number) => {
    update({ sleepHours })
    toast.success(`😴 Sono registrado: ${sleepHours}h`)
  }

  const setGratitude = (i: number, val: string) => {
    const g: [string, string, string] = [...entry.gratitude] as [string, string, string]
    g[i] = val
    update({ gratitude: g })
  }

  const saveNote = () => {
    persist(entry)
    setSavedNote(true)
    setTimeout(() => setSavedNote(false), 2000)
    toast.success('📝 Notas salvas!')
  }

  const saveReflection = () => {
    persist(entry)
    setSavedReflection(true)
    setTimeout(() => setSavedReflection(false), 2000)
    toast.success('🤔 Reflexão salva!')
  }

  const { recording, toggle: toggleRecording, supported: speechSupported } = useSpeechToText(transcript => {
    setEntry(prev => {
      const next = { ...prev, reflectionAnswer: prev.reflectionAnswer ? `${prev.reflectionAnswer} ${transcript}` : transcript }
      persist(next)
      return next
    })
  })

  const hasMood   = entry.mood > 0
  const hasEnergy = entry.energy > 0
  const hasSleep  = entry.sleepHours != null

  function sleepFeedback(hours: number): string {
    if (hours < 6) return 'Pouco sono — priorize descansar hoje'
    if (hours < 7) return 'Um pouco abaixo do ideal'
    if (hours <= 9) return 'Faixa ideal 💤'
    return 'Sono bem longo'
  }
  const weekAvg   = Math.round(history.filter(h => h.mood > 0).reduce((s, h) => s + h.mood, 0) / Math.max(history.filter(h => h.mood > 0).length, 1))
  const streak    = history.slice().reverse().findIndex(h => h.mood === 0)
  const streakDays = streak === -1 ? 7 : streak

  if (!loaded) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: T.text.lg }}>Carregando...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 22 : 26, fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><Brain size={20} color={C.orange} /> Mental</div>
        <div style={{ fontSize: T.text.md, color: C.muted }}>Bem-estar, humor e reflexão diária</div>
      </div>

      {/* Reflexão diária assistida por IA */}
      <Card style={{ marginBottom: 16, background: `${C.purple}0D`, border: `1px solid ${C.purple}33` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 10, ...displayStyle }}><PenLine size={17} /> Reflexão do dia</div>
        {reflectionLoading || !entry.reflectionQuestion ? (
          <div style={{ fontSize: T.text.md, color: C.muted }}>Pensando numa pergunta pra você...</div>
        ) : (
          <>
            <div style={{ fontSize: T.text.lg, color: C.text, lineHeight: 1.6, marginBottom: 12, fontStyle: 'italic' }}>
              "{entry.reflectionQuestion}"
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                value={entry.reflectionAnswer ?? ''}
                onChange={e => update({ reflectionAnswer: e.target.value })}
                placeholder="Escreva sua resposta... ou grave em áudio"
                rows={4}
                style={{ ...inp, resize: 'none', lineHeight: 1.6, paddingRight: 44 } as React.CSSProperties}
              />
              {speechSupported && (
                <button
                  onClick={toggleRecording}
                  title={recording ? 'Parar gravação' : 'Gravar resposta por voz'}
                  style={{
                    position: 'absolute', right: 8, bottom: 8, width: 32, height: 32, borderRadius: T.radius.sm,
                    background: recording ? C.red : C.card2, border: `1px solid ${recording ? C.red : C.border2}`,
                    color: recording ? '#fff' : C.muted, fontSize: T.text.lg, cursor: 'pointer',
                  }}
                >
                  {recording ? '⏹' : '🎤'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontSize: T.text.sm, color: C.muted }}>{recording ? '🔴 Ouvindo... fale livremente' : 'Sua resposta fica só com você'}</div>
              <button
                onClick={saveReflection}
                style={{ background: savedReflection ? C.green : C.card2, border: `1px solid ${savedReflection ? C.green : C.border2}`, borderRadius: T.radius.sm, padding: '6px 14px', fontSize: T.text.base, fontWeight: T.weight.semibold, color: savedReflection ? '#fff' : C.text, cursor: 'pointer', transition: 'all .2s' }}
              >
                {savedReflection ? '✓ Salvo!' : 'Salvar reflexão'}
              </button>
            </div>
          </>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* Left — check-in */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Mood */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 16, ...displayStyle }}><Smile size={17} /> Como você está hoje?</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              {MOODS.map((m, i) => (
                <div
                  key={i}
                  onClick={() => setMood(i + 1)}
                  style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: T.radius.md, cursor: 'pointer', background: entry.mood === i + 1 ? MOOD_COLORS[i] + '33' : C.card2, border: `2px solid ${entry.mood === i + 1 ? MOOD_COLORS[i] : C.border}`, transition: 'all .12s' }}
                >
                  <div style={{ fontSize: T.text['5xl'] }}>{m}</div>
                  <div style={{ fontSize: T.text['2xs'], color: entry.mood === i + 1 ? MOOD_COLORS[i] : C.muted, marginTop: 4, fontWeight: T.weight.semibold }}>{MOOD_LABELS[i]}</div>
                </div>
              ))}
            </div>
            {hasMood && (
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: T.text.md, color: MOOD_COLORS[entry.mood - 1], fontWeight: T.weight.bold }}>
                {MOODS[entry.mood - 1]} {MOOD_LABELS[entry.mood - 1]}
              </div>
            )}
          </Card>

          {/* Energy */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}><Zap size={17} /> Nível de energia</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <div
                  key={n}
                  onClick={() => setEnergy(n)}
                  style={{ flex: 1, padding: '12px 4px', textAlign: 'center', borderRadius: T.radius.md, cursor: 'pointer', background: entry.energy >= n ? `${C.orange}33` : C.card2, border: `2px solid ${entry.energy >= n ? C.orange : C.border}`, fontSize: T.text.md, fontWeight: T.weight.extrabold, color: entry.energy >= n ? C.orange : C.muted, transition: 'all .12s' }}
                >
                  {n}
                </div>
              ))}
            </div>
            {hasEnergy && (
              <div style={{ marginTop: 10, fontSize: T.text.base, color: C.muted, textAlign: 'center' }}>
                Energia: {entry.energy}/5 — {entry.energy <= 2 ? 'Descanse mais' : entry.energy <= 3 ? 'Razoável' : entry.energy <= 4 ? 'Boa energia' : 'No limite máximo! 🔥'}
              </div>
            )}
          </Card>

          {/* Sleep */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}><Moon size={17} /> Horas de sono</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[5, 6, 7, 8, 9, 10].map(h => (
                <div
                  key={h}
                  onClick={() => setSleep(h)}
                  style={{ flex: 1, padding: '10px 4px', textAlign: 'center', borderRadius: T.radius.md, cursor: 'pointer', background: entry.sleepHours === h ? `${C.blue}33` : C.card2, border: `2px solid ${entry.sleepHours === h ? C.blue : C.border}`, fontSize: T.text.md, fontWeight: T.weight.extrabold, color: entry.sleepHours === h ? C.blue : C.muted, transition: 'all .12s' }}
                >
                  {h}h
                </div>
              ))}
            </div>
            {hasSleep && (
              <div style={{ marginTop: 10, fontSize: T.text.base, color: C.muted, textAlign: 'center' }}>
                Sono: {entry.sleepHours}h — {sleepFeedback(entry.sleepHours!)}
              </div>
            )}
          </Card>

          <RecoveryCheckin entry={entry} onChange={update} today={today} />

          {/* Gratitude */}
          <Card>
            <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14 }}>🙏 3 coisas boas hoje</div>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                <span style={{ fontSize: T.text.md, color: C.orange, fontWeight: T.weight.extrabold, flexShrink: 0 }}>{i + 1}.</span>
                <input
                  type="text"
                  value={entry.gratitude[i]}
                  onChange={e => setGratitude(i, e.target.value)}
                  onBlur={() => { if (entry.gratitude[i]) toast.success(`🙏 Gratidão ${i + 1} registrada`) }}
                  placeholder={['Algo que me deixou feliz...', 'Algo pelo que sou grato...', 'Uma conquista de hoje...'][i]}
                  style={{ ...inp, fontSize: T.text.base }}
                />
              </div>
            ))}
          </Card>
        </div>

        {/* Right — notes + history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Notes */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 12, ...displayStyle }}><NotebookPen size={17} /> Notas do dia</div>
            <textarea
              value={entry.note}
              onChange={e => update({ note: e.target.value })}
              placeholder="Como foi seu dia? Reflexões, aprendizados, desafios..."
              rows={7}
              style={{ ...inp, resize: 'none', lineHeight: 1.6 } as React.CSSProperties}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontSize: T.text.sm, color: C.muted }}>{entry.note.length} caracteres</div>
              <button
                onClick={saveNote}
                style={{ background: savedNote ? C.green : C.card2, border: `1px solid ${savedNote ? C.green : C.border2}`, borderRadius: T.radius.sm, padding: '6px 14px', fontSize: T.text.base, fontWeight: T.weight.semibold, color: savedNote ? '#fff' : C.text, cursor: 'pointer', transition: 'all .2s' }}
              >
                {savedNote ? '✓ Salvo!' : 'Salvar notas'}
              </button>
            </div>
          </Card>

          {/* 7-day history */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}><TrendingUp size={17} /> Últimos 7 dias</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 12 }}>
              {history.map((h, i) => {
                const isToday = i === 6
                const col     = h.mood > 0 ? MOOD_COLORS[h.mood - 1] : C.border
                const ht      = h.mood > 0 ? h.mood * 14 + 10 : 8
                const days    = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
                const dow     = new Date(h.date + 'T12:00:00').getDay()
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: T.text.base }}>{h.mood > 0 ? MOODS[h.mood - 1] : '—'}</div>
                    <div style={{ width: '100%', height: ht, background: col, borderRadius: T.radius['2xs'], transition: 'height .3s', opacity: isToday ? 1 : 0.7 }} />
                    <div style={{ fontSize: T.text['2xs'], color: isToday ? C.text : C.muted, fontWeight: isToday ? 700 : 400 }}>{days[dow]}</div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <div style={{ background: C.card2, borderRadius: T.radius.sm, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: T.text['5xl'], marginBottom: 2 }}>{weekAvg > 0 ? MOODS[weekAvg - 1] : '—'}</div>
                <div style={{ fontSize: T.text.xs, color: C.muted }}>Humor médio</div>
              </div>
              <div style={{ background: C.card2, borderRadius: T.radius.sm, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: C.orange, ...displayStyle }}>{streakDays}</div>
                <div style={{ fontSize: T.text.xs, color: C.muted }}>dias consecutivos</div>
              </div>
            </div>
          </Card>

          {hasMood && entry.mood <= 2 && (
            <Card style={{ background: `${C.blue}11`, border: `1px solid ${C.blue}33` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.md, color: C.blue, marginBottom: 8, ...displayStyle }}><Lightbulb size={17} /> Dica para dias difíceis</div>
              <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.7 }}>
                Dias assim fazem parte. Tente uma caminhada curta, beba água e foque em 1 coisa pequena que você pode completar hoje.
              </div>
            </Card>
          )}
          {hasMood && entry.mood >= 4 && (
            <Card style={{ background: `${C.green}11`, border: `1px solid ${C.green}33` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.md, color: C.green, marginBottom: 8, ...displayStyle }}><Flame size={17} /> Ótimo momento!</div>
              <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.7 }}>
                Use essa energia para atacar suas prioridades mais importantes do dia.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
