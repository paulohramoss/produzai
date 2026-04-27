import { useState, useEffect } from 'react'
import { C, type Page } from '../data'
import { Card, Tag, Bar } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'
import { useWebDietStore } from '../../store/useWebDietStore'

interface Props { connected: string[]; setPage: (p: Page) => void }
interface Habit { id: string; icon: string; label: string; done: boolean }
interface FocusItem { id: string; text: string; done: boolean }

const DEFAULT_HABITS: Habit[] = [
  { id: 'agua',      icon: '💧', label: 'Água 3L',           done: false },
  { id: 'treino',    icon: '🏋', label: 'Treino',             done: false },
  { id: 'leitura',   icon: '📚', label: 'Leitura 30min',      done: false },
  { id: 'meditacao', icon: '🧘', label: 'Meditação 10min',    done: false },
  { id: 'sono',      icon: '😴', label: 'Dormir 22h30',       done: false },
  { id: 'proteina',  icon: '🥩', label: 'Meta de proteína',   done: false },
]

const DEFAULT_FOCUS: FocusItem[] = [
  { id: '1', text: '', done: false },
  { id: '2', text: '', done: false },
  { id: '3', text: '', done: false },
]

function loadLS<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback }
}

export function Hoje({ connected, setPage }: Props) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const strava   = useStravaStore(s => s.data)
  const wd       = useWebDietStore(s => s.data)

  const [habits, setHabits] = useState<Habit[]>(() =>
    loadLS(`habits_${todayKey}`, DEFAULT_HABITS.map(h => ({ ...h })))
  )
  const [focus, setFocus] = useState<FocusItem[]>(() =>
    loadLS(`focus_${todayKey}`, DEFAULT_FOCUS.map(f => ({ ...f })))
  )

  useEffect(() => { localStorage.setItem(`habits_${todayKey}`, JSON.stringify(habits)) }, [habits, todayKey])
  useEffect(() => { localStorage.setItem(`focus_${todayKey}`, JSON.stringify(focus)) }, [focus, todayKey])

  const toggleHabit = (id: string) =>
    setHabits(p => p.map(h => h.id === id ? { ...h, done: !h.done } : h))
  const toggleFocus = (id: string) =>
    setFocus(p => p.map(f => f.id === id ? { ...f, done: !f.done } : f))
  const updateFocus = (id: string, text: string) =>
    setFocus(p => p.map(f => f.id === id ? { ...f, text } : f))

  const doneHabits  = habits.filter(h => h.done).length
  const totalFocus  = focus.filter(f => f.text).length
  const doneFocus   = focus.filter(f => f.done && f.text).length
  const stravaOn    = connected.includes('strava')
  const wdOn        = connected.includes('webdiet')
  const lastAct     = strava?.activities[0]
  const meals       = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))
  const doneMeals   = meals.filter(m => m.done)
  const calEaten    = doneMeals.reduce((s, m) => s + m.cal, 0)
  const score       = Math.round(
    (doneHabits / habits.length) * 60 +
    (totalFocus > 0 ? doneFocus / totalFocus : 0) * 40
  )
  const today       = new Date()
  const dateStr     = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: C.muted, textTransform: 'capitalize' }}>{dateStr}</div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>☀️ Hoje</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ background: C.card2, borderRadius: 8, padding: '5px 11px', fontSize: 12 }}>
            🎯 {doneFocus}/{totalFocus || 3} foco
          </div>
          <div style={{ background: C.card2, borderRadius: 8, padding: '5px 11px', fontSize: 12 }}>
            ✅ {doneHabits}/{habits.length} hábitos
          </div>
          {wdOn && wd && (
            <div style={{ background: C.card2, borderRadius: 8, padding: '5px 11px', fontSize: 12 }}>
              🥗 {calEaten}/{wd.goals.cal} kcal
            </div>
          )}
          {stravaOn && strava && (
            <div style={{ background: C.card2, borderRadius: 8, padding: '5px 11px', fontSize: 12 }}>
              🏃 {strava.weekKm} km semana
            </div>
          )}
          {score > 0 && (
            <div style={{ background: `${C.orange}22`, borderRadius: 8, padding: '5px 11px', fontSize: 12, color: C.orange, fontWeight: 700 }}>
              ⚡ {score} pts
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: doneHabits === habits.length ? C.green : C.muted }}>
                {doneHabits}/{habits.length}
              </span>
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
          <Card style={{ borderTop: `2px solid ${stravaOn ? C.strava : C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🏃 Treino</div>
              {stravaOn ? <Tag label="Strava" color={C.strava} /> : <span onClick={() => setPage('integracoes')} style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}>+ Conectar</span>}
            </div>
            {stravaOn && lastAct ? (
              <div style={{ padding: '12px', background: C.card2, borderRadius: 10, borderLeft: `3px solid ${C.strava}` }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{lastAct.date}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{lastAct.name}</div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div><div style={{ fontSize: 15, fontWeight: 800, color: C.strava }}>{lastAct.dist}km</div><div style={{ fontSize: 10, color: C.muted }}>dist</div></div>
                  <div><div style={{ fontSize: 15, fontWeight: 800 }}>{lastAct.pace}</div><div style={{ fontSize: 10, color: C.muted }}>pace</div></div>
                  <div><div style={{ fontSize: 15, fontWeight: 800, color: C.red }}>{lastAct.cal}</div><div style={{ fontSize: 10, color: C.muted }}>kcal</div></div>
                  {lastAct.hr > 0 && <div><div style={{ fontSize: 15, fontWeight: 800, color: C.pink }}>{lastAct.hr}</div><div style={{ fontSize: 10, color: C.muted }}>bpm</div></div>}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '16px 0' }}>
                {stravaOn ? 'Nenhuma atividade recente' : 'Conecte o Strava para ver seus treinos'}
              </div>
            )}
          </Card>

          {/* Refeições */}
          <Card style={{ borderTop: `2px solid ${wdOn ? C.webdiet : C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🥗 Refeições</div>
              {wdOn ? <span style={{ fontSize: 12, color: C.muted }}>{doneMeals.length}/{meals.length} feitas</span> : <span onClick={() => setPage('integracoes')} style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}>+ Configurar</span>}
            </div>
            {wdOn && wd ? (
              meals.length > 0 ? (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <Bar pct={wd.goals.cal > 0 ? Math.min(Math.round(calEaten / wd.goals.cal * 100), 100) : 0} color={C.webdiet} h={4} />
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
                    <span onClick={() => setPage('dieta')} style={{ fontSize: 11, color: C.webdiet, cursor: 'pointer' }}>Ver dieta completa →</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '12px 0' }}>
                  <span onClick={() => setPage('dieta')} style={{ color: C.webdiet, cursor: 'pointer' }}>Adicionar refeições →</span>
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
        </div>
      </div>
    </div>
  )
}
