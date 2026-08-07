import { useState, useEffect, useContext, useRef } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { MessageSquare, Sun, Utensils, Zap } from 'lucide-react'
import { Card, Bar } from '../primitives'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { getDaily, getDailyHistory, type DailyData, type ReadinessEntry } from '../../lib/db'
import { LayoutContext } from '../LayoutContext'
import { DailyChecklist, type DailyChecklistHandle } from '../components/DailyChecklist'
import { computeScore, type Habit, type FocusItem } from '../../lib/dailyScore'
import { todayKey as localTodayKey, yesterdayKey, lastNDays } from '../../lib/date'
import { ReadinessCard } from '../components/ReadinessCard'
import { StreakCard } from '../components/StreakCard'
import { NextSessionCard } from '../components/NextSessionCard'
import { computeDayStreak, pendingIdsFor } from '../../lib/streaks'
import { OneThingMode, type OneThing } from '../components/OneThingMode'
import { RemindersCard } from '../components/RemindersCard'
import { WaterCard } from '../components/WaterCard'
import { CycleCard } from '../components/CycleCard'
import { formatLiters } from '../../lib/hydration'
import { useReminderPrefs, useReminderScheduler } from '../../lib/useReminders'

interface Props { setPage: (p: Page) => void }

/** Janela de histórico usada pelas sequências — cobre streaks longas sem pesar. */
const STREAK_WINDOW_DAYS = 60

