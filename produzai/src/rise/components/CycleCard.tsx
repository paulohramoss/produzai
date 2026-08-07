// Ciclo menstrual no check-in do dia — só aparece para quem ligou o opt-in.
//
// A leitura é a mesma da prontidão: em que fase o corpo está hoje, o que isso
// costuma significar para o treino, e um botão para registrar o dia em que a
// menstruação começou (é esse registro que mantém a previsão honesta).

import { useState } from 'react'
import { CalendarHeart } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, Bar } from '../primitives'
import { useCycleStore } from '../../store/useCycleStore'
import { todayKey as localTodayKey } from '../../lib/date'
import { toast } from '../../lib/toast'
import {
  cycleStateFor, PHASE_LABEL, PHASE_EMOJI, PHASE_ADVICE, PHASE_SCORE, PHASE_COLOR,
  type CyclePhase,
} from '../../lib/cycle'

const PHASE_HEX: Record<CyclePhase, string> = {
  menstrual:  C[PHASE_COLOR.menstrual],
  folicular:  C[PHASE_COLOR.folicular],
  ovulatoria: C[PHASE_COLOR.ovulatoria],
  lutea:      C[PHASE_COLOR.lutea],
}

export function CycleCard() {
  const enabled      = useCycleStore(s => s.enabled)
  const starts       = useCycleStore(s => s.starts)
  const avgLength    = useCycleStore(s => s.avgLength)
  const periodLength = useCycleStore(s => s.periodLength)
  const logPeriodStart = useCycleStore(s => s.logPeriodStart)

  const [saving, setSaving] = useState(false)
  const todayKey = localTodayKey()

  if (!enabled) return null

  const state = cycleStateFor(todayKey, { starts, avgLength, periodLength })

  async function handleLogStart() {
    setSaving(true)
    await logPeriodStart(todayKey)
    setSaving(false)
    toast.success('🩸 Início do ciclo registrado')
  }

  // ── Sem registro utilizável: pede o marco zero ──────────────────────────────
  if (!state) {
    return (
      <Card style={{ background: `${C.pink}0D`, border: `1px solid ${C.pink}33` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 6, ...displayStyle }}>
          <CalendarHeart size={17} color={C.pink} /> Ciclo menstrual
        </div>
        <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
          {starts.length > 0
            ? 'Faz muito tempo desde o último registro — marque o início do ciclo atual para a previsão voltar a valer.'
            : 'Marque o primeiro dia da sua menstruação para o app começar a cruzar fase do ciclo com treino, sono e disposição.'}
        </div>
        <button
          onClick={handleLogStart}
          disabled={saving}
          style={{
            width: '100%', padding: 10, borderRadius: T.radius.md, border: 'none',
            background: C.pink, color: '#fff', fontSize: T.text.lg, fontWeight: T.weight.bold,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Salvando...' : '🩸 Menstruei hoje'}
        </button>
      </Card>
    )
  }

  const color = PHASE_HEX[state.phase]
  const progress = Math.min(100, Math.round(state.day / avgLength * 100))
  const alreadyToday = starts.includes(todayKey)

  return (
    <Card style={{ background: `${color}0D`, border: `1px solid ${color}33` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
            <CalendarHeart size={17} color={color} /> Ciclo
          </div>
          <div style={{ fontSize: T.text.lg, fontWeight: T.weight.bold, color }}>
            {PHASE_EMOJI[state.phase]} Fase {PHASE_LABEL[state.phase].toLowerCase()}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1, ...displayStyle }}>{state.day}</div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 2 }}>dia do ciclo</div>
        </div>
      </div>

      <Bar pct={progress} color={color} h={5} />

      <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6 }}>
        {state.late
          ? `Previsão era ${Math.abs(state.daysToNextPeriod)} ${Math.abs(state.daysToNextPeriod) === 1 ? 'dia' : 'dias'} atrás — registre quando começar.`
          : state.daysToNextPeriod === 0
            ? 'Próxima menstruação prevista para hoje.'
            : `Próxima menstruação em ${state.daysToNextPeriod} ${state.daysToNextPeriod === 1 ? 'dia' : 'dias'}.`}
      </div>

      <div style={{ fontSize: T.text.base, color: C.text, lineHeight: 1.6, margin: '12px 0' }}>
        {PHASE_ADVICE[state.phase]}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: T.text.sm, color: C.muted, minWidth: 92 }}>Rendimento típico</span>
        <div style={{ flex: 1 }}>
          <Bar pct={PHASE_SCORE[state.phase]} color={color} h={3} />
        </div>
        <span style={{ fontSize: T.text.sm, color: C.muted2, minWidth: 46, textAlign: 'right' }}>
          {PHASE_SCORE[state.phase]}/100
        </span>
      </div>

      <button
        onClick={handleLogStart}
        disabled={saving || alreadyToday}
        style={{
          width: '100%', padding: 9, borderRadius: T.radius.sm,
          border: `1px solid ${alreadyToday ? C.border2 : `${C.pink}66`}`,
          background: 'transparent', color: alreadyToday ? C.muted : C.pink,
          fontSize: T.text.base, fontWeight: T.weight.bold,
          cursor: saving || alreadyToday ? 'default' : 'pointer',
        }}
      >
        {alreadyToday ? '✓ Início registrado hoje' : saving ? 'Salvando...' : '🩸 Menstruei hoje'}
      </button>
    </Card>
  )
}
