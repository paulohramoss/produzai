import { useState } from 'react'
import { C, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import { DietaModal } from '../DietaModal'

interface Props {
  connected: string[]
  setPage: (page: Page) => void
}

export function Dieta({ connected, setPage }: Props) {
  const [editOpen, setEditOpen] = useState(false)

  const webdietOn = connected.includes("webdiet")
  const stravaOn = connected.includes("strava")

  const strava = useStravaStore(s => s.data)
  const wd = useWebDietStore(s => s.data)
  const toggleMeal = useWebDietStore(s => s.toggleMeal)

  const doneMeals = wd?.meals.filter(m => m.done) ?? []
  const cur = {
    cal:  doneMeals.reduce((s, m) => s + m.cal,  0),
    prot: doneMeals.reduce((s, m) => s + m.prot, 0),
    carb: doneMeals.reduce((s, m) => s + m.carb, 0),
    fat:  doneMeals.reduce((s, m) => s + m.fat,  0),
  }
  const goals = wd?.goals ?? { cal: 0, prot: 0, carb: 0, fat: 0 }

  const calBurned = stravaOn && strava ? Math.round(strava.weekCal / 7) : null
  const calBalance = webdietOn && wd && calBurned !== null ? cur.cal - calBurned : null

  const sortedMeals = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <>
      {editOpen && wd && <DietaModal onClose={() => setEditOpen(false)} />}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🥗 Dieta & Nutrição</div>
            <div style={{ fontSize: 13, color: C.muted }}>Plano alimentar personalizado</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {webdietOn && wd && (
              <button
                onClick={() => setEditOpen(true)}
                style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px 14px", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ✏️ Editar plano
              </button>
            )}
            {webdietOn
              ? <Tag label="Manual · Dados locais" color={C.webdiet} />
              : <button onClick={() => setPage("integracoes")} style={{ background: C.webdiet, border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Configurar dieta</button>}
          </div>
        </div>

        {/* Caloric balance bar (when both Strava + WebDiet active) */}
        {webdietOn && wd && stravaOn && calBalance !== null && calBurned !== null && (
          <div style={{ background: calBalance < 0 ? `${C.green}11` : `${C.orange}11`, border: `1px solid ${calBalance < 0 ? C.green : C.orange}33`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: C.webdiet }}>{cur.cal} kcal</div><div style={{ fontSize: 11, color: C.muted }}>consumidas</div></div>
            <div style={{ fontSize: 20, color: C.muted }}>−</div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: C.strava }}>{calBurned} kcal</div><div style={{ fontSize: 11, color: C.muted }}>queimadas (Strava)</div></div>
            <div style={{ fontSize: 20, color: C.muted }}>=</div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: calBalance < 0 ? C.green : C.orange }}>{calBalance > 0 ? "+" : ""}{calBalance} kcal</div><div style={{ fontSize: 11, color: C.muted }}>balanço</div></div>
            <div style={{ marginLeft: "auto", fontSize: 12, color: calBalance < 0 ? C.green : C.orange, fontWeight: 600 }}>{calBalance < 0 ? "✓ Déficit calórico" : "▲ Superávit"}</div>
          </div>
        )}

        {/* Macros KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { l: "Calorias",    cur: cur.cal,  goal: goals.cal,  unit: "kcal", c: C.orange },
            { l: "Proteína",    cur: cur.prot, goal: goals.prot, unit: "g",    c: C.blue },
            { l: "Carboidrato", cur: cur.carb, goal: goals.carb, unit: "g",    c: C.green },
            { l: "Gordura",     cur: cur.fat,  goal: goals.fat,  unit: "g",    c: C.purple },
          ].map((m, i) => (
            <Card key={i} style={{ opacity: webdietOn ? 1 : .5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>{m.l}</div>
                {webdietOn && <Tag label="Manual" color={C.webdiet} small />}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "8px 0 6px" }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: webdietOn ? m.c : C.muted }}>
                  {webdietOn ? m.cur : "—"}
                </span>
                {webdietOn && m.goal > 0 && (
                  <span style={{ fontSize: 12, color: C.muted }}>/ {m.goal} {m.unit}</span>
                )}
              </div>
              <Bar pct={webdietOn && m.goal > 0 ? Math.min(Math.round(m.cur / m.goal * 100), 100) : 0} color={m.c} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>
                {webdietOn && m.goal > 0 ? `${Math.round(m.cur / m.goal * 100)}% da meta` : "Configure a dieta"}
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          {/* Meal plan */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Plano alimentar do dia</div>
              {webdietOn && wd && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{doneMeals.length}/{wd.meals.length} feitas</span>
                  <Tag label="Manual" color={C.webdiet} />
                </div>
              )}
            </div>

            {webdietOn && wd ? (
              sortedMeals.length > 0 ? sortedMeals.map(m => (
                <div
                  key={m.id}
                  onClick={() => toggleMeal(m.id)}
                  style={{ padding: "14px", background: C.card2, borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${m.done ? C.webdiet : C.border}`, opacity: m.done ? .7 : 1, cursor: "pointer", transition: "opacity .15s, border-color .15s" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{m.time}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, textDecoration: m.done ? "line-through" : "none", color: m.done ? C.muted : C.text }}>{m.name}</span>
                      {m.done && <Tag label="✓ feito" color={C.green} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.orange }}>{m.cal} kcal</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: m.items.length > 0 ? 8 : 0 }}>
                    <span style={{ fontSize: 11, color: C.blue }}>🥩 {m.prot}g</span>
                    <span style={{ fontSize: 11, color: C.green }}>🌾 {m.carb}g</span>
                    <span style={{ fontSize: 11, color: C.purple }}>🫒 {m.fat}g</span>
                  </div>
                  {m.items.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {m.items.map((item, j) => (
                        <span key={j} style={{ fontSize: 10, color: C.muted2, background: C.card, borderRadius: 4, padding: "2px 6px", border: `1px solid ${C.border}` }}>{item}</span>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma refeição ainda</div>
                  <div style={{ fontSize: 13 }}>Clique em "Editar plano" para adicionar suas refeições</div>
                  <button
                    onClick={() => setEditOpen(true)}
                    style={{ marginTop: 12, background: C.webdiet, border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Adicionar refeições
                  </button>
                </div>
              )
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum plano configurado</div>
                <div style={{ fontSize: 13 }}>Configure sua dieta para acompanhar as refeições e macros</div>
                <button
                  onClick={() => setPage("integracoes")}
                  style={{ marginTop: 14, background: C.webdiet, border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Configurar Dieta
                </button>
              </div>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Hydration (static for now) */}
            <Card style={{ opacity: webdietOn ? 1 : .5 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Hidratação</div>
              <div style={{ textAlign: "center", margin: "8px 0" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.blue }}>2,4L</div>
                <div style={{ fontSize: 12, color: C.muted }}>de 3,5L · 69%</div>
              </div>
              <Bar pct={69} color={C.blue} h={8} />
            </Card>

            {/* Status card */}
            {webdietOn && wd && (
              <Card style={{ background: `${C.webdiet}11`, border: `1px solid ${C.webdiet}33` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Dot color={C.green} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Plano configurado</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{wd.meals.length} refeições · {doneMeals.length} concluídas</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Meta: {goals.cal} kcal · {goals.prot}g prot</div>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{ marginTop: 12, width: "100%", background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer" }}>
                  ✏️ Editar plano
                </button>
              </Card>
            )}

            {/* Progress summary */}
            {webdietOn && wd && goals.cal > 0 && (
              <Card>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Progresso hoje</div>
                {[
                  { l: "Calorias", cur: cur.cal, goal: goals.cal, c: C.orange, u: "kcal" },
                  { l: "Proteína", cur: cur.prot, goal: goals.prot, c: C.blue, u: "g" },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 4 }}>
                      <span>{m.l}</span>
                      <span style={{ color: m.c }}>{m.cur}/{m.goal}{m.u}</span>
                    </div>
                    <Bar pct={m.goal > 0 ? Math.min(Math.round(m.cur / m.goal * 100), 100) : 0} color={m.c} h={5} />
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
