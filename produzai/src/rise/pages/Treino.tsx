import { C, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'

interface Props {
  connected: string[]
  setPage: (page: Page) => void
}

export function Treino({ connected, setPage }: Props) {
  const stravaOn = connected.includes("strava")
  const strava = useStravaStore(s => s.data)
  const stravaLoading = useStravaStore(s => s.loading)

  const monthPct = strava ? Math.round(strava.monthKm / strava.monthGoal * 100) : 0

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🏋 Treino</div>
          <div style={{ fontSize: 13, color: C.muted }}>Performance física — força + cardio</div>
        </div>
        {stravaOn
          ? <Tag label="🔴 Strava conectado" color={C.strava} />
          : <button onClick={() => setPage("integracoes")} style={{ background: C.strava, border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Conectar Strava</button>}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Km semana", v: stravaLoading ? "..." : stravaOn && strava ? `${strava.weekKm}km` : "—", sub: stravaOn && strava ? `${strava.weekRuns} atividades` : "Strava não conectado", c: C.strava },
          { l: "Kcal semana", v: stravaLoading ? "..." : stravaOn && strava ? strava.weekCal : "—", sub: stravaOn ? "via Strava" : "—", c: C.red },
          { l: "Elevação", v: stravaLoading ? "..." : stravaOn && strava ? `${strava.weekElev}m` : "—", sub: stravaOn ? "ganho semanal" : "—", c: C.orange },
          { l: "PR 10km", v: stravaLoading ? "..." : stravaOn && strava ? strava.pr10k : "—", sub: stravaOn ? "recorde pessoal" : "—", c: C.blue },
        ].map((k, i) => (
          <Card key={i}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c, marginBottom: 4 }}>{k.v}</div>
            <div style={{ fontSize: 11, color: C.muted2 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Atividades recentes */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Atividades recentes</div>
            {stravaOn && <Tag label="Strava" color={C.strava} />}
          </div>
          {stravaLoading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13 }}>Carregando atividades...</div>
          ) : stravaOn && strava?.activities.length ? strava.activities.map((a, i) => (
            <div key={i} style={{ padding: "14px", background: C.card2, borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${a.type === "Corrida" ? C.strava : C.orange}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{a.date}</div>
                </div>
                <Tag label={a.type} color={a.type === "Corrida" ? C.strava : C.orange} />
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[
                  { l: "dist", v: `${a.dist}km`, c: C.strava },
                  { l: "pace", v: a.pace, c: C.text },
                  { l: "tempo", v: a.time, c: C.text },
                  { l: "kcal", v: String(a.cal), c: C.red },
                  { l: "bpm", v: a.hr > 0 ? String(a.hr) : "—", c: C.pink },
                ].map((s, j) => (
                  <div key={j} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏃</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum dado de corrida</div>
              <div style={{ fontSize: 13 }}>Conecte o Strava para importar suas atividades automaticamente</div>
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {stravaOn && strava && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Volume mensal</div>
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.strava }}>{strava.monthKm}<span style={{ fontSize: 16, color: C.muted }}> km</span></div>
                <div style={{ fontSize: 12, color: C.muted }}>meta: {strava.monthGoal}km</div>
              </div>
              <Bar pct={monthPct} color={C.strava} h={8} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: "right" }}>{monthPct}% da meta</div>
            </Card>
          )}
          {stravaOn && strava && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Zonas de FC</div>
              {strava.zones.map((z, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <span style={{ width: 60, fontSize: 11, color: C.muted2 }}>{z.z}</span>
                  <Bar pct={z.pct} color={z.c} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: z.c, width: 28, textAlign: "right" }}>{z.pct}%</span>
                </div>
              ))}
            </Card>
          )}
          {stravaOn && strava && (
            <div style={{ background: `${C.strava}11`, border: `1px solid ${C.strava}33`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Dot color={C.green} /><span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Sincronização ativa</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Última sync: {strava.lastSync}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Próxima: ao finalizar atividade</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
