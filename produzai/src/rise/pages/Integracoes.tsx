import { useState } from 'react'
import { C, type Page } from '../data'
import { Tag, Dot } from '../primitives'
import { ConnectModal } from '../ConnectModal'

interface Props {
  connected: string[]
  onConnect: (service: string) => void
}

const services = [
  {
    id: "strava", name: "Strava", icon: "🏃", color: C.strava,
    desc: "Corrida, ciclismo e natação com pace, FC e rotas.",
    perks: ["Sync automático por atividade", "Zonas de FC", "Volume e recordes"],
  },
  {
    id: "webdiet", name: "WebDiet", icon: "🥗", color: C.webdiet,
    desc: "Plano alimentar do nutricionista com macros por refeição.",
    perks: ["Plano ao vivo do nutricionista", "Macros por refeição", "Histórico nutricional"],
  },
  {
    id: "garmin", name: "Garmin Connect", icon: "⌚", color: C.blue,
    desc: "Sono, estresse, SpO2 e FC 24h.",
    perks: ["Score de sono", "Estresse contínuo", "Dados de saúde"],
    soon: true,
  },
  {
    id: "mfp", name: "MyFitnessPal", icon: "📊", color: C.purple,
    desc: "Rastreamento de calorias e macros alternativo.",
    perks: ["Banco de alimentos", "Código de barras", "Histórico"],
    soon: true,
  },
]

export function Integracoes({ connected, onConnect }: Props) {
  const [modal, setModal] = useState<string | null>(null)

  return (
    <>
      {modal && <ConnectModal service={modal} onClose={() => setModal(null)} onConnect={onConnect} />}
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🔗 Integrações</div>
          <div style={{ fontSize: 13, color: C.muted }}>Conecte uma vez — dados entram sozinhos no dashboard</div>
        </div>

        {connected.length > 0 && (
          <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Dot color={C.green} />
            <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>{connected.length} ativas:</span>
            {connected.map(c => <Tag key={c} label={c === "strava" ? "Strava" : "WebDiet"} color={c === "strava" ? C.strava : C.webdiet} />)}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {services.map((s, i) => {
            const isOn = connected.includes(s.id)
            return (
              <div key={i} style={{ background: C.card, border: `1px solid ${isOn ? s.color + "66" : C.border}`, borderRadius: 14, padding: 24, opacity: s.soon ? .55 : 1, position: "relative" }}>
                {isOn && <div style={{ position: "absolute", top: 14, right: 14 }}><Tag label="✓ Conectado" color={C.green} /></div>}
                {s.soon && <div style={{ position: "absolute", top: 14, right: 14 }}><Tag label="Em breve" color={C.muted} /></div>}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: s.color + "22", border: `1px solid ${s.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>OAuth 2.0</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.muted2, lineHeight: 1.65, marginBottom: 12 }}>{s.desc}</div>
                {s.perks.map((p, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ color: s.color, fontSize: 11, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{p}</span>
                  </div>
                ))}
                <button
                  onClick={() => !s.soon && !isOn && setModal(s.id)}
                  disabled={!!s.soon || isOn}
                  style={{ width: "100%", marginTop: 16, background: isOn ? `${C.green}22` : s.soon ? C.card2 : s.color, border: isOn ? `1px solid ${C.green}44` : "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, color: isOn ? C.green : s.soon ? C.muted : "#fff", cursor: s.soon || isOn ? "default" : "pointer" }}>
                  {isOn ? "✓ Conectado" : s.soon ? "Em breve" : `Conectar ${s.name} →`}
                </button>
              </div>
            )
          })}
        </div>

        {/* Como funciona */}
        <div style={{ background: C.card2, borderRadius: 14, padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Como funciona</div>
          <div style={{ display: "flex", gap: 0, position: "relative" }}>
            {[
              { n: "1", t: "Autorize", d: "Clique em conectar e aprove via OAuth — sem senha" },
              { n: "2", t: "Sincroniza", d: "Dados entram automaticamente a cada atividade ou atualização" },
              { n: "3", t: "Dashboard vivo", d: "Treino e dieta sempre atualizados, sem digitar nada" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", padding: "0 14px", position: "relative" }}>
                {i < 2 && <div style={{ position: "absolute", top: 20, right: 0, width: "50%", height: 2, background: C.border }} />}
                {i > 0 && <div style={{ position: "absolute", top: 20, left: 0, width: "50%", height: 2, background: C.border }} />}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.od, border: `1px solid ${C.orange}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: C.orange, margin: "0 auto 12px", position: "relative", zIndex: 1 }}>{s.n}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{s.t}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// Re-export Page type so callers don't need a separate import
export type { Page }
