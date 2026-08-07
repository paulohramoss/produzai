// Check-in de prontidão: quatro toques ao acordar que viram um número e uma
// decisão — hoje dá pra puxar, manter ou segurar.
//
// O sono deixa de ser um campo escondido na página Mental e passa a ser a
// primeira coisa do dia, junto com dor muscular e disposição. A FC de repouso é
// opcional e só entra na conta quando já existe base de comparação.

import { useState, useEffect, useContext } from 'react'
import { HeartPulse, Moon } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, Bar } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { useAuthStore } from '../../store/useAuthStore'
import { saveDaily, getDailyHistory, type ReadinessEntry } from '../../lib/db'
import { lastNDays, todayKey } from '../../lib/date'
import {
  computeReadiness, defaultReadinessDraft, VERDICT_EMOJI,
  type ReadinessResult,
} from '../../lib/readiness'
import { toast } from '../../lib/toast'

/** Quantos dias olhamos para trás para montar a base da FC de repouso. */
const HISTORY_DAYS = 21

const SLEEP_OPTIONS = [4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10]

const SORENESS_LABELS = ['Nenhuma', 'Leve', 'Média', 'Forte', 'Muita']
const QUALITY_LABELS  = ['Péssima', 'Ruim', 'Ok', 'Boa', 'Ótima']
const DRIVE_LABELS    = ['Zero', 'Pouca', 'Normal', 'Boa', 'De sobra']

function verdictColor(r: ReadinessResult): string {
  return r.verdict === 'puxa' ? C.green : r.verdict === 'mantem' ? C.orange : C.red
}

function Scale5({ value, onChange, labels, color }: {
  value: number
  onChange: (v: number) => void
  labels: string[]
  color: string
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            flex: 1, padding: '9px 2px', borderRadius: T.radius.sm, cursor: 'pointer',
            fontSize: T.text.xs, fontWeight: value === n ? T.weight.bold : T.weight.regular,
            background: value === n ? color : C.card2,
            border: `1px solid ${value === n ? color : C.border2}`,
            color: value === n ? '#fff' : C.muted,
            lineHeight: 1.3,
          }}
        >
          {labels[n - 1]}
        </button>
      ))}
    </div>
  )
}

interface Props {
  /** Prontidão já registrada hoje, se houver. */
  entry: ReadinessEntry | null
  onSaved: (entry: ReadinessEntry) => void
}

