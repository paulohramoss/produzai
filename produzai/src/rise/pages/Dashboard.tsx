import { C, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'
import { useWebDietStore } from '../../store/useWebDietStore'

interface Props {
  connected: string[]
  setPage: (page: Page) => void
}

export function Dashboard({ connected, setPage }: Props) {
  const stravaOn = connected.includes("strava")
  const webdietOn = connected.includes("webdiet")
  const strava = useStravaStore(s => s.data)
  const stravaLoading = useStravaStore(s => s.loading)
  const wd = useWebDietStore(s => s.data)

  const doneMeals = wd?.meals.filter(m => m.done) ?? []
  const calConsumed = webdietOn && wd ? doneMeals.reduce((s, m) => s + m.cal, 0) : 0
  const calBurned = stravaOn && strava ? Math.round(strava.weekCal / 7) : 0
  const calBalance = calConsumed - calBurned
  const lastActivity = strava?.activities[0]

  const today = new Date()
  const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted, textTransform: "capitalize" }}>{dateStr}</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Dashboard</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {stravaOn && <Tag label="🏃 Strava ativo" color={C.strava} />}
            {webdietOn && <Tag label="🥗 WebDiet ativo" color={C.webdiet} />}
            {(!stravaOn || !webdietOn) && (
              <span onClick={() => setPage("integracoes")} style={{ fontSize: 11, color: C.orange, cursor: "pointer", textDecoration: "underline" }}>
                + Conectar integrações
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { icon: "🔥", l: "Sequência", v: "14 dias", c: C.orange },
            { icon: "⚡", l: "XP Total", v: "4.820", c: C.blue },
            { icon: "⭐", l: "Ranking", v: "#7", c: C.pink },
          ].map((s, i) => (
            <Card key={i} style={{ textAlign: "center", minWidth: 84, padding: "10px 12px" }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.c, marginTop: 2 }}>{s.v}</div>
            </Card>
          ))}
        </div>
      </div>

      {stravaOn && webdietOn && strava && lastActivity && (
        <div style={{ background: "linear-gradient(135deg,#7C3A1018,#00A65108)", border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Dot color={C.green} /><span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Dados ao vivo</span>
          </div>
          <div style={{ display: "flex", gap: 20, flex: 1, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: C.muted }}><span style={{ color: C.strava, fontWeight: 700 }}>Strava:</span> {lastActivity.dist}km · {lastActivity.cal} kcal queimadas</div>
            <div style={{ fontSize: 12, color: C.muted }}><span style={{ color: C.webdiet, fontWeight: 700 }}>WebDiet:</span> {calConsumed} kcal consumidas · 2 refeições feitas</div>
            <div style={{ fontSize: 12, color: calBalance < 0 ? C.green : C.orange }}><span style={{ fontWeight: 700 }}>Balanço:</span> {calBalance > 0 ? "+" : ""}{calBalance} kcal</div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Card onClick={() => stravaOn && setPage("treino")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Corrida — semana</div>
            {stravaOn ? <Tag label="Strava" color={C.strava} small /> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: stravaOn ? C.strava : C.muted, margin: "8px 0 4px" }}>
            {stravaLoading ? "..." : stravaOn && strava ? `${strava.weekKm} km` : "—"}
          </div>
          <div style={{ fontSize: 12, color: C.muted2 }}>
            {stravaOn && strava ? `${strava.weekRuns} corridas · ${strava.weekCal} kcal` : "Conecte o Strava"}
          </div>
        </Card>
        <Card onClick={() => webdietOn && setPage("dieta")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Nutrição — hoje</div>
            {webdietOn ? <Tag label="WebDiet" color={C.webdiet} small /> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: webdietOn ? C.webdiet : C.muted, margin: "8px 0 4px" }}>{webdietOn ? `${calConsumed} kcal` : "—"}</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>{webdietOn && wd ? `de ${wd.goals.cal} kcal · ${doneMeals.length} refeições feitas` : "Configure sua dieta"}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Nível</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.blue, margin: "8px 0 4px" }}>12 ⚡</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>96% para o próximo</div>
        </Card>
        <Card>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Hábitos hoje</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.orange, margin: "8px 0 4px" }}>3/5</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>60% concluídos</div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Strava widget */}
        <Card onClick={() => setPage("treino")} style={{ borderTop: stravaOn ? `2px solid ${C.strava}` : `2px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🏃 Treino & Corrida</div>
            {stravaOn
              ? <Tag label="🔴 Strava ao vivo" color={C.strava} />
              : <span onClick={e => { e.stopPropagation(); setPage("integracoes") }} style={{ fontSize: 11, color: C.orange, cursor: "pointer" }}>+ Conectar Strava</span>}
          </div>
          {stravaLoading ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.muted, fontSize: 13 }}>Carregando dados do Strava...</div>
          ) : stravaOn && strava && lastActivity ? (
            <>
              <div style={{ padding: "12px 14px", background: C.card2, borderRadius: 10, borderLeft: `3px solid ${C.strava}`, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Última atividade — {lastActivity.date}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{lastActivity.name}</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: C.strava }}>{lastActivity.dist}km</div><div style={{ fontSize: 10, color: C.muted }}>distância</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800 }}>{lastActivity.pace}</div><div style={{ fontSize: 10, color: C.muted }}>pace</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: C.red }}>{lastActivity.cal}</div><div style={{ fontSize: 10, color: C.muted }}>kcal</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: C.pink }}>{lastActivity.hr}bpm</div><div style={{ fontSize: 10, color: C.muted }}>FC méd</div></div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: C.strava }}>{strava.weekKm}km</div><div style={{ fontSize: 10, color: C.muted }}>semana</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800 }}>{strava.weekRuns}</div><div style={{ fontSize: 10, color: C.muted }}>corridas</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>{strava.monthKm}km</div><div style={{ fontSize: 10, color: C.muted }}>no mês</div></div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🏃</div>
              <div style={{ fontSize: 13 }}>Conecte o Strava para ver suas atividades automaticamente</div>
            </div>
          )}
        </Card>

        {/* WebDiet widget */}
        <Card onClick={() => setPage("dieta")} style={{ borderTop: webdietOn ? `2px solid ${C.webdiet}` : `2px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🥗 Dieta & Nutrição</div>
            {webdietOn
              ? <Tag label="🟢 Manual" color={C.webdiet} />
              : <span onClick={e => { e.stopPropagation(); setPage("integracoes") }} style={{ fontSize: 11, color: C.orange, cursor: "pointer" }}>+ Configurar dieta</span>}
          </div>
          {webdietOn && wd ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { l: "Calorias", cur: calConsumed, goal: wd.goals.cal, unit: "kcal", c: C.orange },
                  { l: "Proteína", cur: doneMeals.reduce((s, m) => s + m.prot, 0), goal: wd.goals.prot, unit: "g", c: C.blue },
                ].map((m, i) => (
                  <div key={i} style={{ background: C.card2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{m.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.c }}>{m.cur}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>/{m.goal}{m.unit}</span></div>
                    <div style={{ marginTop: 6 }}><Bar pct={m.goal > 0 ? Math.min(Math.round(m.cur / m.goal * 100), 100) : 0} color={m.c} h={3} /></div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...wd.meals].sort((a, b) => a.time.localeCompare(b.time)).slice(0, 3).map((meal, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: C.card2, borderRadius: 8, borderLeft: `2px solid ${meal.done ? C.webdiet : C.border}` }}>
                    <span style={{ fontSize: 10, color: C.muted, minWidth: 40 }}>{meal.time}</span>
                    <span style={{ fontSize: 12, flex: 1, color: meal.done ? C.muted : C.text, textDecoration: meal.done ? "line-through" : "none" }}>{meal.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>{meal.cal}kcal</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🥗</div>
              <div style={{ fontSize: 13 }}>Configure sua dieta para acompanhar macros e refeições</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
