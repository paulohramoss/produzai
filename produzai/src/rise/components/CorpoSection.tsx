// Perfil corporal: peso, altura, nascimento, sexo e nível de atividade.
//
// É a base do resto — sem esses dados o gasto calórico do treino usa um peso de
// referência, os macros viram chute e o Coach fala no escuro. A curva de peso
// mora aqui também: é o número que o atleta acompanha semana a semana.

import { useState, useEffect, useContext } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Scale, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, ChartTooltip } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { useAuthStore } from '../../store/useAuthStore'
import { toast } from '../../lib/toast'
import { MIN_WEIGHT_KG, MAX_WEIGHT_KG, REFERENCE_WEIGHT_KG } from '../../lib/calories'
import {
  ACTIVITY_LEVELS, MIN_HEIGHT_CM, MAX_HEIGHT_CM,
  ageFromBirthDate, computeBmi, computeBmr, computeTdee, weightTrend,
} from '../../lib/body'
import { todayKey } from '../../lib/date'
import type { ActivityLevel } from '../../lib/db'

const inp: React.CSSProperties = {
  width: '100%', background: '#1C1C1C', border: `1px solid ${C.border2}`,
  borderRadius: T.radius.md, padding: '11px 14px', color: C.text,
  fontSize: T.text.lg, outline: 'none', boxSizing: 'border-box',
}

const label: React.CSSProperties = {
  fontSize: T.text.sm, color: C.muted, display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8,
}

function chipStyle(selected: boolean, color = C.orange): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: T.radius.sm, cursor: 'pointer',
    fontSize: T.text.base, fontWeight: selected ? T.weight.bold : T.weight.regular,
    background: selected ? color : C.card2,
    border: `1px solid ${selected ? color : C.border2}`,
    color: selected ? '#fff' : C.muted,
  }
}

function parseNum(raw: string): number {
  return parseFloat(raw.replace(',', '.'))
}

