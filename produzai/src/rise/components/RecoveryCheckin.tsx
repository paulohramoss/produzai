import { useEffect, useMemo, useRef, useState } from 'react'
import { HeartPulse, Activity, Upload } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { C, T, displayStyle } from '../data'
import { Card, ChartTooltip } from '../primitives'
import { getMentalHistory, type MentalEntry } from '../../lib/db'
import { recoveryDeviation } from '../../lib/recovery'
import { parseHealthCsv, importHealthRows } from '../../lib/healthImport'
import { toast } from '../../lib/toast'

const BASELINE_DAYS = 30
const MAX_CSV_SIZE = 5 * 1024 * 1024

function lastDates(n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

const numberInput: React.CSSProperties = {
  width: '100%',
  background: C.card2,
  border: `1px solid ${C.border2}`,
  borderRadius: T.radius.sm,
  padding: '10px 12px',
  color: C.text,
  fontSize: T.text['2xl'],
  fontWeight: 700,
  outline: 'none',
  boxSizing: 'border-box',
  textAlign: 'center',
}

/**
 * Check-in de recuperação: VFC (rMSSD) e FC de repouso medidas ao acordar.
 *
 * São dois números digitados à mão de propósito. Ler isso direto de WHOOP,
 * Oura ou Garmin exige aprovação de parceria nas APIs deles — enquanto isso,
 * quem tem relógio consegue os dois números em 10 segundos, e o motor de
 * prontidão passa a valer bem mais do que só com sono e humor.
 */
export function RecoveryCheckin({
  entry,
  onChange,
  today,
}: {
  entry: MentalEntry
  onChange: (patch: Partial<MentalEntry>) => void
  today: string
}) {
  const [history, setHistory] = useState<Record<string, MentalEntry>>({})
  const [hrvDraft, setHrvDraft] = useState('')
  const [rhrDraft, setRhrDraft] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMentalHistory(lastDates(BASELINE_DAYS)).then(setHistory)
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > MAX_CSV_SIZE) {
      toast.error('Arquivo muito grande. Máximo 5MB.')
      return
    }

    setImporting(true)
    try {
      const { rows, matchedColumns } = parseHealthCsv(await file.text())
      if (rows.length === 0) {
        toast.error('Não reconheci nenhuma coluna útil. Precisa de uma coluna de data e ao menos uma de VFC, FC de repouso ou sono.')
        return
      }
      const result = await importHealthRows(rows)
      setHistory(await getMentalHistory(lastDates(BASELINE_DAYS)))
      toast.success(`📥 ${result.imported} dias importados (${matchedColumns.join(', ')})`)
    } catch {
      toast.error('Não consegui ler esse arquivo. Confirme que é um CSV.')
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    setHrvDraft(entry.hrvMs ? String(entry.hrvMs) : '')
    setRhrDraft(entry.restingHr ? String(entry.restingHr) : '')
  }, [entry.hrvMs, entry.restingHr])

  // O histórico carregado não conhece o valor que acabou de ser digitado —
  // sobrepor a entrada de hoje faz o desvio reagir na hora.
  const deviation = useMemo(
    () => recoveryDeviation({ ...history, [today]: entry }, today),
    [history, entry, today],
  )

  const trend = useMemo(() => {
    const merged = { ...history, [today]: entry }
    return lastDates(BASELINE_DAYS)
      .map(date => ({ date, label: date.slice(8), hrv: merged[date]?.hrvMs ?? null }))
      .filter(p => p.hrv !== null)
  }, [history, entry, today])

  function commit(field: 'hrvMs' | 'restingHr', raw: string) {
    const value = Number(raw)
    if (!raw.trim()) { onChange({ [field]: undefined }); return }
    if (!Number.isFinite(value) || value <= 0) return
    const bounded = field === 'hrvMs'
      ? Math.min(300, Math.max(5, Math.round(value)))
      : Math.min(120, Math.max(28, Math.round(value)))
    onChange({ [field]: bounded })
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
        <HeartPulse size={17} color={C.pink} /> Recuperação ao acordar
      </div>
      <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
        Se seu relógio mede VFC e FC de repouso, anote os dois números aqui. Eles não valem nada em absoluto — o que informa é o desvio contra a sua própria média.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', marginBottom: 6 }}>
            VFC (rMSSD)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={hrvDraft}
            onChange={e => setHrvDraft(e.target.value)}
            onBlur={() => commit('hrvMs', hrvDraft)}
            placeholder="ms"
            style={numberInput}
          />
        </div>
        <div>
          <label style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', marginBottom: 6 }}>
            FC de repouso
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={rhrDraft}
            onChange={e => setRhrDraft(e.target.value)}
            onBlur={() => commit('restingHr', rhrDraft)}
            placeholder="bpm"
            style={numberInput}
          />
        </div>
      </div>

      {(deviation.hrvDeviationPct !== null || deviation.restingHrDelta !== null) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deviation.hrvDeviationPct !== null && (
            <DeviationRow
              label="VFC vs. sua média"
              value={`${deviation.hrvDeviationPct > 0 ? '+' : ''}${deviation.hrvDeviationPct}%`}
              detail={`hoje ${deviation.hrvToday}ms · base ${deviation.hrvBaseline}ms`}
              good={deviation.hrvDeviationPct > -10}
            />
          )}
          {deviation.restingHrDelta !== null && (
            <DeviationRow
              label="FC repouso vs. sua média"
              value={`${deviation.restingHrDelta > 0 ? '+' : ''}${deviation.restingHrDelta} bpm`}
              detail={`hoje ${deviation.restingHrToday} · base ${deviation.restingHrBaseline}`}
              good={deviation.restingHrDelta < 5}
            />
          )}
        </div>
      ) : (
        (entry.hrvMs || entry.restingHr) && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', background: C.card2, borderRadius: T.radius.sm, padding: '10px 12px' }}>
            <Activity size={14} color={C.muted2} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: T.text.md, color: C.muted2, lineHeight: 1.5 }}>
              Registrado. Preciso de pelo menos 5 medições para montar sua linha de base — a partir daí começo a apontar quando você está fora do normal.
            </div>
          </div>
        )
      )}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%', justifyContent: 'center',
            background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
            padding: '9px', color: importing ? C.muted : C.text,
            fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: importing ? 'default' : 'pointer',
          }}
        >
          <Upload size={14} />
          {importing ? 'Importando...' : 'Importar CSV do relógio'}
        </button>
        <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 7, lineHeight: 1.5, textAlign: 'center' }}>
          Aceita export de WHOOP, Oura, Garmin ou planilha própria — precisa de uma coluna de data e ao menos uma de VFC, FC de repouso ou sono.
        </div>
      </div>

      {trend.length >= 5 && deviation.hrvBaseline && (
        <div style={{ width: '100%', height: 110, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={34} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={deviation.hrvBaseline} stroke={C.muted} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="hrv" name="VFC (ms)" stroke={C.pink} strokeWidth={2} dot={{ r: 2, fill: C.pink }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function DeviationRow({ label, value, detail, good }: {
  label: string; value: string; detail: string; good: boolean
}) {
  const color = good ? C.green : C.orange
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: C.card2, borderRadius: T.radius.sm, padding: '10px 12px', border: `1px solid ${color}33` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: T.text.md, color: C.text, fontWeight: T.weight.semibold }}>{label}</div>
        <div style={{ fontSize: T.text.sm, color: C.muted }}>{detail}</div>
      </div>
      <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color, flexShrink: 0, ...displayStyle }}>{value}</div>
    </div>
  )
}
