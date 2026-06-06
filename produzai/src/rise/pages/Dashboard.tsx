import { useContext, useEffect, useState } from 'react'
import { C, type Page } from '../data'
import { Card } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useAuthStore } from '../../store/useAuthStore'
import { getLeaderboard, upsertLeaderboard, type LeaderboardEntry } from '../../lib/db'
import { LayoutContext } from '../LayoutContext'

interface Props {
  setPage: (page: Page) => void
}

export function Dashboard({ setPage }: Props) {
  const { isMobile } = useContext(LayoutContext)
  const workouts = useWorkoutStore(s => s.workouts)
  const wd = useWebDietStore(s => s.data)
  const user = useAuthStore(s => s.user)

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  const today = new Date()
  const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    d.setHours(0, 0, 0, 0)
    return d
  })()
  const weekWorkouts = workouts.filter(w => {
    const [y, m, d] = w.rawDate.split('-').map(Number)
    return new Date(y, m - 1, d) >= weekStart
  })
  const weekCal = weekWorkouts.reduce((s, w) => s + w.cal, 0)

  const doneMeals = wd?.meals.filter(m => m.done) ?? []
  const calConsumed = wd ? doneMeals.reduce((s, m) => s + m.cal, 0) : 0

  const xp = workouts.length * 100

  useEffect(() => {
    if (!user) return
    // Update user's leaderboard entry
    upsertLeaderboard({
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
      xp,
      streakDays: 0,
      weeklyWorkouts: weekWorkouts.length,
      updatedAt: Date.now(),
    })
    // Load leaderboard
    getLeaderboard().then(setLeaderboard)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workouts.length])

  const myRank = leaderboard.findIndex(e => e.uid === user?.uid) + 1

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted, textTransform: "capitalize" }}>{dateStr}</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Dashboard</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { icon: "⚡", l: "XP Total", v: xp > 0 ? xp.toLocaleString('pt-BR') : "0", c: C.blue },
            { icon: "🏋", l: "Treinos", v: String(workouts.length), c: C.purple },
            { icon: "⭐", l: "Ranking", v: myRank > 0 ? `#${myRank}` : "—", c: C.pink },
          ].map((s, i) => (
            <Card key={i} style={{ textAlign: "center", minWidth: 84, padding: "10px 12px" }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.c, marginTop: 2 }}>{s.v}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Card onClick={() => setPage("treino")}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Treinos — semana</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.running, margin: "8px 0 4px" }}>
            {weekWorkouts.length > 0 ? weekWorkouts.length : "—"}
          </div>
          <div style={{ fontSize: 12, color: C.muted2 }}>
            {weekWorkouts.length > 0 ? `${weekCal > 0 ? weekCal + ' kcal' : 'sem kcal'}` : "Registre um treino"}
          </div>
        </Card>
        <Card onClick={() => setPage("dieta")}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Nutrição — hoje</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.green, margin: "8px 0 4px" }}>
            {wd ? `${calConsumed} kcal` : "—"}
          </div>
          <div style={{ fontSize: 12, color: C.muted2 }}>
            {wd ? `de ${wd.goals.cal} kcal · ${doneMeals.length} refeições feitas` : "Configure sua dieta"}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>XP Total</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.blue, margin: "8px 0 4px" }}>
            {xp > 0 ? xp.toLocaleString('pt-BR') : "0"}
          </div>
          <div style={{ fontSize: 12, color: C.muted2 }}>100 XP por treino</div>
        </Card>
        <Card>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>Ranking global</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.orange, margin: "8px 0 4px" }}>
            {myRank > 0 ? `#${myRank}` : "—"}
          </div>
          <div style={{ fontSize: 12, color: C.muted2 }}>
            {leaderboard.length > 0 ? `de ${leaderboard.length} atletas` : 'Aguardando dados'}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Treino widget */}
        <Card onClick={() => setPage("treino")} style={{ borderTop: `2px solid ${C.running}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🏋 Treino</div>
          </div>
          {weekWorkouts.length > 0 ? (
            <>
              {weekWorkouts.slice(0, 3).map((w, i) => (
                <div key={i} style={{ padding: "10px 12px", background: C.card2, borderRadius: 10, borderLeft: `3px solid ${C.running}`, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{w.name}</div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 11, color: C.muted }}>{w.date}</div>
                    {w.dist > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: C.running }}>{w.dist}km</div>}
                    {w.cal > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: C.red }}>{w.cal} kcal</div>}
                    <div style={{ fontSize: 11, color: C.muted }}>{w.time}</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🏋</div>
              <div style={{ fontSize: 13 }}>Nenhum treino registrado esta semana</div>
              <button
                onClick={e => { e.stopPropagation(); setPage("treino") }}
                style={{ marginTop: 12, background: C.purple, border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                + Registrar treino
              </button>
            </div>
          )}
        </Card>

        {/* Leaderboard */}
        <Card style={{ borderTop: `2px solid ${C.pink}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>⭐ Ranking Global</div>
            {myRank > 0 && <span style={{ fontSize: 11, color: C.pink, fontWeight: 700 }}>#{myRank}</span>}
          </div>
          {leaderboard.length > 0 ? (
            leaderboard.slice(0, 6).map((entry, i) => {
              const isMe = entry.uid === user?.uid
              const medals = ['🥇', '🥈', '🥉']
              return (
                <div
                  key={entry.uid}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                    background: isMe ? `${C.orange}18` : C.card2,
                    borderRadius: 9, marginBottom: 6,
                    border: `1px solid ${isMe ? C.orange + '44' : C.border}`,
                  }}
                >
                  <span style={{ fontSize: 14, minWidth: 24, textAlign: 'center' }}>
                    {medals[i] || `${i + 1}`}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? C.orange : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.displayName}{isMe ? ' (você)' : ''}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.blue, flexShrink: 0 }}>
                    {entry.xp.toLocaleString('pt-BR')} XP
                  </span>
                </div>
              )
            })
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
              <div style={{ fontSize: 13 }}>Registre treinos para entrar no ranking!</div>
            </div>
          )}
        </Card>
      </div>

      {/* Dieta widget */}
      <Card onClick={() => setPage("dieta")} style={{ borderTop: wd ? `2px solid ${C.green}` : `2px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🥗 Dieta & Nutrição</div>
        </div>
        {wd ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...wd.meals].sort((a, b) => a.time.localeCompare(b.time)).slice(0, 4).map((meal, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: C.card2, borderRadius: 8, borderLeft: `2px solid ${meal.done ? C.green : C.border}` }}>
                  <span style={{ fontSize: 10, color: C.muted, minWidth: 40 }}>{meal.time}</span>
                  <span style={{ fontSize: 12, flex: 1, color: meal.done ? C.muted : C.text, textDecoration: meal.done ? "line-through" : "none" }}>{meal.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>{meal.cal}kcal</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: C.muted, textAlign: "right" }}>
              {calConsumed} / {wd.goals.cal} kcal
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
  )
}