export function Hoje({ setPage }: Props) {
  const todayKey   = localTodayKey()
  const wd         = useWebDietStore(s => s.data)
  const user       = useAuthStore(s => s.user)
  const habitDefs  = useHabitsStore(s => s.defs)
  const { isMobile } = useContext(LayoutContext)

  const [habits,        setHabits]        = useState<Habit[]>([])
  const [focus,         setFocus]         = useState<FocusItem[]>([])
  const [missedYesterday, setMissedYesterday] = useState<Habit[]>([])
  const [showMissed,    setShowMissed]    = useState(true)
  const [oneThingOpen,  setOneThingOpen]  = useState(false)
  const [readiness,     setReadiness]     = useState<ReadinessEntry | null>(null)
  const [history,       setHistory]       = useState<Record<string, DailyData>>({})
  const [historyLoading, setHistoryLoading] = useState(true)
  const [waterMl,       setWaterMl]       = useState(0)
  const checklistRef = useRef<DailyChecklistHandle>(null)

  const [reminderPrefs, setReminderPrefs] = useReminderPrefs(user?.uid)

  // Lembrete gentil: hábitos que ficaram pra depois ontem, com o "porquê"
  useEffect(() => {
    async function loadYesterday() {
      if (!user) return
      const yKey = yesterdayKey()
      const cloud = await getDaily(yKey)
      if (!cloud?.habits) { setMissedYesterday([]); return }
      const missed = cloud.habits
        .filter(h => !h.done)
        .map(h => ({ ...h, why: habitDefs.find(d => d.id === h.id)?.why }))
      setMissedYesterday(missed)
    }
    loadYesterday()
  }, [user, todayKey, habitDefs])

  // Histórico dos últimos 60 dias: alimenta as sequências e traz a prontidão de hoje.
  useEffect(() => {
    async function load() {
      if (!user) { setHistoryLoading(false); return }
      const days = await getDailyHistory(lastNDays(STREAK_WINDOW_DAYS))
      setHistory(days)
      setReadiness(days[todayKey]?.readiness ?? null)
      setHistoryLoading(false)
    }
    load()
  }, [user, todayKey])

  // O checklist é a fonte viva do dia: espelhamos no histórico para a sequência
  // reagir na hora em que o hábito é marcado, sem esperar uma nova leitura.
  function syncHistoryToday(next: Habit[]) {
    setHistory(prev => ({ ...prev, [todayKey]: { ...prev[todayKey], habits: next } }))
  }

  // Modo "uma coisa": próxima ação mais importante — primeiro foco pendente,
  // senão o primeiro hábito pendente, senão tudo concluído
  function nextThing(): OneThing {
    const f = focus.find(x => x.text.trim() && !x.done)
    if (f) return { kind: 'focus', id: f.id, icon: '🎯', text: f.text }
    const h = habits.find(x => !x.done && pendingIds.has(x.id))
    if (h) return { kind: 'habit', id: h.id, icon: h.icon, text: h.label, why: h.why }
    return { kind: 'done', id: '', icon: '🎉', text: '' }
  }

  function handleOneThingComplete(kind: 'focus' | 'habit', id: string) {
    if (kind === 'focus') checklistRef.current?.toggleFocus(id)
    else checklistRef.current?.toggleHabit(id)
  }

  // Hábito de frequência com a meta da semana já batida não é pendência hoje —
  // é justamente o dia de descanso planejado.
  const pendingIds = pendingIdsFor(habitDefs, history, todayKey)
  const dayStreak = computeDayStreak(habitDefs, history)

  const doneHabits = habits.filter(h => h.done).length
  const totalFocus = focus.filter(f => f.text).length
  const doneFocus  = focus.filter(f => f.done && f.text).length
  const meals      = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))
  const doneMeals  = meals.filter(m => m.done)
  const waterGoalMl = useWebDietStore(s => s.waterGoalMl)

  // O agendador consulta este estado na hora do disparo: um lembrete de hábito
  // já marcado, ou de sequência num dia já fechado, não chega a tocar.
  useReminderScheduler(
    reminderPrefs,
    habitDefs.map(d => ({ id: d.id, icon: d.icon, label: d.label })),
    todayKey,
    () => ({
      pendingHabitIds: habits.filter(h => !h.done && pendingIds.has(h.id)).map(h => h.id),
      anythingLogged: habits.some(h => h.done)
        || focus.some(f => f.done && f.text.trim())
        || readiness !== null,
      streakDays: dayStreak.count,
      dayComplete: dayStreak.todayComplete,
    }),
  )
  const calEaten   = doneMeals.reduce((s, m) => s + m.cal, 0)
  const score      = computeScore(habits, focus, pendingIds)
  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
    {oneThingOpen && (
      <OneThingMode
        thing={nextThing()}
        onComplete={handleOneThingComplete}
        onClose={() => setOneThingOpen(false)}
      />
    )}
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: T.text.md, color: C.muted, textTransform: 'capitalize' }}>{dateStr}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 22 : 26, fontWeight: T.weight.extrabold, ...displayStyle }}><Sun size={20} color={C.orange} /> Hoje</div>
          </div>
          <button
            onClick={() => setOneThingOpen(true)}
            style={{
              background: `${C.orange}18`, border: `1px solid ${C.orange}44`, borderRadius: T.radius.md,
              padding: isMobile ? '8px 12px' : '9px 14px', fontSize: T.text.base, fontWeight: T.weight.bold,
              color: C.orange, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            🎯 Uma coisa
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ background: C.card2, borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base }}>
            🎯 {doneFocus}/{totalFocus || 3} foco
          </div>
          <div style={{ background: C.card2, borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base }}>
            ✅ {doneHabits}/{habits.length} hábitos
          </div>
          {dayStreak.count > 0 && (
            <div style={{ background: `${C.orange}22`, borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base, color: C.orange, fontWeight: T.weight.bold }}>
              🔥 {dayStreak.count} {dayStreak.count === 1 ? 'dia' : 'dias'}
            </div>
          )}
          {wd && (
            <div style={{ background: C.card2, borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base }}>
              🥗 {calEaten}/{wd.goals.cal} kcal
            </div>
          )}
          <div style={{
            background: waterMl >= waterGoalMl && waterMl > 0 ? `${C.green}22` : C.card2,
            borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base,
            color: waterMl >= waterGoalMl && waterMl > 0 ? C.green : undefined,
            fontWeight: waterMl >= waterGoalMl && waterMl > 0 ? T.weight.bold : undefined,
          }}>
            💧 {formatLiters(waterMl)}/{formatLiters(waterGoalMl)}L
          </div>
          {score > 0 && (
            <div style={{ background: `${C.orange}22`, borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base, color: C.orange, fontWeight: T.weight.bold }}>
              ⚡ {score} pts
            </div>
          )}
        </div>
      </div>

      {/* Prontidão: primeira coisa do dia, antes de decidir o treino */}
      <div style={{ marginBottom: 16 }}>
        <ReadinessCard entry={readiness} onSaved={setReadiness} />
      </div>

      {/* Lembrete gentil: o que ficou pra depois ontem */}
      {missedYesterday.length > 0 && showMissed && (
        <Card style={{ marginBottom: 16, background: `${C.blue}0D`, border: `1px solid ${C.blue}33` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, ...displayStyle }}><MessageSquare size={17} /> Ontem ficou pra depois</div>
            <button
              onClick={() => setShowMissed(false)}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: T.text['2xl'], cursor: 'pointer', lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missedYesterday.map(h => (
              <div key={h.id}>
                <div style={{ fontSize: T.text.md }}>{h.icon} {h.label}</div>
                {h.why && <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 2, paddingLeft: 22, lineHeight: 1.5 }}>{h.why}</div>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
            Sem cobrança — só um lembrete do que importa pra você. Hoje é uma nova chance.
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* ── Left ── */}
        <div>
          <DailyChecklist
            ref={checklistRef}
            date={todayKey}
            editable
            onStateChange={s => { setHabits(s.habits); setFocus(s.focus); syncHistoryToday(s.habits) }}
          />
        </div>

        {/* ── Right ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <StreakCard defs={habitDefs} history={history} loading={historyLoading} />

          {/* Água: o gesto mais repetido do dia mora no check-in, não na Dieta */}
          <WaterCard onChange={setWaterMl} />

          {/* Ciclo — só renderiza quando a usuária ligou o acompanhamento */}
          <CycleCard />

          {/* Próximo treino do plano */}
          <NextSessionCard setPage={setPage} />

          {/* Refeições */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}><Utensils size={17} /> Refeições</div>
              {wd
                ? <span style={{ fontSize: T.text.base, color: C.muted }}>{doneMeals.length}/{meals.length} feitas</span>
                : <span onClick={() => setPage('dieta')} style={{ fontSize: T.text.sm, color: C.orange, cursor: 'pointer' }}>+ Configurar</span>
              }
            </div>
            {wd ? (
              meals.length > 0 ? (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <Bar pct={wd.goals.cal > 0 ? Math.min(Math.round(calEaten / wd.goals.cal * 100), 100) : 0} color={C.green} h={4} />
                    <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 4 }}>{calEaten} / {wd.goals.cal} kcal</div>
                  </div>
                  {meals.slice(0, 5).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: T.text.xs, color: C.muted, minWidth: 36 }}>{m.time}</span>
                      <span style={{ flex: 1, fontSize: T.text.base, color: m.done ? C.muted : C.text, textDecoration: m.done ? 'line-through' : 'none' }}>{m.name}</span>
                      <span style={{ fontSize: T.text.xs, fontWeight: T.weight.bold, color: m.done ? C.green : C.muted }}>{m.done ? '✓' : `${m.cal}kcal`}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <span onClick={() => setPage('dieta')} style={{ fontSize: T.text.sm, color: C.green, cursor: 'pointer' }}>Ver dieta completa →</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '12px 0' }}>
                  <span onClick={() => setPage('dieta')} style={{ color: C.green, cursor: 'pointer' }}>Adicionar refeições →</span>
                </div>
              )
            ) : (
              <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '16px 0' }}>Configure sua dieta para ver as refeições</div>
            )}
          </Card>

          {/* Score */}
          {score > 0 && (
            <Card style={{ background: `${C.orange}0D`, border: `1px solid ${C.orange}33` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}><Zap size={17} /> Score do dia</div>
                  <div style={{ fontSize: T.text.base, color: C.muted }}>Hábitos 60% · Foco 40%</div>
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, color: C.orange }}>{score}</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <Bar pct={score} color={C.orange} h={5} />
              </div>
            </Card>
          )}

          <RemindersCard prefs={reminderPrefs} onChange={setReminderPrefs} />
        </div>
      </div>
    </div>
  )
}
