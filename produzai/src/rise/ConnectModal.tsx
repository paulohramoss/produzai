import { useState } from 'react'
import { C } from './data'
import { getAuthUrl } from '../services/strava'
import { useWebDietStore, type WebDietGoals } from '../store/useWebDietStore'

interface Props {
  service: string
  onClose: () => void
  onConnect: (service: string) => void
}

const DEFAULT_GOALS: WebDietGoals = { cal: 2420, prot: 205, carb: 278, fat: 68 }

const inputStyle = {
  background: '#0C0C0C',
  border: `1px solid ${C.border2}`,
  borderRadius: 8,
  padding: '9px 10px',
  color: C.text,
  fontSize: 14,
  width: '100%',
  outline: 'none',
} as React.CSSProperties

export function ConnectModal({ service, onClose, onConnect }: Props) {
  const [step, setStep] = useState(0)
  const [goals, setGoals] = useState<WebDietGoals>({ ...DEFAULT_GOALS })
  const wdStore = useWebDietStore()

  const isStrava = service === "strava"
  const color = isStrava ? C.strava : C.webdiet
  const name = isStrava ? "Strava" : "WebDiet"
  const icon = isStrava ? "🏃" : "🥗"

  const stravaPerms = [
    "Atividades (corrida, ciclismo, natação)",
    "Frequência cardíaca e zonas",
    "Elevação, rotas e distância",
    "Recordes pessoais e volume",
  ]

  const setGoal = (k: keyof WebDietGoals, v: string) =>
    setGoals(g => ({ ...g, [k]: +v || 0 }))

  const saveGoals = () => {
    wdStore.setup(goals)
    setStep(2)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, maxWidth: 420, width: "100%", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>

        {/* ── Step 0: info screen ── */}
        {step === 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Conectar {name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{isStrava ? "OAuth 2.0 · Conexão segura" : "Entrada manual · Seus dados privados"}</div>
              </div>
            </div>

            {isStrava ? (
              <>
                <div style={{ background: C.card2, borderRadius: 12, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8 }}>O Rise Plan vai acessar:</div>
                  {stravaPerms.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < stravaPerms.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <span style={{ color: C.green, fontSize: 12, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: C.muted2 }}>{p}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.6, padding: "10px 14px", background: C.card2, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                  🔒 Nunca acessamos sua senha. Você pode revogar o acesso quando quiser.
                </div>
              </>
            ) : (
              <>
                <div style={{ background: C.card2, borderRadius: 12, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8 }}>O que você vai configurar:</div>
                  {["Metas diárias de calorias e macros", "Refeições com horários e alimentos", "Acompanhe o que já comeu hoje", "Visualize balanço calórico com Strava"].map((p, i, arr) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <span style={{ color: C.green, fontSize: 12, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: C.muted2 }}>{p}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.6, padding: "10px 14px", background: C.card2, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                  💡 O WebDiet não tem API pública. Você configura o plano manualmente e edita quando quiser na aba Dieta.
                </div>
              </>
            )}

            <button
              onClick={() => isStrava ? (window.location.href = getAuthUrl()) : setStep(1)}
              style={{ width: "100%", background: color, border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer" }}>
              {isStrava ? "Autorizar com Strava →" : "Configurar Manualmente →"}
            </button>
          </>
        )}

        {/* ── Step 1: goals form (WebDiet only) ── */}
        {step === 1 && !isStrava && (
          <>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>🎯 Metas diárias</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 22 }}>
              Defina seus objetivos nutricionais. Você pode ajustar depois.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              {([
                { k: 'cal',  l: 'Calorias', u: 'kcal', c: C.orange },
                { k: 'prot', l: 'Proteína', u: 'g',    c: C.blue },
                { k: 'carb', l: 'Carboidrato', u: 'g', c: C.green },
                { k: 'fat',  l: 'Gordura', u: 'g',     c: C.purple },
              ] as { k: keyof WebDietGoals; l: string; u: string; c: string }[]).map(({ k, l, u, c }) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 700, letterSpacing: .6 }}>
                    {l} <span style={{ color: C.muted, fontWeight: 400 }}>({u})</span>
                  </div>
                  <input
                    type="number"
                    value={goals[k] || ''}
                    onChange={e => setGoal(k, e.target.value)}
                    style={{ ...inputStyle, color: c, fontSize: 16, fontWeight: 700 }}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, padding: "10px 14px", background: C.card2, borderRadius: 8, borderLeft: `3px solid ${C.webdiet}`, lineHeight: 1.6 }}>
              🥗 Após salvar, adicione suas refeições na aba <strong style={{ color: C.text }}>Dieta</strong>.
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(0)}
                style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 18px", fontSize: 14, color: C.muted, cursor: "pointer" }}>
                ← Voltar
              </button>
              <button
                onClick={saveGoals}
                disabled={!goals.cal}
                style={{ flex: 1, background: goals.cal ? C.webdiet : C.card2, border: "none", borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 800, color: goals.cal ? "#fff" : C.muted, cursor: goals.cal ? "pointer" : "default" }}>
                Salvar e Continuar →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: success ── */}
        {step === 2 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              {isStrava ? "Conectado com sucesso!" : "Plano criado!"}
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 26, lineHeight: 1.7 }}>
              {isStrava
                ? "Seus dados do Strava já estão no dashboard. A sincronização é automática."
                : "Suas metas foram salvas. Agora vá para a aba Dieta para adicionar suas refeições."}
            </div>
            <button
              onClick={() => { onConnect(service); onClose() }}
              style={{ width: "100%", background: color, border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer" }}>
              {isStrava ? "Ver dados no dashboard →" : "Ir para a Dieta →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