export function ReadinessCard({ entry, onSaved }: Props) {
  const user = useAuthStore(s => s.user)
  const { isMobile } = useContext(LayoutContext)

  const [history, setHistory] = useState<ReadinessEntry[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => defaultReadinessDraft(null))
  const [hrInput, setHrInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Histórico recente: serve de base para julgar a FC de repouso de hoje.
  useEffect(() => {
    async function load() {
      if (!user) return
      const days = await getDailyHistory(lastNDays(HISTORY_DAYS))
      const past = Object.entries(days)
        .filter(([date]) => date !== todayKey())
        .map(([, d]) => d.readiness)
        .filter((r): r is ReadinessEntry => Boolean(r))
      setHistory(past)
      if (!entry) {
        const last = past[past.length - 1] ?? null
        const base = defaultReadinessDraft(last)
        setDraft(base)
        setHrInput(base.restingHr ? String(base.restingHr) : '')
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function openEditor() {
    const base = entry ?? defaultReadinessDraft(history[history.length - 1] ?? null)
    setDraft({
      sleepHours: base.sleepHours,
      sleepQuality: base.sleepQuality,
      soreness: base.soreness,
      drive: base.drive,
      ...(base.restingHr ? { restingHr: base.restingHr } : {}),
    })
    setHrInput(base.restingHr ? String(base.restingHr) : '')
    setEditing(true)
  }

  async function handleSave() {
    const hr = parseInt(hrInput)
    const next: ReadinessEntry = {
      sleepHours: draft.sleepHours,
      sleepQuality: draft.sleepQuality,
      soreness: draft.soreness,
      drive: draft.drive,
      ...(Number.isFinite(hr) && hr >= 30 && hr <= 150 ? { restingHr: hr } : {}),
      loggedAt: Date.now(),
    }
    setSaving(true)
    await saveDaily(todayKey(), { readiness: next })
    setSaving(false)
    setEditing(false)
    onSaved(next)
    const result = computeReadiness(next, history)
    toast.success(`${VERDICT_EMOJI[result.verdict]} Prontidão ${result.score}/100 — ${result.headline.toLowerCase()}`)
  }

  const result = entry ? computeReadiness(entry, history) : null
  const preview = editing ? computeReadiness({ ...draft, loggedAt: Date.now() }, history) : null

  // ── Ainda não registrou hoje ────────────────────────────────────────────────
  if (!entry && !editing) {
    return (
      <Card onClick={openEditor} style={{ background: `${C.blue}0D`, border: `1px solid ${C.blue}33` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
              <HeartPulse size={17} color={C.blue} /> Como você acordou?
            </div>
            <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.5 }}>
              Sono, dor muscular e disposição — 4 toques que dizem se hoje é dia de puxar ou de segurar.
            </div>
          </div>
          <span style={{ fontSize: T.text.md, color: C.blue, fontWeight: T.weight.bold, whiteSpace: 'nowrap' }}>Registrar →</span>
        </div>
      </Card>
    )
  }

  // ── Formulário ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <Card style={{ border: `1px solid ${C.blue}44` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}>
            <HeartPulse size={17} color={C.blue} /> Prontidão de hoje
          </div>
          <button
            onClick={() => setEditing(false)}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: T.text['2xl'], cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >×</button>
        </div>

        {/* Sono */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.text.base, color: C.muted, marginBottom: 8 }}>
            <Moon size={14} /> Quantas horas você dormiu?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SLEEP_OPTIONS.map(h => (
              <button
                key={h}
                onClick={() => setDraft(d => ({ ...d, sleepHours: h }))}
                style={{
                  padding: '7px 12px', borderRadius: T.radius.sm, cursor: 'pointer',
                  fontSize: T.text.base, fontWeight: draft.sleepHours === h ? T.weight.bold : T.weight.regular,
                  background: draft.sleepHours === h ? C.blue : C.card2,
                  border: `1px solid ${draft.sleepHours === h ? C.blue : C.border2}`,
                  color: draft.sleepHours === h ? '#fff' : C.muted,
                }}
              >
                {Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h30`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 8 }}>Qualidade do sono</div>
            <Scale5 value={draft.sleepQuality} onChange={v => setDraft(d => ({ ...d, sleepQuality: v }))} labels={QUALITY_LABELS} color={C.blue} />
          </div>
          <div>
            <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 8 }}>Dor muscular</div>
            <Scale5 value={draft.soreness} onChange={v => setDraft(d => ({ ...d, soreness: v }))} labels={SORENESS_LABELS} color={C.purple} />
          </div>
          <div>
            <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 8 }}>Disposição pra treinar</div>
            <Scale5 value={draft.drive} onChange={v => setDraft(d => ({ ...d, drive: v }))} labels={DRIVE_LABELS} color={C.orange} />
          </div>
          <div>
            <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 8 }}>FC de repouso (opcional)</div>
            <input
              type="number" inputMode="numeric" min={30} max={150}
              value={hrInput}
              onChange={e => setHrInput(e.target.value)}
              placeholder="bpm ao acordar"
              style={{
                width: '100%', background: C.card2, border: `1px solid ${C.border2}`,
                borderRadius: T.radius.sm, padding: '9px 12px', color: C.text,
                fontSize: T.text.md, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {preview && (
          <div style={{ background: C.card2, borderRadius: T.radius.md, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: T.text.base, color: C.muted }}>
              {VERDICT_EMOJI[preview.verdict]} {preview.headline}
            </span>
            <span style={{ fontSize: T.text['4xl'], fontWeight: T.weight.extrabold, color: verdictColor(preview), ...displayStyle }}>
              {preview.score}
            </span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: 11, borderRadius: T.radius.md, border: 'none',
            background: C.blue, color: '#fff', fontSize: T.text.xl, fontWeight: T.weight.bold,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Salvando...' : 'Salvar prontidão'}
        </button>
      </Card>
    )
  }

  // ── Resultado do dia ────────────────────────────────────────────────────────
  const color = verdictColor(result!)
  return (
    <Card style={{ background: `${color}0D`, border: `1px solid ${color}33` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
            <HeartPulse size={17} color={color} /> Prontidão
          </div>
          <div style={{ fontSize: T.text.lg, fontWeight: T.weight.bold, color }}>
            {VERDICT_EMOJI[result!.verdict]} {result!.headline}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1, ...displayStyle }}>{result!.score}</div>
          <button
            onClick={openEditor}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: T.text.sm, cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: 4 }}
          >
            editar
          </button>
        </div>
      </div>

      <Bar pct={result!.score} color={color} h={5} />

      <div style={{ fontSize: T.text.base, color: C.text, lineHeight: 1.6, margin: '12px 0' }}>
        {result!.advice}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {result!.factors.map(f => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: T.text.sm, color: C.muted, minWidth: 92 }}>{f.label}</span>
            <div style={{ flex: 1 }}>
              <Bar pct={f.score} color={f.score >= 70 ? C.green : f.score >= 45 ? C.orange : C.red} h={3} />
            </div>
            <span style={{ fontSize: T.text.sm, color: C.muted2, minWidth: isMobile ? 88 : 150, textAlign: 'right' }}>{f.detail}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
