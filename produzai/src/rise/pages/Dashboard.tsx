import { C, STRAVA, WEBDIET, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'

interface Props {
  connected: string[]
  setPage: (page: Page) => void
}

export function Dashboard({ connected, setPage }: Props) {
  const stravaOn = connected.includes("strava")
  const webdietOn = connected.includes("webdiet")

  const calConsumed = webdietOn ? 800 : 0
  const calBurned = stravaOn ? STRAVA.weekCal : 0
  const calBalance = calConsumed - Math.round(calBurned / 7)

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted }}>Sexta-feira, 17 de abril</div>
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

      {stravaOn && webdietOn && (
        <div style={{ background: "linear-gradient(135deg,#7C3A1018,#00A65108)", border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Dot color={C.green} /><span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Dados ao vivo</span>
          </div>
          <div style={{ display: "flex", gap: 20, flex: 1, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: C.muted }}><span style={{ color: C.strava, fontWeight: 700 }}>Strava:</span> {STRAVA.activities[0].dist}km hoje · {STRAVA.activities[0].cal} kcal queimadas</div>
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
          <div style={{ fontSize: 26, fontWeight: 800, color: stravaOn ? C.strava : C.muted, margin: "8px 0 4px" }}>{stravaOn ? `${STRAVA.weekKm} km` : "—"}</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>{stravaOn ? `${STRAVA.weekRuns} corridas · ${STRAVA.weekCal} kcal` : "Conecte o Strava"}</div>
        </Card>
        <Card onClick={() => webdietOn && setPage("dieta")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Nutrição — hoje</div>
            {webdietOn ? <Tag label="WebDiet" color={C.webdiet} small /> : <span style={{ fontSize: 10, color: C.muted }}>—</span>}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: webdietOn ? C.webdiet : C.muted, margin: "8px 0 4px" }}>{webdietOn ? `${calConsumed} kcal` : "—"}</div>
          <div style={{ fontSize: 12, color: C.muted2 }}>{webdietOn ? `de ${WEBDIET.macros.cal.goal} · 2 refeições feitas` : "Conecte o WebDiet"}</div>
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
          {stravaOn ? (
            <>
              <div style={{ padding: "12px 14px", background: C.card2, borderRadius: 10, borderLeft: `3px solid ${C.strava}`, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Última atividade — {STRAVA.activities[0].date}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{STRAVA.activities[0].name}</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: C.strava }}>{STRAVA.activities[0].dist}km</div><div style={{ fontSize: 10, color: C.muted }}>distância</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800 }}>{STRAVA.activities[0].pace}</div><div style={{ fontSize: 10, color: C.muted }}>pace</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: C.red }}>{STRAVA.activities[0].cal}</div><div style={{ fontSize: 10, color: C.muted }}>kcal</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: C.pink }}>{STRAVA.activities[0].hr}bpm</div><div style={{ fontSize: 10, color: C.muted }}>FC méd</div></div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: C.strava }}>{STRAVA.weekKm}km</div><div style={{ fontSize: 10, color: C.muted }}>semana</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800 }}>{STRAVA.weekRuns}</div><div style={{ fontSize: 10, color: C.muted }}>corridas</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>{STRAVA.monthKm}km</div><div style={{ fontSize: 10, color: C.muted }}>no mês</div></div>
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
              ? <Tag label="🟢 WebDiet ao vivo" color={C.webdiet} />
              : <span onClick={e => { e.stopPropagation(); setPage("integracoes") }} style={{ fontSize: 11, color: C.orange, cursor: "pointer" }}>+ Conectar WebDiet</span>}
          </div>
          {webdietOn ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { l: "Calorias", cur: WEBDIET.macros.cal.cur, goal: WEBDIET.macros.cal.goal, unit: "kcal", c: C.orange },
                  { l: "Proteína", cur: WEBDIET.macros.prot.cur, goal: WEBDIET.macros.prot.goal, unit: "g", c: C.blue },
                ].map((m, i) => (
                  <div key={i} style={{ background: C.card2, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{m.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.c }}>{m.cur}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>/{m.goal}{m.unit}</span></div>
                    <div style={{ marginTop: 6 }}><Bar pct={Math.round(m.cur / m.goal * 100)} color={m.c} h={3} /></div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {WEBDIET.plan.slice(0, 3).map((meal, i) => (
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
              <div style={{ fontSize: 13 }}>Conecte o WebDiet para ver seu plano alimentar automaticamente</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
