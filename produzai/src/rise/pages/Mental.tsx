import { useState } from 'react'
import { C, type Page } from '../data'
import { Card } from '../primitives'

interface Props { connected: string[]; setPage: (p: Page) => void }

interface DayEntry {
  mood: number       // 1-5
  energy: number     // 1-5
  gratitude: [string, string, string]
  note: string
}

const MOODS = ['😞', '😕', '😐', '🙂', '😄']
const MOOD_LABELS = ['Ruim', 'Regular', 'Ok', 'Bom', 'Ótimo']
const MOOD_COLORS = [C.red, '#F97316', '#EAB308', C.green, '#22C55E']

const today = () => new Date().toISOString().slice(0, 10)

function loadEntry(key: string): DayEntry {
  try {
    const r = localStorage.getItem(`mental_${key}`)
    return r ? JSON.parse(r) : { mood: 0, energy: 0, gratitude: ['', '', ''], note: '' }
  } catch { return { mood: 0, energy: 0, gratitude: ['', '', ''], note: '' } }
}
function saveEntry(key: string, e: DayEntry) { localStorage.setItem(`mental_${key}`, JSON.stringify(e)) }

function loadHistory(): { date: string; mood: number }[] {
  const result: { date: string; mood: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const entry = loadEntry(key)
    result.push({ date: key, mood: entry.mood })
  }
  return result
}

const inp: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border2}`, borderRadius: 8,
  padding: '9px 10px', color: C.text, fontSize: 13, outline: 'none', width: '100%',
}

export function Mental({ connected: _c, setPage: _s }: Props) {
  const todayKey = today()
  const [entry, setEntry] = useState<DayEntry>(() => loadEntry(todayKey))
  const history = loadHistory()

  const update = (patch: Partial<DayEntry>) => {
    setEntry(prev => {
      const next = { ...prev, ...patch }
      saveEntry(todayKey, next)
      return next
    })
  }

  const setGratitude = (i: number, val: string) => {
    const g: [string, string, string] = [...entry.gratitude] as [string, string, string]
    g[i] = val
    update({ gratitude: g })
  }

  const hasMood   = entry.mood > 0
  const hasEnergy = entry.energy > 0
  const weekAvg   = Math.round(history.filter(h => h.mood > 0).reduce((s, h) => s + h.mood, 0) / Math.max(history.filter(h => h.mood > 0).length, 1))
  const streak    = history.slice().reverse().findIndex(h => h.mood === 0)
  const streakDays = streak === -1 ? 7 : streak

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🧠 Mental</div>
        <div style={{ fontSize: 13, color: C.muted }}>Bem-estar, humor e reflexão diária</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Left — check-in */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Mood */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>😊 Como você está hoje?</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              {MOODS.map((m, i) => (
                <div
                  key={i}
                  onClick={() => update({ mood: i + 1 })}
                  style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 10, cursor: 'pointer', background: entry.mood === i + 1 ? MOOD_COLORS[i] + '33' : C.card2, border: `2px solid ${entry.mood === i + 1 ? MOOD_COLORS[i] : C.border}`, transition: 'all .12s' }}
                >
                  <div style={{ fontSize: 22 }}>{m}</div>
                  <div style={{ fontSize: 9, color: entry.mood === i + 1 ? MOOD_COLORS[i] : C.muted, marginTop: 4, fontWeight: 600 }}>{MOOD_LABELS[i]}</div>
                </div>
              ))}
            </div>
            {hasMood && (
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: MOOD_COLORS[entry.mood - 1], fontWeight: 700 }}>
                {MOODS[entry.mood - 1]} {MOOD_LABELS[entry.mood - 1]}
              </div>
            )}
          </Card>

          {/* Energy */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>⚡ Nível de energia</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <div
                  key={n}
                  onClick={() => update({ energy: n })}
                  style={{ flex: 1, padding: '12px 4px', textAlign: 'center', borderRadius: 10, cursor: 'pointer', background: entry.energy >= n ? `${C.orange}33` : C.card2, border: `2px solid ${entry.energy >= n ? C.orange : C.border}`, fontSize: 13, fontWeight: 800, color: entry.energy >= n ? C.orange : C.muted, transition: 'all .12s' }}
                >
                  {n}
                </div>
              ))}
            </div>
            {hasEnergy && (
              <div style={{ marginTop: 10, fontSize: 12, color: C.muted, textAlign: 'center' }}>
                Energia: {entry.energy}/5 — {entry.energy <= 2 ? 'Descanse mais' : entry.energy <= 3 ? 'Razoável' : entry.energy <= 4 ? 'Boa energia' : 'No limite máximo! 🔥'}
              </div>
            )}
          </Card>

          {/* Gratitude */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🙏 3 coisas boas hoje</div>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                <span style={{ fontSize: 13, color: C.orange, fontWeight: 800, flexShrink: 0 }}>{i + 1}.</span>
                <input
                  type="text"
                  value={entry.gratitude[i]}
                  onChange={e => setGratitude(i, e.target.value)}
                  placeholder={['Algo que me deixou feliz...', 'Algo pelo que sou grato...', 'Uma conquista de hoje...'][i]}
                  style={{ ...inp, fontSize: 12 }}
                />
              </div>
            ))}
          </Card>
        </div>

        {/* Right — notes + history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Notes */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📝 Notas do dia</div>
            <textarea
              value={entry.note}
              onChange={e => update({ note: e.target.value })}
              placeholder="Como foi seu dia? Reflexões, aprendizados, desafios..."
              rows={7}
              style={{ ...inp, resize: 'none', lineHeight: 1.6 } as React.CSSProperties}
            />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: 'right' }}>
              {entry.note.length} caracteres · salvo automaticamente
            </div>
          </Card>

          {/* 7-day history */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📈 Últimos 7 dias</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 12 }}>
              {history.map((h, i) => {
                const isToday = i === 6
                const col     = h.mood > 0 ? MOOD_COLORS[h.mood - 1] : C.border
                const ht      = h.mood > 0 ? h.mood * 14 + 10 : 8
                const days    = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
                const dow     = new Date(h.date + 'T12:00:00').getDay()
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 12 }}>{h.mood > 0 ? MOODS[h.mood - 1] : '—'}</div>
                    <div style={{ width: '100%', height: ht, background: col, borderRadius: 4, transition: 'height .3s', opacity: isToday ? 1 : 0.7 }} />
                    <div style={{ fontSize: 9, color: isToday ? C.text : C.muted, fontWeight: isToday ? 700 : 400 }}>{days[dow]}</div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <div style={{ background: C.card2, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>{weekAvg > 0 ? MOODS[weekAvg - 1] : '—'}</div>
                <div style={{ fontSize: 10, color: C.muted }}>Humor médio</div>
              </div>
              <div style={{ background: C.card2, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.orange }}>{streakDays}</div>
                <div style={{ fontSize: 10, color: C.muted }}>dias consecutivos</div>
              </div>
            </div>
          </Card>

          {/* Tips */}
          {hasMood && entry.mood <= 2 && (
            <Card style={{ background: `${C.blue}11`, border: `1px solid ${C.blue}33` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.blue, marginBottom: 8 }}>💡 Dica para dias difíceis</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                Dias assim fazem parte. Tente uma caminhada curta, beba água e foque em 1 coisa pequena que você pode completar hoje.
              </div>
            </Card>
          )}
          {hasMood && entry.mood >= 4 && (
            <Card style={{ background: `${C.green}11`, border: `1px solid ${C.green}33` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.green, marginBottom: 8 }}>🔥 Ótimo momento!</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                Use essa energia para atacar suas prioridades mais importantes do dia.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
