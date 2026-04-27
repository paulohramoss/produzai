import { useState } from 'react'
import { C, type Page } from '../data'
import { Card, Tag } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'
import { useWebDietStore } from '../../store/useWebDietStore'

interface Props { connected: string[]; setPage: (p: Page) => void }

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const ACTIVITY_COLORS: Record<string, string> = { Corrida: '#FC4C02', Ciclismo: '#F97316', Atividade: '#60A5FA' }

function getWeekDates() {
  const today = new Date()
  const dow = today.getDay() || 7
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - dow + 1 + i)
    return d
  })
}

function activityDayIndex(dateStr: string): number {
  if (dateStr.startsWith('Hoje'))  return new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  if (dateStr.startsWith('Ontem')) { const d = new Date(); d.setDate(d.getDate()-1); return d.getDay() === 0 ? 6 : d.getDay() - 1 }
  const map: Record<string, number> = { 'Seg': 0, 'Ter': 1, 'Qua': 2, 'Qui': 3, 'Sex': 4, 'Sáb': 5, 'Dom': 6 }
  for (const [k, v] of Object.entries(map)) { if (dateStr.startsWith(k)) return v }
  return -1
}

export function Agenda({ connected, setPage }: Props) {
  const strava  = useStravaStore(s => s.data)
  const wd      = useWebDietStore(s => s.data)
  const weekDates = getWeekDates()
  const todayIdx  = (new Date().getDay() || 7) - 1
  const stravaOn  = connected.includes('strava')
  const wdOn      = connected.includes('webdiet')

  // Map strava activities to day index
  type ActivityList = NonNullable<typeof strava>['activities']
  const actsByDay: Record<number, ActivityList> = {}
  strava?.activities.forEach(a => {
    const idx = activityDayIndex(a.date)
    if (idx >= 0) { if (!actsByDay[idx]) actsByDay[idx] = []; actsByDay[idx].push(a) }
  })

  const meals = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))
  const [selectedDay, setSelectedDay] = useState(todayIdx)

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📅 Agenda</div>
        <div style={{ fontSize: 13, color: C.muted }}>Semana atual — treinos, refeições e eventos</div>
      </div>

      {/* Week strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 20 }}>
        {DAYS.map((day, i) => {
          const d     = weekDates[i]
          const acts  = actsByDay[i] ?? []
          const isToday = i === todayIdx
          const isSel   = i === selectedDay
          return (
            <div
              key={i}
              onClick={() => setSelectedDay(i)}
              style={{ background: isSel ? C.orange : isToday ? `${C.orange}22` : C.card, border: `1px solid ${isSel ? C.orange : isToday ? C.orange + '55' : C.border}`, borderRadius: 12, padding: '10px 8px', textAlign: 'center', cursor: 'pointer', transition: 'all .12s' }}
            >
              <div style={{ fontSize: 10, color: isSel ? '#000' : C.muted, fontWeight: 700, marginBottom: 4 }}>{day}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: isSel ? '#000' : isToday ? C.orange : C.text }}>{d.getDate()}</div>
              {/* Activity dots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 6 }}>
                {acts.slice(0, 3).map((a, j) => (
                  <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: ACTIVITY_COLORS[a.type] ?? C.blue }} />
                ))}
                {wdOn && meals.length > 0 && (
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.webdiet }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected day detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Activities */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🏃 Atividades — {DAYS[selectedDay]}</div>
            {stravaOn && <Tag label="Strava" color={C.strava} />}
          </div>
          {stravaOn ? (
            (actsByDay[selectedDay] ?? []).length > 0 ? (
              (actsByDay[selectedDay] ?? []).map((a, i) => (
                <div key={i} style={{ padding: '12px', background: C.card2, borderRadius: 10, marginBottom: 8, borderLeft: `3px solid ${ACTIVITY_COLORS[a.type] ?? C.blue}` }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{a.name}</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 800, color: C.strava }}>{a.dist}km</div><div style={{ fontSize: 9, color: C.muted }}>dist</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 800 }}>{a.pace}</div><div style={{ fontSize: 9, color: C.muted }}>pace</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>{a.cal}</div><div style={{ fontSize: 9, color: C.muted }}>kcal</div></div>
                    {a.hr > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 14, fontWeight: 800, color: C.pink }}>{a.hr}</div><div style={{ fontSize: 9, color: C.muted }}>bpm</div></div>}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 13, color: C.muted, padding: '20px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🏃</div>
                Nenhuma atividade registrada
              </div>
            )
          ) : (
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              <span onClick={() => setPage('integracoes')} style={{ color: C.orange, cursor: 'pointer' }}>Conectar Strava →</span>
            </div>
          )}
        </Card>

        {/* Meals schedule */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🥗 Plano alimentar — {DAYS[selectedDay]}</div>
            {wdOn && <Tag label="Manual" color={C.webdiet} />}
          </div>
          {wdOn && meals.length > 0 ? (
            meals.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 36, fontSize: 10, color: C.muted, flexShrink: 0 }}>{m.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{m.cal} kcal · P:{m.prot}g C:{m.carb}g G:{m.fat}g</div>
                </div>
                {selectedDay === todayIdx && (
                  <span style={{ fontSize: 10, color: m.done ? C.green : C.border2 }}>{m.done ? '✓' : '○'}</span>
                )}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              {wdOn
                ? <span onClick={() => setPage('dieta')} style={{ color: C.webdiet, cursor: 'pointer' }}>Adicionar refeições →</span>
                : <span onClick={() => setPage('integracoes')} style={{ color: C.orange, cursor: 'pointer' }}>Configurar dieta →</span>}
            </div>
          )}
        </Card>
      </div>

      {/* Week summary */}
      {(stravaOn && strava) && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📊 Resumo da semana</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { l: 'Km rodados',   v: `${strava.weekKm}km`,   c: C.strava },
              { l: 'Atividades',   v: strava.weekRuns,        c: C.blue },
              { l: 'Kcal queimadas', v: strava.weekCal,       c: C.red },
              { l: 'Elevação',     v: `${strava.weekElev}m`,  c: C.orange },
            ].map((k, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '10px', background: C.card2, borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{k.l}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
