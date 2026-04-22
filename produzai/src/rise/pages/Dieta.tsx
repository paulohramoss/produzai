import { C, STRAVA, WEBDIET, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'

interface Props {
  connected: string[]
  setPage: (page: Page) => void
}

export function Dieta({ connected, setPage }: Props) {
  const webdietOn = connected.includes("webdiet")
  const stravaOn = connected.includes("strava")
  const calBurned = stravaOn ? Math.round(STRAVA.weekCal / 7) : null
  const calBalance = webdietOn && stravaOn && calBurned !== null ? WEBDIET.macros.cal.cur - calBurned : null

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🥗 Dieta & Nutrição</div>
          <div style={{ fontSize: 13, color: C.muted }}>Plano alimentar personalizado</div>
        </div>
        {webdietOn
          ? <Tag label={`Nutricionista: ${WEBDIET.nutritionist}`} color={C.webdiet} />
          : <button onClick={() => setPage("integracoes")} style={{ background: C.webdiet, border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Conectar WebDiet</button>}
      </div>

      {webdietOn && stravaOn && calBalance !== null && calBurned !== null && (
        <div style={{ background: calBalance < 0 ? `${C.green}11` : `${C.orange}11`, border: `1px solid ${calBalance < 0 ? C.green : C.orange}33`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: C.webdiet }}>{WEBDIET.macros.cal.cur} kcal</div><div style={{ fontSize: 11, color: C.muted }}>consumidas</div></div>
          <div style={{ fontSize: 20, color: C.muted }}>−</div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: C.strava }}>{calBurned} kcal</div><div style={{ fontSize: 11, color: C.muted }}>queimadas (Strava)</div></div>
          <div style={{ fontSize: 20, color: C.muted }}>=</div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: calBalance < 0 ? C.green : C.orange }}>{calBalance > 0 ? "+" : ""}{calBalance} kcal</div><div style={{ fontSize: 11, color: C.muted }}>balanço do dia</div></div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: calBalance < 0 ? C.green : C.orange, fontWeight: 600 }}>{calBalance < 0 ? "✓ Déficit calórico" : "▲ Superávit"}</div>
        </div>
      )}

      {/* Macros */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Calorias", cur: WEBDIET.macros.cal.cur, goal: WEBDIET.macros.cal.goal, unit: "kcal", c: C.orange },
          { l: "Proteína", cur: WEBDIET.macros.prot.cur, goal: WEBDIET.macros.prot.goal, unit: "g", c: C.blue },
          { l: "Carboidrato", cur: WEBDIET.macros.carb.cur, goal: WEBDIET.macros.carb.goal, unit: "g", c: C.green },
          { l: "Gordura", cur: WEBDIET.macros.fat.cur, goal: WEBDIET.macros.fat.goal, unit: "g", c: C.purple },
        ].map((m, i) => (
          <Card key={i} style={{ opacity: webdietOn ? 1 : .5 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>{m.l}</div>
              {webdietOn && <Tag label="WebDiet" color={C.webdiet} small />}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "8px 0 6px" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: webdietOn ? m.c : C.muted }}>{webdietOn ? m.cur : "—"}</span>
              {webdietOn && <span style={{ fontSize: 12, color: C.muted }}>/ {m.goal} {m.unit}</span>}
            </div>
            <Bar pct={webdietOn ? Math.round(m.cur / m.goal * 100) : 0} color={m.c} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{webdietOn ? `${Math.round(m.cur / m.goal * 100)}% da meta` : "Conecte WebDiet"}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        {/* Plano alimentar */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Plano alimentar do dia</div>
            {webdietOn && <Tag label="via WebDiet" color={C.webdiet} />}
          </div>
          {webdietOn ? WEBDIET.plan.map((m, i) => (
            <div key={i} style={{ padding: "14px", background: C.card2, borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${m.done ? C.webdiet : C.border}`, opacity: m.done ? .75 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{m.time}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</span>
                  {m.done && <Tag label="✓" color={C.green} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.orange }}>{m.cal} kcal</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: C.blue }}>🥩 {m.prot}g</span>
                <span style={{ fontSize: 11, color: C.green }}>🌾 {m.carb}g</span>
                <span style={{ fontSize: 11, color: C.purple }}>🫒 {m.fat}g</span>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {m.items.map((item, j) => (
                  <span key={j} style={{ fontSize: 10, color: C.muted2, background: C.card, borderRadius: 4, padding: "2px 6px", border: `1px solid ${C.border}` }}>{item}</span>
                ))}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum plano alimentar</div>
              <div style={{ fontSize: 13 }}>Conecte o WebDiet para importar o plano do seu nutricionista</div>
              <button onClick={() => setPage("integracoes")} style={{ marginTop: 14, background: C.webdiet, border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Conectar WebDiet</button>
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ opacity: webdietOn ? 1 : .5 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Hidratação</div>
            <div style={{ textAlign: "center", margin: "8px 0" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.blue }}>2,4L</div>
              <div style={{ fontSize: 12, color: C.muted }}>de 3,5L · 69%</div>
            </div>
            <Bar pct={69} color={C.blue} h={8} />
          </Card>
          {webdietOn && (
            <Card style={{ background: `${C.webdiet}11`, border: `1px solid ${C.webdiet}33` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Dot color={C.green} /><span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Plano sincronizado</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Última sync: {WEBDIET.lastSync}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Nutricionista: {WEBDIET.nutritionist}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Atualização: quando nutricionista editar</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
