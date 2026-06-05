import { useState } from 'react'
import { C, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'
import { useWorkoutStore } from '../../store/useWorkoutStore'

interface Props {
  connected: string[]
  setPage: (page: Page) => void
}

const ACTIVITY_TYPES = ['Corrida', 'Caminhada', 'Academia', 'Ciclismo', 'Natação', 'Futebol', 'Outro']

const DEFAULT_NAMES: Record<string, string> = {
  Corrida: 'Corrida matinal',
  Caminhada: 'Caminhada',
  Academia: 'Treino na academia',
  Ciclismo: 'Pedal',
  Natação: 'Natação',
  Futebol: 'Futebol',
  Outro: 'Atividade',
}

function typeColor(type: string): string {
  switch (type) {
    case 'Corrida':  return C.strava
    case 'Caminhada': return C.green
    case 'Academia': return C.purple
    case 'Ciclismo': return C.orange
    case 'Natação':  return C.blue
    case 'Futebol':  return C.green
    default:         return C.muted2
  }
}

function friendlyDate(raw: string): string {
  const [y, m, d] = raw.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${days[date.getDay()]} ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
}

function calcPace(durationMin: number, distKm: number): string {
  if (distKm <= 0) return '—'
  const minPerKm = durationMin / distKm
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}

function formatDuration(durationMin: number): string {
  const h = Math.floor(durationMin / 60)
  const m = durationMin % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m}min`
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.card2,
  border: `1px solid ${C.border2}`,
  borderRadius: 8,
  padding: '10px 12px',
  color: C.text,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  display: 'block',
  marginBottom: 6,
}

type DisplayActivity = {
  id: string
  source: 'strava' | 'manual'
  type: string
  name: string
  date: string
  dist: number
  pace: string
  time: string
  cal: number
  hr: number
}

export function Treino({ connected, setPage }: Props) {
  const stravaOn = connected.includes('strava')
  const strava = useStravaStore(s => s.data)
  const stravaLoading = useStravaStore(s => s.loading)
  const { workouts, add, remove } = useWorkoutStore()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    type: 'Corrida',
    name: '',
    date: new Date().toISOString().split('T')[0],
    durationMin: '',
    dist: '',
    cal: '',
    hr: '',
  })

  const monthPct = strava ? Math.round((strava.monthKm / strava.monthGoal) * 100) : 0

  // Weekly manual stats
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    d.setHours(0, 0, 0, 0)
    return d
  })()

  const weekManual = workouts.filter(w => {
    const [y, m, d] = w.rawDate.split('-').map(Number)
    return new Date(y, m - 1, d) >= weekStart
  })
  const manualWeekKm    = Math.round(weekManual.reduce((s, w) => s + w.dist, 0) * 10) / 10
  const manualWeekCal   = weekManual.reduce((s, w) => s + w.cal, 0)
  const manualWeekCount = weekManual.length

  // Merged activity list (manual first, then strava)
  const allActivities: DisplayActivity[] = [
    ...workouts.map(w => ({ ...w, source: 'manual' as const })),
    ...(strava?.activities || []).map((a, i) => ({ ...a, id: `s${i}`, source: 'strava' as const })),
  ].slice(0, 6)

  function openModal() {
    setForm({ type: 'Corrida', name: '', date: new Date().toISOString().split('T')[0], durationMin: '', dist: '', cal: '', hr: '' })
    setShowModal(true)
  }

  function handleSubmit() {
    const durationMin = parseInt(form.durationMin)
    if (!durationMin || durationMin <= 0) return
    const distKm = parseFloat(form.dist) || 0
    add({
      type: form.type,
      name: form.name.trim() || DEFAULT_NAMES[form.type] || 'Atividade',
      rawDate: form.date,
      date: friendlyDate(form.date),
      dist: distKm,
      pace: calcPace(durationMin, distKm),
      time: formatDuration(durationMin),
      cal: parseInt(form.cal) || 0,
      hr: parseInt(form.hr) || 0,
      elev: 0,
    })
    setShowModal(false)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🏋 Treino</div>
          <div style={{ fontSize: 13, color: C.muted }}>Performance física — força + cardio</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={openModal}
            style={{ background: C.purple, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Registrar treino
          </button>
          {stravaOn
            ? <Tag label="🔴 Strava conectado" color={C.strava} />
            : <button onClick={() => setPage('integracoes')} style={{ background: C.strava, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Conectar Strava</button>
          }
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          {
            l: 'Km semana',
            v: stravaLoading ? '...' : stravaOn && strava ? `${strava.weekKm}km` : manualWeekKm > 0 ? `${manualWeekKm}km` : '—',
            sub: stravaOn && strava ? `${strava.weekRuns} atividades` : manualWeekCount > 0 ? `${manualWeekCount} registros` : 'Sem atividades',
            c: C.strava,
          },
          {
            l: 'Kcal semana',
            v: stravaLoading ? '...' : stravaOn && strava ? strava.weekCal : manualWeekCal > 0 ? manualWeekCal : '—',
            sub: stravaOn ? 'via Strava' : manualWeekCal > 0 ? 'registros manuais' : '—',
            c: C.red,
          },
          {
            l: 'Elevação',
            v: stravaLoading ? '...' : stravaOn && strava ? `${strava.weekElev}m` : '—',
            sub: stravaOn ? 'ganho semanal' : '—',
            c: C.orange,
          },
          {
            l: 'PR 10km',
            v: stravaLoading ? '...' : stravaOn && strava ? strava.pr10k : '—',
            sub: stravaOn ? 'recorde pessoal' : '—',
            c: C.blue,
          },
        ].map((k, i) => (
          <Card key={i}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c, marginBottom: 4 }}>{k.v}</div>
            <div style={{ fontSize: 11, color: C.muted2 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* Activities */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Atividades recentes</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {stravaOn && <Tag label="Strava" color={C.strava} />}
              {workouts.length > 0 && <Tag label="Manual" color={C.purple} />}
            </div>
          </div>

          {stravaLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted, fontSize: 13 }}>Carregando atividades...</div>
          ) : allActivities.length > 0 ? (
            allActivities.map((a, i) => (
              <div key={i} style={{ padding: 14, background: C.card2, borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${typeColor(a.type)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{a.date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <Tag label={a.type} color={typeColor(a.type)} />
                    {a.source === 'manual' && (
                      <button
                        onClick={() => remove(a.id)}
                        title="Remover"
                        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
                      >×</button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { l: 'dist',  v: a.dist > 0 ? `${a.dist}km` : '—', c: typeColor(a.type) },
                    { l: 'pace',  v: a.pace,                             c: C.text },
                    { l: 'tempo', v: a.time,                             c: C.text },
                    { l: 'kcal',  v: a.cal > 0 ? String(a.cal) : '—',  c: C.red },
                    { l: 'bpm',   v: a.hr > 0  ? String(a.hr)  : '—',  c: C.pink },
                  ].map((s, j) => (
                    <div key={j} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏃</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma atividade registrada</div>
              <div style={{ fontSize: 13 }}>Conecte o Strava ou registre seu treino manualmente</div>
              <button
                onClick={openModal}
                style={{ marginTop: 16, background: C.purple, border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                + Registrar treino
              </button>
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {stravaOn && strava && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Volume mensal</div>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.strava }}>{strava.monthKm}<span style={{ fontSize: 16, color: C.muted }}> km</span></div>
                <div style={{ fontSize: 12, color: C.muted }}>meta: {strava.monthGoal}km</div>
              </div>
              <Bar pct={monthPct} color={C.strava} h={8} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: 'right' }}>{monthPct}% da meta</div>
            </Card>
          )}
          {stravaOn && strava && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Zonas de FC</div>
              {strava.zones.map((z, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                  <span style={{ width: 60, fontSize: 11, color: C.muted2 }}>{z.z}</span>
                  <Bar pct={z.pct} color={z.c} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: z.c, width: 28, textAlign: 'right' }}>{z.pct}%</span>
                </div>
              ))}
            </Card>
          )}
          {stravaOn && strava && (
            <div style={{ background: `${C.strava}11`, border: `1px solid ${C.strava}33`, borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Dot color={C.green} /><span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Sincronização ativa</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Última sync: {strava.lastSync}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Próxima: ao finalizar atividade</div>
            </div>
          )}
          {!stravaOn && workouts.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Resumo semanal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { l: 'Atividades', v: String(manualWeekCount), c: C.text },
                  { l: 'Distância',  v: `${manualWeekKm} km`,   c: C.strava },
                  { l: 'Calorias',   v: `${manualWeekCal} kcal`, c: C.red },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{r.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Registrar treino</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</button>
            </div>

            {/* Type selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Tipo de atividade</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t, name: '' }))}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: form.type === t ? typeColor(t) : C.card2,
                      color: form.type === t ? '#fff' : C.muted,
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nome (opcional)</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={DEFAULT_NAMES[form.type]}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Data</label>
                <input
                  type="date"
                  value={form.date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Duração (min) *</label>
                <input
                  type="number" min="1" max="999"
                  value={form.durationMin}
                  onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))}
                  placeholder="ex: 45"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Distância (km)</label>
                <input
                  type="number" min="0" step="0.1"
                  value={form.dist}
                  onChange={e => setForm(f => ({ ...f, dist: e.target.value }))}
                  placeholder="ex: 5.2"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Calorias (kcal)</label>
                <input
                  type="number" min="0"
                  value={form.cal}
                  onChange={e => setForm(f => ({ ...f, cal: e.target.value }))}
                  placeholder="ex: 350"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>FC média (bpm)</label>
                <input
                  type="number" min="0" max="250"
                  value={form.hr}
                  onChange={e => setForm(f => ({ ...f, hr: e.target.value }))}
                  placeholder="ex: 145"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Pace preview */}
            {form.durationMin && form.dist && parseFloat(form.dist) > 0 && (
              <div style={{ background: C.card2, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: C.muted }}>
                Ritmo estimado: <strong style={{ color: C.text }}>{calcPace(parseInt(form.durationMin), parseFloat(form.dist))} /km</strong>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!form.durationMin || parseInt(form.durationMin) <= 0}
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: 'none',
                cursor: form.durationMin && parseInt(form.durationMin) > 0 ? 'pointer' : 'not-allowed',
                background: form.durationMin && parseInt(form.durationMin) > 0 ? typeColor(form.type) : C.border2,
                color: '#fff', fontSize: 15, fontWeight: 700,
              }}
            >
              Salvar treino
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
