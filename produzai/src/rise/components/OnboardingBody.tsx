// Campos corporais do onboarding, compartilhados pelos dois fluxos (wizard
// rápido e revisão do plano da IA). Com peso, altura, nascimento, sexo e nível
// de atividade dá para calcular o gasto diário — e as metas de macro deixam de
// ser um slider no chute.

import { T, C, displayStyle } from '../data'
import { ACTIVITY_LEVELS, MACRO_GOALS, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from '../../lib/body'
import { MIN_WEIGHT_KG, MAX_WEIGHT_KG } from '../../lib/calories'
import { todayKey } from '../../lib/date'
import { draftMacros, type BodyDraft } from '../../lib/bodyDraft'

const inp: React.CSSProperties = {
  width: '100%', background: C.card2, border: `1px solid ${C.border2}`,
  borderRadius: T.radius.md, padding: '11px 14px', color: C.text,
  fontSize: T.text.lg, outline: 'none', boxSizing: 'border-box',
}

const label: React.CSSProperties = {
  fontSize: T.text.sm, color: C.muted, display: 'block', marginBottom: 6,
}

function chip(selected: boolean): React.CSSProperties {
  return {
    padding: '7px 13px', borderRadius: T.radius.sm, cursor: 'pointer',
    fontSize: T.text.base, fontWeight: selected ? T.weight.bold : T.weight.regular,
    background: selected ? C.orange : C.card2,
    border: `1px solid ${selected ? C.orange : C.border2}`,
    color: selected ? '#fff' : C.muted,
  }
}

interface Props {
  draft: BodyDraft
  setDraft: (patch: Partial<BodyDraft>) => void
}

export function OnboardingBody({ draft, setDraft }: Props) {
  const macros = draftMacros(draft)

  return (
    <div style={{ background: '#1A1A1A', borderRadius: T.radius.lg, padding: 16, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={label}>Peso (kg)</label>
          <input
            type="number" inputMode="decimal" step="0.1"
            min={MIN_WEIGHT_KG} max={MAX_WEIGHT_KG}
            value={draft.weight}
            onChange={e => setDraft({ weight: e.target.value })}
            placeholder="74.5"
            style={inp}
          />
        </div>
        <div>
          <label style={label}>Altura (cm)</label>
          <input
            type="number" inputMode="numeric"
            min={MIN_HEIGHT_CM} max={MAX_HEIGHT_CM}
            value={draft.height}
            onChange={e => setDraft({ height: e.target.value })}
            placeholder="178"
            style={inp}
          />
        </div>
        <div>
          <label style={label}>Nascimento</label>
          <input
            type="date"
            value={draft.birthDate}
            max={todayKey()}
            onChange={e => setDraft({ birthDate: e.target.value })}
            style={{ ...inp, colorScheme: 'dark' }}
          />
        </div>
        <div>
          <label style={label}>Sexo</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['masculino', 'feminino'] as const).map(s => (
              <button key={s} onClick={() => setDraft({ sex: s })} style={{ ...chip(draft.sex === s), flex: 1, padding: '10px 4px' }}>
                {s === 'masculino' ? 'M' : 'F'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={label}>Quanto você se move fora dos treinos</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ACTIVITY_LEVELS.map(a => (
            <button key={a.value} onClick={() => setDraft({ activityLevel: a.value })} title={a.desc} style={chip(draft.activityLevel === a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: macros ? 14 : 0 }}>
        <label style={label}>Seu objetivo agora</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MACRO_GOALS.map(g => (
            <button key={g.value} onClick={() => setDraft({ goal: g.value })} title={g.desc} style={chip(draft.goal === g.value)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {macros ? (
        <div style={{ background: `${C.green}0D`, border: `1px solid ${C.green}33`, borderRadius: T.radius.md, padding: '12px 14px' }}>
          <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
            Seu gasto estimado é <strong style={{ color: C.text }}>{macros.tdee} kcal por dia</strong>.
            Para {MACRO_GOALS.find(g => g.value === draft.goal)?.label.toLowerCase()}, a meta fica em:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { l: 'Kcal', v: macros.cal,  c: C.orange },
              { l: 'Prot', v: macros.prot, c: C.blue },
              { l: 'Carb', v: macros.carb, c: C.green },
              { l: 'Gord', v: macros.fat,  c: C.purple },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: c + '18', borderRadius: T.radius.md, padding: '10px 8px', textAlign: 'center', border: `1px solid ${c}33` }}>
                <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.extrabold, color: c, ...displayStyle }}>{v}</div>
                <div style={{ fontSize: T.text.xs, color: C.muted, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: T.text.sm, color: C.muted, lineHeight: 1.5 }}>
          Preencha peso, altura, nascimento e sexo para o app calcular seu gasto
          diário e sugerir as metas — em vez de você chutar no slider.
        </div>
      )}
    </div>
  )
}
