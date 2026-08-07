// Configuração dos lembretes.
//
// Quatro tipos, cada um com o seu horário: abertura do dia, um por hábito,
// nudge do fim da noite e alerta de sequência em risco. Os três últimos só
// tocam se ainda fizerem sentido no momento — a checagem está em lib/reminders.ts.

import { useState, useContext } from 'react'
import { Bell, ChevronDown, ChevronUp } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { useHabitsStore } from '../../store/useHabitsStore'
import { saveReminderPrefs, type ReminderPrefs } from '../../lib/db'
import {
  notificationsSupported, requestPermission, applyPrefs,
} from '../../lib/notifications'
import { toast } from '../../lib/toast'

const timeInput: React.CSSProperties = {
  background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.xs,
  padding: '5px 8px', color: C.text, fontSize: T.text.md, outline: 'none', colorScheme: 'dark',
}

interface Props {
  prefs: ReminderPrefs
  onChange: (prefs: ReminderPrefs) => void
}

/** Linha de um lembrete: liga/desliga pelo horário (null = desligado). */
function ReminderRow({ icon, title, desc, value, onChange }: {
  icon: string
  title: string
  desc: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  const enabled = value !== null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: T.text.xl, width: 22, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.text.md, color: enabled ? C.text : C.muted }}>{title}</div>
        <div style={{ fontSize: T.text.sm, color: C.muted, lineHeight: 1.4 }}>{desc}</div>
      </div>
      {enabled ? (
        <>
          <input
            type="time"
            value={value}
            onChange={e => onChange(e.target.value || null)}
            style={timeInput}
          />
          <button
            onClick={() => onChange(null)}
            title="Desligar"
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text['2xl'], lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
          >×</button>
        </>
      ) : (
        <button
          onClick={() => onChange('08:00')}
          style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '5px 11px', fontSize: T.text.sm, color: C.muted, cursor: 'pointer', flexShrink: 0 }}
        >
          Ativar
        </button>
      )}
    </div>
  )
}

export function RemindersCard({ prefs, onChange }: Props) {
  const habitDefs = useHabitsStore(s => s.defs)
  const { isMobile } = useContext(LayoutContext)
  const [open, setOpen] = useState(false)

  if (!notificationsSupported()) return null

  function patch(next: Partial<ReminderPrefs>) {
    const merged = { ...prefs, ...next }
    onChange(merged)
    saveReminderPrefs(merged)
  }

  async function toggleAll() {
    if (!prefs.enabled) {
      const perm = await requestPermission()
      if (perm !== 'granted') { toast.error('Permissão de notificação negada'); return }
      // O fuso vai junto para o cron do servidor disparar na hora local certa.
      const merged: ReminderPrefs = {
        ...prefs, enabled: true,
        timeZoneOffsetMin: new Date().getTimezoneOffset(),
      }
      onChange(merged)
      saveReminderPrefs(merged)
      applyPrefs({ enabled: true, hour: 8, minute: 0 })
      setOpen(true)
      toast.success('🔔 Lembretes ativados')
    } else {
      patch({ enabled: false })
      applyPrefs({ enabled: false, hour: 8, minute: 0 })
      toast.info('🔕 Lembretes desativados')
    }
  }

  const activeCount = [prefs.morning, prefs.eveningNudge, prefs.streakAlert]
    .filter(Boolean).length + Object.keys(prefs.habitTimes).length

  return (
    <Card style={{ border: `1px solid ${prefs.enabled ? C.blue + '44' : C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => prefs.enabled && setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: prefs.enabled ? 'pointer' : 'default', flex: 1, minWidth: 0 }}
        >
          <Bell size={17} color={prefs.enabled ? C.blue : C.muted} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: T.weight.bold, fontSize: T.text.lg, ...displayStyle }}>Lembretes</div>
            {prefs.enabled && (
              <div style={{ fontSize: T.text.sm, color: C.muted }}>
                {activeCount} {activeCount === 1 ? 'ativo' : 'ativos'}
              </div>
            )}
          </div>
          {prefs.enabled && (open ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />)}
        </div>

        <button
          onClick={toggleAll}
          style={{
            background: prefs.enabled ? C.blue : C.card2,
            border: `1px solid ${prefs.enabled ? C.blue : C.border2}`,
            borderRadius: T.radius.xs, padding: '4px 10px', fontSize: T.text.sm,
            fontWeight: T.weight.bold, color: prefs.enabled ? '#fff' : C.muted,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {prefs.enabled ? 'Ativo' : 'Ativar'}
        </button>
      </div>

      {prefs.enabled && open && (
        <div style={{ marginTop: 12 }}>
          <ReminderRow
            icon="☀️"
            title="Abrir o dia"
            desc="Prontidão e treino de hoje"
            value={prefs.morning}
            onChange={v => patch({ morning: v })}
          />
          <ReminderRow
            icon="🌙"
            title="Fechar o dia"
            desc="Só toca se você não registrou nada"
            value={prefs.eveningNudge}
            onChange={v => patch({ eveningNudge: v })}
          />
          <ReminderRow
            icon="🔥"
            title="Sequência em risco"
            desc="Só toca com sequência viva e dia em aberto"
            value={prefs.streakAlert}
            onChange={v => patch({ streakAlert: v })}
          />

          <div style={{ fontSize: T.text.sm, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, margin: '14px 0 6px' }}>
            Por hábito
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
            No horário em que o hábito acontece — e só se ainda estiver pendente.
          </div>
          {habitDefs.map(h => (
            <ReminderRow
              key={h.id}
              icon={h.icon}
              title={h.label}
              desc={prefs.habitTimes[h.id] ? 'Lembrete ativo' : 'Sem lembrete'}
              value={prefs.habitTimes[h.id] ?? null}
              onChange={v => {
                const habitTimes = { ...prefs.habitTimes }
                if (v === null) delete habitTimes[h.id]
                else habitTimes[h.id] = v
                patch({ habitTimes })
              }}
            />
          ))}

          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
            Com o app aberto os avisos saem daqui. Fechado, dependem do push do
            navegador{isMobile ? ' — instale o app na tela inicial para que funcionem melhor' : ''}.
          </div>
        </div>
      )}
    </Card>
  )
}
