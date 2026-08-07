import { useContext, useState } from 'react'
import { C, T } from '../data'
import { LayoutContext } from '../LayoutContext'
import { useAthleteStore } from '../../store/useAthleteStore'
import {
  hrZones, maxHrOf, restingHrOf, isAthleteProfileComplete,
  type Sex, type AthleteProfile,
} from '../../lib/athleteProfile'
import { toast } from '../../lib/toast'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.card2,
  border: `1px solid ${C.border2}`,
  borderRadius: T.radius.sm,
  padding: '10px 12px',
  color: C.text,
  fontSize: T.text.md,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: T.text.sm, color: C.muted, display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8,
}

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
  { value: 'NA', label: 'Prefiro não dizer' },
]

function toForm(p: AthleteProfile) {
  return {
    birthYear: p.birthYear ? String(p.birthYear) : '',
    weightKg: p.weightKg ? String(p.weightKg) : '',
    heightCm: p.heightCm ? String(p.heightCm) : '',
    restingHr: p.restingHr ? String(p.restingHr) : '',
    maxHr: p.maxHr ? String(p.maxHr) : '',
    sex: (p.sex ?? 'NA') as Sex,
  }
}

/**
 * Dados fisiológicos do atleta. Sem eles todo o app funciona, mas com valores
 * genéricos: FC máxima estimada por idade padrão, zonas de treino de "uma
 * pessoa média" e TRIMP calibrado errado. Os quatro campos aqui são o que
 * transforma os números do app nos números DESTE atleta.
 */
export function AthleteProfileForm() {
  const { profile, update } = useAthleteStore()
  const { isMobile } = useContext(LayoutContext)

  const [form, setForm] = useState(() => toForm(profile))

  // O perfil chega da nuvem DEPOIS da primeira renderização, então o formulário
  // precisa ser resincronizado quando isso acontece. Ajustar o estado durante a
  // renderização (em vez de num efeito) evita o flash do formulário vazio.
  const [syncedFrom, setSyncedFrom] = useState(profile)
  if (syncedFrom !== profile) {
    setSyncedFrom(profile)
    setForm(toForm(profile))
  }

  function handleSave() {
    const toNumber = (raw: string, min: number, max: number): number | null => {
      const n = Number(raw)
      if (!raw.trim() || !Number.isFinite(n) || n < min || n > max) return null
      return Math.round(n)
    }

    update({
      birthYear: toNumber(form.birthYear, 1920, new Date().getFullYear() - 8),
      weightKg: toNumber(form.weightKg, 25, 300),
      heightCm: toNumber(form.heightCm, 100, 250),
      restingHr: toNumber(form.restingHr, 28, 110),
      maxHr: toNumber(form.maxHr, 120, 230),
      sex: form.sex as Sex,
    })
    toast.success('💪 Perfil de atleta salvo — suas zonas e cargas foram recalculadas')
  }

  const zones = hrZones(profile)
  const complete = isAthleteProfileComplete(profile)

  return (
    <>
      <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
        Estes números individualizam suas zonas de frequência cardíaca, o cálculo de carga de cada treino e a estimativa de calorias. Sem eles o app usa uma média genérica.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Ano de nascimento</label>
          <input
            type="number" inputMode="numeric"
            value={form.birthYear}
            onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))}
            placeholder="1990"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Peso (kg)</label>
          <input
            type="number" inputMode="decimal"
            value={form.weightKg}
            onChange={e => setForm(f => ({ ...f, weightKg: e.target.value }))}
            placeholder="72"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Altura (cm)</label>
          <input
            type="number" inputMode="numeric"
            value={form.heightCm}
            onChange={e => setForm(f => ({ ...f, heightCm: e.target.value }))}
            placeholder="178"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>FC repouso (bpm)</label>
          <input
            type="number" inputMode="numeric"
            value={form.restingHr}
            onChange={e => setForm(f => ({ ...f, restingHr: e.target.value }))}
            placeholder="58"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>FC máxima (bpm)</label>
          <input
            type="number" inputMode="numeric"
            value={form.maxHr}
            onChange={e => setForm(f => ({ ...f, maxHr: e.target.value }))}
            placeholder={String(maxHrOf(profile))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Sexo biológico</label>
          <select
            value={form.sex}
            onChange={e => setForm(f => ({ ...f, sex: e.target.value as Sex }))}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          >
            {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ fontSize: T.text.sm, color: C.muted, lineHeight: 1.55, marginBottom: 16 }}>
        Deixe a FC máxima em branco se nunca mediu — ela é estimada pela sua idade ({maxHrOf(profile)} bpm). A FC de repouso é a medida ao acordar, ainda deitado. O sexo biológico entra apenas na fórmula de carga de treino (TRIMP).
      </div>

      <button
        onClick={handleSave}
        style={{
          background: C.orange, border: 'none', borderRadius: T.radius.sm,
          padding: '10px 20px', color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer',
        }}
      >
        Salvar perfil de atleta
      </button>

      {complete && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Suas zonas de treino ({restingHrOf(profile)}–{maxHrOf(profile)} bpm)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {zones.map(z => (
              <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card2, borderRadius: T.radius.sm, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <div style={{ width: 3, height: 24, borderRadius: 2, background: z.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: C.text }}>{z.label}</div>
                  <div style={{ fontSize: T.text.sm, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.description}</div>
                </div>
                <div style={{ fontSize: T.text.md, fontWeight: T.weight.extrabold, color: z.color, flexShrink: 0 }}>
                  {z.minHr}–{z.maxHr}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
