// Opt-in do ciclo menstrual e ajuste da duração média.
//
// Dado de saúde sensível: nada é coletado nem exibido enquanto a chave estiver
// desligada, e desligar apaga as datas registradas.

import { useState } from 'react'
import { T, C } from '../data'
import { useCycleStore } from '../../store/useCycleStore'
import { CYCLE_LENGTH_RANGE, PERIOD_LENGTH_RANGE, observedCycleLength } from '../../lib/cycle'
import { toast } from '../../lib/toast'

const inp: React.CSSProperties = {
  width: '100%', background: '#1C1C1C', border: `1px solid ${C.border2}`,
  borderRadius: T.radius.md, padding: '11px 14px', color: C.text,
  fontSize: T.text.lg, outline: 'none', boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  fontSize: T.text.sm, color: C.muted, display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8,
}

export function CycleSettingsCard() {
  const enabled      = useCycleStore(s => s.enabled)
  const starts       = useCycleStore(s => s.starts)
  const avgLength    = useCycleStore(s => s.avgLength)
  const periodLength = useCycleStore(s => s.periodLength)
  const setEnabled   = useCycleStore(s => s.setEnabled)
  const setLengths   = useCycleStore(s => s.setLengths)
  const removePeriodStart = useCycleStore(s => s.removePeriodStart)

  const [avgInput, setAvgInput]       = useState(String(avgLength))
  const [periodInput, setPeriodInput] = useState(String(periodLength))
  const [confirmOff, setConfirmOff]   = useState(false)

  const observed = observedCycleLength(starts)

  async function handleToggle(next: boolean) {
    if (!next && starts.length > 0) { setConfirmOff(true); return }
    await setEnabled(next)
    if (next) toast.success('🌙 Acompanhamento do ciclo ligado')
  }

  async function handleTurnOff() {
    // Desligar apaga o histórico: manter datas de menstruação guardadas depois
    // de a usuária dizer "não quero isso" seria o oposto do opt-in.
    for (const date of [...starts]) await removePeriodStart(date)
    await setEnabled(false)
    setConfirmOff(false)
    toast.info('Acompanhamento desligado e registros apagados')
  }

  async function handleSaveLengths() {
    await setLengths(Number(avgInput), Number(periodInput))
    const s = useCycleStore.getState()
    setAvgInput(String(s.avgLength))
    setPeriodInput(String(s.periodLength))
    toast.success('✅ Duração do ciclo atualizada')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, fontSize: T.text.base, color: C.muted, lineHeight: 1.65 }}>
          Cruza a fase do ciclo com treino, sono e disposição — e entra no score de performance
          como mais um fator. Só você vê, e o resumo do treinador nunca inclui esses dados.
        </div>
        <button
          onClick={() => handleToggle(!enabled)}
          role="switch"
          aria-checked={enabled}
          style={{
            width: 52, height: 30, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
            background: enabled ? C.pink : C.card2,
            border: `1px solid ${enabled ? C.pink : C.border2}`,
            display: 'flex', alignItems: 'center',
            justifyContent: enabled ? 'flex-end' : 'flex-start',
            padding: 3, transition: 'background .15s',
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: enabled ? '#fff' : C.muted, display: 'block' }} />
        </button>
      </div>

      {confirmOff && (
        <div style={{ marginTop: 14, background: `${C.red}0D`, border: `1px solid ${C.red}33`, borderRadius: T.radius.md, padding: 14 }}>
          <div style={{ fontSize: T.text.base, color: C.text, lineHeight: 1.6, marginBottom: 12 }}>
            Desligar apaga as {starts.length} data{starts.length > 1 ? 's' : ''} de menstruação registrada{starts.length > 1 ? 's' : ''}.
            Não dá para desfazer.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setConfirmOff(false)}
              style={{ flex: 1, padding: '9px', borderRadius: T.radius.sm, border: `1px solid ${C.border2}`, background: 'transparent', color: C.muted, fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: 'pointer' }}
            >
              Manter ligado
            </button>
            <button
              onClick={handleTurnOff}
              style={{ flex: 1, padding: '9px', borderRadius: T.radius.sm, border: 'none', background: C.red, color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer' }}
            >
              Desligar e apagar
            </button>
          </div>
        </div>
      )}

      {enabled && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>Ciclo (dias)</label>
              <input
                type="number"
                min={CYCLE_LENGTH_RANGE.min}
                max={CYCLE_LENGTH_RANGE.max}
                value={avgInput}
                onChange={e => setAvgInput(e.target.value)}
                style={inp}
              />
            </div>
            <div>
              <label style={label}>Fluxo (dias)</label>
              <input
                type="number"
                min={PERIOD_LENGTH_RANGE.min}
                max={PERIOD_LENGTH_RANGE.max}
                value={periodInput}
                onChange={e => setPeriodInput(e.target.value)}
                style={inp}
              />
            </div>
          </div>

          <button
            onClick={handleSaveLengths}
            disabled={avgInput === String(avgLength) && periodInput === String(periodLength)}
            style={{
              width: '100%', padding: '10px', borderRadius: T.radius.md, border: 'none',
              background: avgInput === String(avgLength) && periodInput === String(periodLength) ? C.border2 : C.pink,
              color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold,
              cursor: avgInput === String(avgLength) && periodInput === String(periodLength) ? 'default' : 'pointer',
            }}
          >
            Salvar duração
          </button>

          {observed != null && (
            <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
              Pelos seus registros, a média real está em <strong style={{ color: C.text }}>{observed} dias</strong> —
              o app já usa esse valor quando você marca um novo início.
            </div>
          )}

          {starts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ ...label, marginBottom: 8 }}>Inícios registrados</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...starts].reverse().slice(0, 12).map(d => (
                  <span
                    key={d}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.sm,
                      padding: '4px 8px', fontSize: T.text.sm, color: C.muted2,
                    }}
                  >
                    {d.split('-').reverse().slice(0, 2).join('/')}
                    <button
                      onClick={() => removePeriodStart(d)}
                      title="Remover"
                      style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text.lg, lineHeight: 1, padding: 0 }}
                    >×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
