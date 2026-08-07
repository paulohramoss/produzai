import { useState, useEffect, useContext, useRef } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { Bell, Dumbbell, MessageSquare, Sun, Utensils, Zap } from 'lucide-react'
import { Card, Bar } from '../primitives'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { getDaily } from '../../lib/db'
import { toast } from '../../lib/toast'
import { LayoutContext } from '../LayoutContext'
import { DailyChecklist, type DailyChecklistHandle } from '../components/DailyChecklist'
import { computeScore, type Habit, type FocusItem } from '../../lib/dailyScore'
import { OneThingMode, type OneThing } from '../components/OneThingMode'
import { ReadinessCard } from '../components/ReadinessCard'
import {
  notificationsSupported, requestPermission, loadPrefs, savePrefs, applyPrefs,
  type NotifPrefs,
} from '../../lib/notifications'

interface Props { setPage: (p: Page) => void }

export function Hoje({ setPage }: Props) {
  const todayKey   = new Date().toISOString().slice(0, 10)
  const wd         = useWebDietStore(s => s.data)
  const user       = useAuthStore(s => s.user)
  const habitDefs  = useHabitsStore(s => s.defs)
  const { isMobile } = useContext(LayoutContext)

  const [habits,        setHabits]        = useState<Habit[]>([])
  const [focus,         setFocus]         = useState<FocusItem[]>([])
  const [notifPrefs,    setNotifPrefs]    = useState<NotifPrefs>(loadPrefs)
  const [missedYesterday, setMissedYesterday] = useState<Habit[]>([])
  const [showMissed,    setShowMissed]    = useState(true)
  const [oneThingOpen,  setOneThingOpen]  = useState(false)
  const checklistRef = useRef<DailyChecklistHandle>(null)

  // Apply saved notification schedule on mount
  useEffect(() => {
    if (notifPrefs.enabled) applyPrefs(notifPrefs)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lembrete gentil: hábitos que ficaram pra depois ontem, com o "porquê"
  useEffect(() => {
    async function loadYesterday() {
      if (!user) return
      const yKey = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const cloud = await getDaily(yKey)
      if (!cloud?.habits) { setMissedYesterday([]); return }
      const missed = cloud.habits
        .filter(h => !h.done)
        .map(h => ({ ...h, why: habitDefs.find(d => d.id === h.id)?.why }))
      setMissedYesterday(missed)
    }
    loadYesterday()
  }, [user, todayKey, habitDefs])

  // Modo "uma coisa": próxima ação mais importante — primeiro foco pendente,
  // senão o primeiro hábito pendente, senão tudo concluído
  function nextThing(): OneThing {
    const f = focus.find(x => x.text.trim() && !x.done)
    if (f) return { kind: 'focus', id: f.id, icon: '🎯', text: f.text }
    const h = habits.find(x => !x.done)
    if (h) return { kind: 'habit', id: h.id, icon: h.icon, text: h.label, why: h.why }
    return { kind: 'done', id: '', icon: '🎉', text: '' }
  }

  function handleOneThingComplete(kind: 'focus' | 'habit', id: string) {
    if (kind === 'focus') checklistRef.current?.toggleFocus(id)
    else checklistRef.current?.toggleHabit(id)
  }

  const doneHabits = habits.filter(h => h.done).length
  const totalFocus = focus.filter(f => f.text).length
  const doneFocus  = focus.filter(f => f.done && f.text).length
  const meals      = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))
  const doneMeals  = meals.filter(m => m.done)
  const calEaten   = doneMeals.reduce((s, m) => s + m.cal, 0)
  const score      = computeScore(habits, focus)
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
          {wd && (
            <div style={{ background: C.card2, borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base }}>
              🥗 {calEaten}/{wd.goals.cal} kcal
            </div>
          )}
          {score > 0 && (
            <div style={{ background: `${C.orange}22`, borderRadius: T.radius.sm, padding: '5px 11px', fontSize: T.text.base, color: C.orange, fontWeight: T.weight.bold }}>
              ⚡ {score} pts
            </div>
          )}
        </div>
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
            onStateChange={s => { setHabits(s.habits); setFocus(s.focus) }}
          />
        </div>

        {/* ── Right ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <ReadinessCard onOpenMental={() => setPage('mental')} />

          {/* Treino hoje */}
          <Card onClick={() => setPage('treino')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}><Dumbbell size={17} /> Treino</div>
              <span onClick={e => { e.stopPropagation(); setPage('treino') }} style={{ fontSize: T.text.sm, color: C.orange, cursor: 'pointer' }}>+ Registrar</span>
            </div>
            <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '16px 0' }}>
              Clique para registrar seu treino de hoje
            </div>
          </Card>

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

          {/* Notificações */}
          {notificationsSupported() && (
            <Card style={{ border: `1px solid ${notifPrefs.enabled ? C.blue + '44' : C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: notifPrefs.enabled ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, ...displayStyle }}><Bell size={17} /> Lembrete diário</div>
                <button
                  onClick={async () => {
                    if (!notifPrefs.enabled) {
                      const perm = await requestPermission()
                      if (perm !== 'granted') { toast.error('Permissão de notificação negada'); return }
                    }
                    const next = { ...notifPrefs, enabled: !notifPrefs.enabled }
                    setNotifPrefs(next)
                    savePrefs(next)
                    applyPrefs(next)
                    toast.success(next.enabled ? '🔔 Lembrete ativado!' : '🔕 Lembrete desativado')
                  }}
                  style={{
                    background: notifPrefs.enabled ? C.blue : C.card2,
                    border: `1px solid ${notifPrefs.enabled ? C.blue : C.border2}`,
                    borderRadius: T.radius.xs, padding: '4px 10px', fontSize: T.text.sm, fontWeight: T.weight.bold,
                    color: notifPrefs.enabled ? '#fff' : C.muted, cursor: 'pointer',
                  }}
                >
                  {notifPrefs.enabled ? 'Ativo' : 'Ativar'}
                </button>
              </div>
              {notifPrefs.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: T.text.base, color: C.muted }}>Horário:</span>
                  <input
                    type="time"
                    value={`${String(notifPrefs.hour).padStart(2, '0')}:${String(notifPrefs.minute).padStart(2, '0')}`}
                    onChange={e => {
                      const [h, m] = e.target.value.split(':').map(Number)
                      const next = { ...notifPrefs, hour: h, minute: m }
                      setNotifPrefs(next)
                      savePrefs(next)
                      applyPrefs(next)
                    }}
                    style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '5px 8px', color: C.text, fontSize: T.text.md, outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
