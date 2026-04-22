import { useState } from 'react'
import { C } from './data'

interface Props {
  service: string
  onClose: () => void
  onConnect: (service: string) => void
}

export function ConnectModal({ service, onClose, onConnect }: Props) {
  const [step, setStep] = useState(0)
  const isStrava = service === "strava"
  const color = isStrava ? C.strava : C.webdiet
  const name = isStrava ? "Strava" : "WebDiet"
  const icon = isStrava ? "🏃" : "🥗"
  const perms = isStrava
    ? ["Atividades (corrida, ciclismo, natação)", "Frequência cardíaca e zonas", "Elevação, rotas e distância", "Recordes pessoais e volume"]
    : ["Plano alimentar ativo do nutricionista", "Macros e calorias por refeição", "Lista detalhada de alimentos", "Histórico nutricional"]

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, maxWidth: 400, width: "100%", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>

        {step === 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Conectar {name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>OAuth 2.0 · Conexão segura</div>
              </div>
            </div>
            <div style={{ background: C.card2, borderRadius: 12, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8 }}>O Rise Plan vai acessar:</div>
              {perms.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < perms.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ color: C.green, fontSize: 12, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: C.muted2 }}>{p}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.6, padding: "10px 14px", background: C.card2, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
              🔒 Nunca acessamos sua senha. Você pode revogar o acesso quando quiser.
            </div>
            <button
              onClick={() => { setStep(1); setTimeout(() => setStep(2), 2400) }}
              style={{ width: "100%", background: color, border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer" }}>
              Autorizar com {name} →
            </button>
          </>
        )}

        {step === 1 && (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Conectando ao {name}...</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Sincronizando seus dados. Aguarde.</div>
            <div style={{ height: 3, background: C.border, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: 3, background: color, borderRadius: 4, animation: "prog 2.4s linear forwards" }} />
            </div>
            <style>{`@keyframes prog{from{width:0}to{width:100%}}`}</style>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Conectado com sucesso!</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 26, lineHeight: 1.7 }}>
              Seus dados do {name} já estão no dashboard. A sincronização é automática daqui em diante.
            </div>
            <button
              onClick={() => { onConnect(service); onClose() }}
              style={{ width: "100%", background: color, border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer" }}>
              Ver dados no dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