function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${d}/${m}`
}

export function CorpoSection() {
  const { isMobile } = useContext(LayoutContext)
  const body              = useAuthStore(s => s.body)
  const weightLog         = useAuthStore(s => s.weightLog)
  const setBody           = useAuthStore(s => s.setBody)
  const logWeight         = useAuthStore(s => s.logWeight)
  const removeWeightEntry = useAuthStore(s => s.removeWeightEntry)

  const [weightInput, setWeightInput] = useState(body.weightKg != null ? String(body.weightKg) : '')
  const [heightInput, setHeightInput] = useState(body.heightCm != null ? String(body.heightCm) : '')
  const [birthInput,  setBirthInput]  = useState(body.birthDate ?? '')
  const [saving, setSaving] = useState(false)

  // Se o perfil chegar da nuvem depois da primeira renderização, os campos seguem.
  useEffect(() => { setWeightInput(body.weightKg != null ? String(body.weightKg) : '') }, [body.weightKg])
  useEffect(() => { setHeightInput(body.heightCm != null ? String(body.heightCm) : '') }, [body.heightCm])
  useEffect(() => { setBirthInput(body.birthDate ?? '') }, [body.birthDate])

  const parsedWeight = parseNum(weightInput)
  const weightValid  = Number.isFinite(parsedWeight) && parsedWeight >= MIN_WEIGHT_KG && parsedWeight <= MAX_WEIGHT_KG
  const weightDirty  = weightValid && parsedWeight !== body.weightKg

  const parsedHeight = parseNum(heightInput)
  const heightValid  = Number.isFinite(parsedHeight) && parsedHeight >= MIN_HEIGHT_CM && parsedHeight <= MAX_HEIGHT_CM
  const heightDirty  = heightValid && parsedHeight !== body.heightCm

  const age  = ageFromBirthDate(body.birthDate)
  const bmi  = computeBmi(body.weightKg, body.heightCm)
  const bmr  = computeBmr(body)
  const tdee = computeTdee(body)
  const trend = weightTrend(weightLog, 30)

  const missing: string[] = []
  if (body.weightKg == null) missing.push('peso')
  if (body.heightCm == null) missing.push('altura')
  if (age == null) missing.push('data de nascimento')
  if (!body.sex) missing.push('sexo')

  async function handleLogWeight() {
    if (!weightValid) {
      toast.error(`Peso deve estar entre ${MIN_WEIGHT_KG} e ${MAX_WEIGHT_KG} kg`)
      return
    }
    setSaving(true)
    try {
      await logWeight(parsedWeight)
      toast.success(`⚖️ ${parsedWeight} kg registrado hoje`)
    } catch {
      toast.error('Erro ao registrar peso')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveHeight() {
    if (!heightValid) {
      toast.error(`Altura deve estar entre ${MIN_HEIGHT_CM} e ${MAX_HEIGHT_CM} cm`)
      return
    }
    await setBody({ heightCm: Math.round(parsedHeight) })
    toast.success('📏 Altura atualizada')
  }

  async function handleSaveBirth(value: string) {
    setBirthInput(value)
    if (!value) return
    if (ageFromBirthDate(value) == null) {
      toast.error('Data de nascimento fora do intervalo aceito')
      return
    }
    await setBody({ birthDate: value })
  }

  const chartData = weightLog.slice(-60).map(e => ({ label: shortDate(e.date), kg: e.kg }))
  const recent = [...weightLog].reverse().slice(0, 6)

  const TrendIcon = trend?.direction === 'subindo' ? TrendingUp
    : trend?.direction === 'descendo' ? TrendingDown : Minus
  const trendColor = trend?.direction === 'estavel' ? C.muted2
    : trend?.direction === 'descendo' ? C.blue : C.orange

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.text.base, fontWeight: T.weight.bold, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
        <Scale size={15} /> Corpo
      </div>

      {/* Peso — o campo que também registra a pesagem do dia */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={label}>Peso (kg)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" inputMode="decimal" step="0.1"
              min={MIN_WEIGHT_KG} max={MAX_WEIGHT_KG}
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              placeholder="ex: 74.5"
              style={inp}
            />
            <button
              onClick={handleLogWeight}
              disabled={!weightValid || saving}
              style={{
                background: weightDirty ? C.orange : C.card2,
                border: `1px solid ${weightDirty ? C.orange : C.border2}`,
                borderRadius: T.radius.md, padding: '0 16px', flexShrink: 0,
                color: weightDirty ? '#fff' : C.muted,
                fontSize: T.text.md, fontWeight: T.weight.bold,
                cursor: weightValid && !saving ? 'pointer' : 'default',
              }}
            >
              {saving ? '...' : 'Registrar'}
            </button>
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6 }}>
            Registrar guarda a pesagem de hoje na sua curva de peso.
          </div>
        </div>

        <div>
          <label style={label}>Altura (cm)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" inputMode="numeric"
              min={MIN_HEIGHT_CM} max={MAX_HEIGHT_CM}
              value={heightInput}
              onChange={e => setHeightInput(e.target.value)}
              placeholder="ex: 178"
              style={inp}
            />
            <button
              onClick={handleSaveHeight}
              disabled={!heightDirty}
              style={{
                background: heightDirty ? C.orange : C.card2,
                border: `1px solid ${heightDirty ? C.orange : C.border2}`,
                borderRadius: T.radius.md, padding: '0 16px', flexShrink: 0,
                color: heightDirty ? '#fff' : C.muted,
                fontSize: T.text.md, fontWeight: T.weight.bold,
                cursor: heightDirty ? 'pointer' : 'default',
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* Nascimento e sexo */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={label}>Data de nascimento</label>
          <input
            type="date"
            value={birthInput}
            max={todayKey()}
            onChange={e => handleSaveBirth(e.target.value)}
            style={{ ...inp, colorScheme: 'dark' }}
          />
          {age != null && (
            <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6 }}>{age} anos</div>
          )}
        </div>

        <div>
          <label style={label}>Sexo</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['masculino', 'feminino'] as const).map(s => (
              <button key={s} onClick={() => setBody({ sex: s })} style={{ ...chipStyle(body.sex === s), flex: 1 }}>
                {s === 'masculino' ? 'Masculino' : 'Feminino'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6 }}>
            A fórmula de gasto energético usa constantes diferentes.
          </div>
        </div>
      </div>

      {/* Nível de atividade */}
      <div style={{ marginBottom: 18 }}>
        <label style={label}>Nível de atividade</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ACTIVITY_LEVELS.map(a => (
            <button
              key={a.value}
              onClick={() => setBody({ activityLevel: a.value as ActivityLevel })}
              title={a.desc}
              style={chipStyle(body.activityLevel === a.value)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6 }}>
          {ACTIVITY_LEVELS.find(a => a.value === body.activityLevel)?.desc
            ?? 'Conte o quanto você se move fora dos treinos registrados.'}
        </div>
      </div>

      {/* Números derivados */}
      {missing.length > 0 ? (
        <div style={{ background: `${C.orange}0D`, border: `1px solid ${C.orange}33`, borderRadius: T.radius.md, padding: '12px 14px', fontSize: T.text.base, color: C.text, lineHeight: 1.6, marginBottom: 16 }}>
          Falta {missing.join(', ')} para calcular seu gasto energético e sugerir macros.
          Enquanto isso, o gasto calórico dos treinos usa um peso de referência de {REFERENCE_WEIGHT_KG}kg.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { l: 'Idade',        v: `${age}`,          sub: 'anos',                    c: C.muted2 },
            { l: 'IMC',          v: `${bmi?.value}`,   sub: bmi?.label ?? '',          c: C.blue },
            { l: 'Basal (BMR)',  v: `${bmr}`,          sub: 'kcal parado',             c: C.purple },
            { l: 'Gasto (TDEE)', v: `${tdee}`,         sub: 'kcal por dia',            c: C.orange },
          ].map(k => (
            <div key={k.l} style={{ background: C.card2, borderRadius: T.radius.md, padding: '12px 14px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{k.l}</div>
              <div style={{ fontSize: T.text['4xl'], fontWeight: T.weight.extrabold, color: k.c, ...displayStyle }}>{k.v}</div>
              <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {bmi && (
        <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          O IMC não separa músculo de gordura — em quem treina pesado ele costuma
          exagerar. Use a curva de peso e as fotos de progresso como leitura principal.
        </div>
      )}

      {/* Curva de peso */}
      {weightLog.length >= 2 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: T.weight.bold, fontSize: T.text.lg, ...displayStyle }}>Curva de peso</div>
            {trend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.text.base, color: trendColor, fontWeight: T.weight.bold }}>
                <TrendIcon size={15} />
                {trend.deltaKg > 0 ? '+' : ''}{trend.deltaKg} kg em {trend.days} dias
                <span style={{ color: C.muted, fontWeight: T.weight.regular }}>
                  ({trend.perWeek > 0 ? '+' : ''}{trend.perWeek} kg/semana)
                </span>
              </div>
            )}
          </div>
          <div style={{ width: '100%', height: 180, marginBottom: 14 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="kg" name="kg" stroke={C.orange} strokeWidth={2} dot={{ r: 2, fill: C.orange }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '16px 0', lineHeight: 1.6 }}>
          Registre seu peso alguns dias para ver a curva.<br />
          Uma pesagem por semana, sempre no mesmo horário, já mostra a tendência.
        </div>
      )}

      {/* Últimas pesagens */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: T.text.sm, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Últimas pesagens
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recent.map(e => (
              <div key={e.date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: C.card2, borderRadius: T.radius.sm, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: T.text.base, color: C.muted, minWidth: 52 }}>{shortDate(e.date)}</span>
                <span style={{ flex: 1, fontSize: T.text.md, fontWeight: T.weight.semibold }}>{e.kg} kg</span>
                <button
                  onClick={() => removeWeightEntry(e.date)}
                  title="Remover pesagem"
                  style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text['2xl'], padding: '0 2px', lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
