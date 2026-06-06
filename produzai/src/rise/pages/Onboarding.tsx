import { useState } from 'react'
import { C } from '../data'
import { useAuthStore } from '../../store/useAuthStore'
import { saveProfile } from '../../lib/db'
import { useWebDietStore } from '../../store/useWebDietStore'
import { toast } from '../../lib/toast'

const HABITS_OPTIONS = [
  { id: 'agua',      icon: '💧', label: 'Água 3L' },
  { id: 'treino',    icon: '🏋', label: 'Treino diário' },
  { id: 'leitura',   icon: '📚', label: 'Leitura 30min' },
  { id: 'meditacao', icon: '🧘', label: 'Meditação' },
  { id: 'sono',      icon: '😴', label: 'Dormir bem' },
  { id: 'proteina',  icon: '🥩', label: 'Meta de proteína' },
  { id: 'caminhada', icon: '🚶', label: 'Caminhada diária' },
  { id: 'sem_acucar',icon: '🚫', label: 'Sem açúcar' },
]

const GOALS_OPTIONS = [
  { id: 'perder_peso',  icon: '⚖️',  label: 'Perder peso' },
  { id: 'ganhar_massa', icon: '💪',  label: 'Ganhar massa muscular' },
  { id: 'mais_energia', icon: '⚡',  label: 'Ter mais energia' },
  { id: 'produtividade',icon: '🎯',  label: 'Ser mais produtivo' },
  { id: 'saude_mental', icon: '🧠',  label: 'Melhorar saúde mental' },
  { id: 'correr',       icon: '🏃',  label: 'Correr / cardio' },
]

export function Onboarding() {
  const { user, setOnboardingDone } = useAuthStore()
  const setupDiet = useWebDietStore(s => s.setup)

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 0 — objetivos
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])

  // Step 1 — metas nutricionais
  const [macros, setMacros] = useState({ cal: 2000, prot: 150, carb: 200, fat: 60 })

  // Step 2 — hábitos
  const [selectedHabits, setSelectedHabits] = useState<string[]>(['agua', 'treino', 'leitura', 'proteina'])

  const STEPS = ['Seus objetivos', 'Nutrição', 'Hábitos diários']
  const firstName = user?.displayName?.split(' ')[0] || 'atleta'

  function toggleGoal(id: string) {
    setSelectedGoals(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function toggleHabit(id: string) {
    setSelectedHabits(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  async function finish() {
    setSaving(true)
    // Salva plano de dieta com as metas definidas
    setupDiet(macros)
    // Marca onboarding como concluído no Firestore
    await saveProfile({ onboardingDone: true, createdAt: Date.now() })
    setOnboardingDone(true)
    toast.success(`🚀 Bem-vindo ao The Rise Plan, ${firstName}!`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/rise-plan-logo.svg" alt="The Rise Plan" style={{ width: 160, borderRadius: 12, marginBottom: 16 }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>
            Olá, {firstName}! 👋
          </div>
          <div style={{ fontSize: 14, color: C.muted }}>Vamos configurar seu plano em 3 passos rápidos</div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                height: 4, width: '100%', borderRadius: 4,
                background: i <= step ? C.orange : C.border2,
                transition: 'background 0.3s',
              }} />
              <div style={{ fontSize: 10, color: i <= step ? C.orange : C.muted, fontWeight: i === step ? 700 : 400 }}>
                {s}
              </div>
            </div>
          ))}
        </div>

        {/* ── STEP 0: Objetivos ── */}
        {step === 0 && (
          <div className="fade-in">
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Quais são seus objetivos?</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Selecione todos que se aplicam</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {GOALS_OPTIONS.map(g => {
                const sel = selectedGoals.includes(g.id)
                return (
                  <div
                    key={g.id}
                    onClick={() => toggleGoal(g.id)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      background: sel ? `${C.orange}18` : '#1A1A1A',
                      border: `2px solid ${sel ? C.orange : C.border}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{g.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: sel ? 700 : 400, color: sel ? C.text : C.muted }}>
                      {g.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setStep(1)}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: C.orange, border: 'none',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ── STEP 1: Nutrição ── */}
        {step === 1 && (
          <div className="fade-in">
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Metas nutricionais diárias</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Você pode ajustar depois na página de Dieta</div>

            <div style={{
              background: '#1A1A1A', borderRadius: 12, padding: 16, marginBottom: 20,
              border: `1px solid ${C.border}`,
            }}>
              {[
                { k: 'cal'  as const, label: 'Calorias', unit: 'kcal', color: C.orange, min: 1200, max: 5000, step: 50 },
                { k: 'prot' as const, label: 'Proteína', unit: 'g',    color: C.blue,   min: 50,   max: 400,  step: 5  },
                { k: 'carb' as const, label: 'Carboidratos', unit: 'g', color: C.green, min: 50,   max: 600,  step: 5  },
                { k: 'fat'  as const, label: 'Gorduras',  unit: 'g',   color: C.purple, min: 20,   max: 200,  step: 5  },
              ].map(({ k, label, unit, color, min, max, step: s }, i, arr) => (
                <div key={k} style={{ marginBottom: i === arr.length - 1 ? 0 : 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color }}>
                      {macros[k]} {unit}
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={s}
                    value={macros[k]}
                    onChange={e => setMacros(m => ({ ...m, [k]: +e.target.value }))}
                    style={{ width: '100%', accentColor: color }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
              {[
                { l: 'Kcal',  v: macros.cal,  c: C.orange },
                { l: 'Prot',  v: macros.prot, c: C.blue   },
                { l: 'Carb',  v: macros.carb, c: C.green  },
                { l: 'Gord',  v: macros.fat,  c: C.purple },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: c + '18', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: `1px solid ${c}33` }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(0)}
                style={{ flex: 1, padding: '13px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                ← Voltar
              </button>
              <button
                onClick={() => setStep(2)}
                style={{ flex: 2, padding: '13px', borderRadius: 12, background: C.orange, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Hábitos ── */}
        {step === 2 && (
          <div className="fade-in">
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Quais hábitos quer desenvolver?</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Estes aparecerão no seu checklist diário</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {HABITS_OPTIONS.map(h => {
                const sel = selectedHabits.includes(h.id)
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHabit(h.id)}
                    style={{
                      padding: '13px 14px', borderRadius: 12, cursor: 'pointer',
                      background: sel ? `${C.green}15` : '#1A1A1A',
                      border: `2px solid ${sel ? C.green : C.border}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{h.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: sel ? 700 : 400, color: sel ? C.text : C.muted }}>
                      {h.label}
                    </span>
                    {sel && <span style={{ marginLeft: 'auto', color: C.green, fontSize: 12 }}>✓</span>}
                  </div>
                )
              })}
            </div>

            {selectedHabits.length === 0 && (
              <div style={{ fontSize: 12, color: C.red, textAlign: 'center', marginBottom: 16 }}>
                Selecione ao menos 1 hábito
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{ flex: 1, padding: '13px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                ← Voltar
              </button>
              <button
                onClick={finish}
                disabled={selectedHabits.length === 0 || saving}
                style={{
                  flex: 2, padding: '13px', borderRadius: 12, border: 'none',
                  background: selectedHabits.length > 0 ? C.green : C.border2,
                  color: selectedHabits.length > 0 ? '#fff' : C.muted,
                  fontSize: 15, fontWeight: 700,
                  cursor: selectedHabits.length > 0 && !saving ? 'pointer' : 'default',
                }}
              >
                {saving ? 'Salvando...' : '🚀 Começar agora!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
