import { useState, useEffect, useContext } from 'react'
import { C, type Page } from '../data'
import { Card, Bar } from '../primitives'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useHabitsStore } from '../../store/useHabitsStore'
import { getDaily, saveDaily } from '../../lib/db'
import { toast } from '../../lib/toast'
import { LayoutContext } from '../LayoutContext'
import { HabitosModal } from '../components/HabitosModal'
import {
  notificationsSupported, requestPermission, loadPrefs, savePrefs, applyPrefs,
  type NotifPrefs,
} from '../../lib/notifications'

interface Props { setPage: (p: Page) => void }
interface Habit { id: string; icon: string; label: string; done: boolean }
interface FocusItem { id: string; text: string; done: boolean }

const DEFAULT_FOCUS: FocusItem[] = [
  { id: '1', text: '', done: false },
  { id: '2', text: '', done: false },
  { id: '3', text: '', done: false },
]

export function Hoje({ setPage }: Props) {
  const todayKey   = new Date().toISOString().slice(0, 10)
  const wd         = useWebDietStore(s => s.data)
  const user       = useAuthStore(s => s.user)
  const habitDefs  = useHabitsStore(s => s.defs)
  const { isMobile } = useContext(LayoutContext)

  const [habits,       setHabits]       = useState<Habit[]>([])
  const [focus,        setFocus]        = useState<FocusItem[]>(DEFAULT_FOCUS.map(f => ({ ...f })))
  const [loaded,       setLoaded]       = useState(false)
  const [managingHabits, setManagingHabits] = useState(false)
  const [notifPrefs,   setNotifPrefs]   = useState<NotifPrefs>(loadPrefs)

  // Apply saved notification schedule on mount
  useEffect(() => {
    if (notifPrefs.enabled) applyPrefs(notifPrefs)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carrega do Firestore (ou localStorage como fallback)
  useEffect(() => {
    async function load() {
      // Base state: habit defs + all done=false
      const baseHabits = habitDefs.map(d => ({ ...d, done: false }))

      let savedHabits: Habit[] | null = null
      let savedFocus:  FocusItem[] | null = null

      if (user) {
        const cloud = await getDaily(todayKey)
        if (cloud?.habits) savedHabits = cloud.habits
        if (cloud?.focus)  savedFocus  = cloud.focus
      }

      // Fallback para localStorage
      if (!savedHabits) {
        try {
          const r = localStorage.getItem(`habits_${todayKey}`)
          if (r) savedHabits = JSON.parse(r)
        } catch { /* silent */ }
      }
      if (!savedFocus) {
        try {
          const f = localStorage.getItem(`focus_${todayKey}`)
          if (f) savedFocus = JSON.parse(f)
        } catch { /* silent */ }
      }

      // Merge: usa as defs atuais mas preserva o estado done
      const doneMap: Record<string, boolean> = {}
      ;(savedHabits ?? []).forEach(h => { doneMap[h.id] = h.done })
      setHabits(baseHabits.map(h => ({ ...h, done: doneMap[h.id] ?? false })))
      setFocus(savedFocus ?? DEFAULT_FOCUS.map(f => ({ ...f })))
      setLoaded(true)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, todayKey, habitDefs])

  function persistDaily(h: Habit[], f: FocusItem[]) {
    localStorage.setItem(`habits_${todayKey}`, JSON.stringify(h))
    localStorage.setItem(`focus_${todayKey}`, JSON.stringify(f))
    saveDaily(todayKey, { habits: h, focus: f })
  }

  const toggleHabit = (id: string) => {
    const next = habits.map(h => h.id === id ? { ...h, done: !h.done } : h)
    setHabits(next)
    persistDaily(next, focus)
    const h = next.find(x => x.id === id)
    if (h?.done) toast.success(`${h.icon} ${h.label} concluído!`)
  }

  const toggleFocus = (id: string) => {
    const next = focus.map(f => f.id === id ? { ...f, done: !f.done } : f)
    setFocus(next)
    persistDaily(habits, next)
    const f = next.find(x => x.id === id)
    if (f?.done && f.text) toast.success(`🎯 "${f.text}" concluído!`)
  }

  const updateFocus = (id: string, text: string) => {
    const next = focus.map(f => f.id === id ? { ...f, text } : f)
    setFocus(next)
    persistDaily(habits, next)
  }

  const doneHabits = habits.filter(h => h.done).length
  const totalFocus = focus.filter(f => f.text).length
  const doneFocus  = focus.filter(f => f.done && f.text).length
  const meals      = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))
  const doneMeals  = meals.filter(m => m.done)
  const calEaten   = doneMeals.reduce((s, m) => s + m.cal, 0)
  const score      = Math.round(
    (doneHabits / habits.length) * 60 +
    (totalFocus > 0 ? doneFocus / totalFocus : 0) * 40
  )
  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted, fontSize: 14 }}>
        Carregando...
      </div>
    )
  }

  return (
    <div>
    {managingHabits && <HabitosModal onClose={() => setManagingHabits(false)} />}
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: C.muted, textTransform: 'capitalize' }}>{dateStr}</div>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800 }}>☀️ Hoje</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ background: C.card2, borderRadius: 8, padding: '5px 11px', fontSize: 12 }}>
            🎯 {doneFocus}/{totalFocus || 3} foco
          </div>
          <div style={{ background: C.card2, borderRadius: 8, padding: '5px 11px', fontSize: 12 }}>
            ✅ {doneHabits}/{habits.length} hábitos
          </div>
          {wd && (
            <div style={{ background: C.card2, borderRadius: 8, padding: '5px 11px', fontSize: 12 }}>
              🥗 {calEaten}/{wd.goals.cal} kcal
            </div>
          )}
          {score > 0 && (
            <div style={{ background: `${C.orange}22`, borderRadius: 8, padding: '5px 11px', fontSize: 12, color: C.orange, fontWeight: 700 }}>
              ⚡ {score} pts
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* ── Left ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Focus */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🎯 Foco do dia</div>
            {focus.map((f, i) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < focus.length - 1 ? 12 : 0 }}>
                <div
                  onClick={() => f.text && toggleFocus(f.id)}
                  style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${f.done ? C.orange : C.border2}`, background: f.done ? C.orange : 'transparent', flexShrink: 0, cursor: f.text ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {f.done && <span style={{ fontSize: 10, color: '#000', fontWeight: 900 }}>✓</span>}
                </div>
                <input
                  type="text"
                  value={f.text}
                  onChange={e => updateFocus(f.id, e.target.value)}
                  placeholder={`Prioridade ${i + 1}...`}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: f.done ? C.muted : C.text, fontSize: 13, textDecoration: f.done ? 'line-through' : 'none', padding: 0 }}
                />
              </div>
            ))}
          </Card>

          {/* Hábitos */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>✅ Hábitos</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setManagingHabits(true)}
                  style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: 6, padding: '3px 8px', fontSize: 10, color: C.muted, cursor: 'pointer', fontWeight: 600 }}
                >
                  ⚙ Editar
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: doneHabits === habits.length ? C.green : C.muted }}>
                  {doneHabits}/{habits.length}
                </span>
              </div>
            </div>
            <Bar pct={Math.round(doneHabits / habits.length * 100)} color={C.green} h={4} />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {habits.map(h => (
                <div
                  key={h.id}
                  onClick={() => toggleHabit(h.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: h.done ? `${C.green}11` : C.card2, borderRadius: 8, cursor: 'pointer', border: `1px solid ${h.done ? C.green + '44' : C.border}`, transition: 'all .12s' }}
                >
                  <span style={{ fontSize: 15 }}>{h.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, color: h.done ? C.muted : C.text, textDecoration: h.done ? 'line-through' : 'none' }}>{h.label}</span>
                  <span style={{ color: h.done ? C.green : C.border2, fontSize: 14 }}>{h.done ? '✓' : '○'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Right ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Treino hoje */}
          <Card onClick={() => setPage('treino')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🏋 Treino</div>
              <span onClick={e => { e.stopPropagation(); setPage('treino') }} style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}>+ Registrar</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '16px 0' }}>
              Clique para registrar seu treino de hoje
            </div>
          </Card>

          {/* Refeições */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🥗 Refeições</div>
              {wd
                ? <span style={{ fontSize: 12, color: C.muted }}>{doneMeals.length}/{meals.length} feitas</span>
                : <span onClick={() => setPage('dieta')} style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}>+ Configurar</span>
              }
            </div>
            {wd ? (
              meals.length > 0 ? (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <Bar pct={wd.goals.cal > 0 ? Math.min(Math.round(calEaten / wd.goals.cal * 100), 100) : 0} color={C.green} h={4} />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{calEaten} / {wd.goals.cal} kcal</div>
                  </div>
                  {meals.slice(0, 5).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, color: C.muted, minWidth: 36 }}>{m.time}</span>
                      <span style={{ flex: 1, fontSize: 12, color: m.done ? C.muted : C.text, textDecoration: m.done ? 'line-through' : 'none' }}>{m.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: m.done ? C.green : C.muted }}>{m.done ? '✓' : `${m.cal}kcal`}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <span onClick={() => setPage('dieta')} style={{ fontSize: 11, color: C.green, cursor: 'pointer' }}>Ver dieta completa →</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '12px 0' }}>
                  <span onClick={() => setPage('dieta')} style={{ color: C.green, cursor: 'pointer' }}>Adicionar refeições →</span>
                </div>
              )
            ) : (
              <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '16px 0' }}>Configure sua dieta para ver as refeições</div>
            )}
          </Card>

          {/* Score */}
          {score > 0 && (
            <Card style={{ background: `${C.orange}0D`, border: `1px solid ${C.orange}33` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⚡ Score do dia</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Hábitos 60% · Foco 40%</div>
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
                <div style={{ fontWeight: 700, fontSize: 14 }}>🔔 Lembrete diário</div>
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
                    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                    color: notifPrefs.enabled ? '#fff' : C.muted, cursor: 'pointer',
                  }}
                >
                  {notifPrefs.enabled ? 'Ativo' : 'Ativar'}
                </button>
              </div>
              {notifPrefs.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>Horário:</span>
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
                    style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 6, padding: '5px 8px', color: C.text, fontSize: 13, outline: 'none', colorScheme: 'dark' }}
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
