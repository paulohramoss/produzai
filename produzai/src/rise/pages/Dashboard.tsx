import { useContext, useEffect, useState } from 'react'
import { T, C, displayStyle, type Page } from '../data'
import { Card } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useAuthStore } from '../../store/useAuthStore'
import {
  getLeaderboard, upsertLeaderboard, type LeaderboardEntry,
  getFriends, addFriend as addFriendDB,
  getFriendLeaderboard, lookupByInviteCode,
} from '../../lib/db'
import { computeXP, computeStreak, computeBadges, getWeekWorkouts, getWeekKey } from '../../lib/xp'
import { ShareCard } from '../components/ShareCard'
import { LayoutContext } from '../LayoutContext'
import { Share2, Dumbbell, Star, Salad, Award } from 'lucide-react'

interface Props {
  setPage: (page: Page) => void
}

export function Dashboard({ setPage }: Props) {
  const { isMobile } = useContext(LayoutContext)
  const workouts = useWorkoutStore(s => s.workouts)
  const wd = useWebDietStore(s => s.data)
  const user = useAuthStore(s => s.user)

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [lbTab, setLbTab] = useState<'global' | 'amigos'>('global')
  const [friendLb, setFriendLb] = useState<LeaderboardEntry[]>([])
  const [myFriends, setMyFriends] = useState<string[]>([])
  const [addCode, setAddCode] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [showShare, setShowShare] = useState(false)

  const today = new Date()
  const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const weekWorkoutsList = getWeekWorkouts(workouts)
  const weekCal = weekWorkoutsList.reduce((s, w) => s + w.cal, 0)

  const doneMeals = wd?.meals.filter(m => m.done) ?? []
  const calConsumed = wd ? doneMeals.reduce((s, m) => s + m.cal, 0) : 0

  const xp = computeXP(workouts)
  const weekXP = computeXP(weekWorkoutsList)
  const streak = computeStreak(workouts)
  const badges = computeBadges(workouts, streak)
  const inviteCode = user?.uid.slice(0, 6).toUpperCase() ?? ''

  const weekLabel = (() => {
    const month = today.toLocaleDateString('pt-BR', { month: 'long' })
    const weekNum = parseInt(getWeekKey().split('-W')[1])
    return `Semana ${weekNum} · ${month[0].toUpperCase()}${month.slice(1)} ${today.getFullYear()}`
  })()

  const userName = (user?.displayName || user?.email?.split('@')[0] || 'Atleta').split(' ')[0]

  useEffect(() => {
    if (!user) return
    upsertLeaderboard({
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
      xp,
      streakDays: streak,
      weeklyWorkouts: weekWorkoutsList.length,
      weeklyXP: weekXP,
      weekKey: getWeekKey(),
      inviteCode,
      updatedAt: Date.now(),
    })
    getLeaderboard().then(setLeaderboard)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workouts.length])

  useEffect(() => {
    if (lbTab !== 'amigos' || !user) return
    getFriends().then(async uids => {
      setMyFriends(uids)
      if (uids.length === 0) return
      const lb = await getFriendLeaderboard([...uids, user.uid])
      setFriendLb(lb.sort((a, b) => b.xp - a.xp))
    })
  }, [lbTab, user])

  const myRank = leaderboard.findIndex(e => e.uid === user?.uid) + 1

  async function handleAddFriend() {
    if (addCode.length < 6 || addLoading) return
    setAddLoading(true)
    setAddError('')
    try {
      const entry = await lookupByInviteCode(addCode.trim())
      if (!entry) { setAddError('Código não encontrado'); return }
      if (entry.uid === user?.uid) { setAddError('Esse é o seu próprio código'); return }
      if (myFriends.includes(entry.uid)) { setAddError('Já é seu amigo'); return }
      await addFriendDB(entry.uid)
      setMyFriends(prev => [...prev, entry.uid])
      setFriendLb(prev => [...prev.filter(e => e.uid !== entry.uid), entry].sort((a, b) => b.xp - a.xp))
      setAddCode('')
    } catch {
      setAddError('Erro ao adicionar amigo')
    } finally {
      setAddLoading(false)
    }
  }

  const earnedBadges = badges.filter(b => b.earnedAt)

  return (
    <div>
      {showShare && (
        <ShareCard
          userName={userName}
          weekWorkouts={weekWorkoutsList.length}
          weekXP={weekXP}
          weekCal={weekCal}
          streak={streak}
          rank={myRank}
          weekLabel={weekLabel}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: T.text.md, color: C.muted, textTransform: 'capitalize' }}>{dateStr}</div>
          <div style={{ fontSize: T.text['6xl'], fontWeight: T.weight.extrabold, ...displayStyle }}>Dashboard</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {([
            { icon: '⚡', l: 'XP Total', v: xp > 0 ? xp.toLocaleString('pt-BR') : '0', c: C.blue },
            { icon: '🔥', l: 'Streak', v: streak > 0 ? `${streak}d` : '—', c: C.orange },
            { icon: '⭐', l: 'Ranking', v: myRank > 0 ? `#${myRank}` : '—', c: C.pink },
          ] as const).map((s, i) => (
            <Card key={i} style={{ textAlign: 'center', minWidth: 80, padding: '10px 12px' }}>
              <div style={{ fontSize: T.text['3xl'] }}>{s.icon}</div>
              <div style={{ fontSize: T.text.xs, color: C.muted, marginTop: 2 }}>{s.l}</div>
              <div style={{ fontSize: T.text.xl, fontWeight: T.weight.extrabold, color: s.c, marginTop: 2 }}>{s.v}</div>
            </Card>
          ))}
          <button
            onClick={() => setShowShare(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px',
              background: C.orange, border: 'none', borderRadius: T.radius.md,
              color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer',
            }}
          >
            <Share2 size={14} /> Compartilhar
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <Card onClick={() => setPage('treino')}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: .8 }}>Treinos — semana</div>
          <div style={{ fontSize: T.text['6xl'], fontWeight: T.weight.extrabold, color: C.running, margin: '8px 0 4px', ...displayStyle }}>
            {weekWorkoutsList.length > 0 ? weekWorkoutsList.length : '—'}
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted2 }}>
            {weekWorkoutsList.length > 0
              ? (weekCal > 0 ? `${weekCal} kcal` : 'sem kcal')
              : 'Registre um treino'}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: .8 }}>Sequência</div>
          <div style={{ fontSize: T.text['6xl'], fontWeight: T.weight.extrabold, color: streak >= 7 ? C.orange : C.text, margin: '8px 0 4px', ...displayStyle }}>
            {streak > 0 ? `${streak}d` : '—'}
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted2 }}>
            {streak === 0 ? 'Comece hoje' : streak >= 30 ? '🏆 Incrível' : streak >= 7 ? '🔥 Em chamas' : 'dias seguidos'}
          </div>
        </Card>
        <Card onClick={() => setPage('dieta')}>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: .8 }}>Nutrição — hoje</div>
          <div style={{ fontSize: T.text['6xl'], fontWeight: T.weight.extrabold, color: C.green, margin: '8px 0 4px', ...displayStyle }}>
            {wd ? `${calConsumed} kcal` : '—'}
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted2 }}>
            {wd ? `de ${wd.goals.cal} kcal · ${doneMeals.length} refeições feitas` : 'Configure sua dieta'}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: .8 }}>Ranking global</div>
          <div style={{ fontSize: T.text['6xl'], fontWeight: T.weight.extrabold, color: C.orange, margin: '8px 0 4px', ...displayStyle }}>
            {myRank > 0 ? `#${myRank}` : '—'}
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted2 }}>
            {leaderboard.length > 0 ? `de ${leaderboard.length} atletas` : 'Aguardando dados'}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Treino widget */}
        <Card onClick={() => setPage('treino')} style={{ borderTop: `2px solid ${C.running}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}><Dumbbell size={17} color={C.running} /> Treino</div>
          {weekWorkoutsList.length > 0 ? (
            weekWorkoutsList.slice(0, 3).map((w, i) => (
              <div key={i} style={{ padding: '10px 12px', background: C.card2, borderRadius: T.radius.md, borderLeft: `3px solid ${C.running}`, marginBottom: 8 }}>
                <div style={{ fontWeight: T.weight.bold, fontSize: T.text.md, marginBottom: 4 }}>{w.name}</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: T.text.sm, color: C.muted }}>{w.date}</div>
                  {w.dist > 0 && <div style={{ fontSize: T.text.sm, fontWeight: T.weight.bold, color: C.running }}>{w.dist}km</div>}
                  {w.cal > 0 && <div style={{ fontSize: T.text.sm, fontWeight: T.weight.bold, color: C.red }}>{w.cal} kcal</div>}
                  <div style={{ fontSize: T.text.sm, color: C.muted }}>{w.time}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted }}>
              <div style={{ fontSize: T.text['7xl'], marginBottom: 10 }}>🏋</div>
              <div style={{ fontSize: T.text.md }}>Nenhum treino registrado esta semana</div>
              <button
                onClick={e => { e.stopPropagation(); setPage('treino') }}
                style={{ marginTop: 12, background: C.purple, border: 'none', borderRadius: T.radius.sm, padding: '8px 16px', color: '#fff', fontSize: T.text.base, fontWeight: T.weight.bold, cursor: 'pointer' }}
              >
                + Registrar treino
              </button>
            </div>
          )}
        </Card>

        {/* Leaderboard */}
        <Card style={{ borderTop: `2px solid ${C.pink}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}><Star size={17} color={C.pink} /> Ranking</div>
            <div style={{ display: 'flex', gap: 2, background: C.card2, borderRadius: T.radius.sm, padding: 3 }}>
              {(['global', 'amigos'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setLbTab(tab)}
                  style={{
                    padding: '4px 11px', border: 'none', borderRadius: T.radius.xs, cursor: 'pointer',
                    background: lbTab === tab ? C.card3 : 'transparent',
                    color: lbTab === tab ? C.text : C.muted,
                    fontSize: T.text.sm, fontWeight: lbTab === tab ? 700 : 500,
                    transition: 'all .12s',
                  }}
                >
                  {tab === 'global' ? 'Global' : 'Amigos'}
                </button>
              ))}
            </div>
          </div>

          {lbTab === 'global' ? (
            leaderboard.length > 0 ? (
              leaderboard.slice(0, 6).map((entry, i) => {
                const isMe = entry.uid === user?.uid
                const medals = ['🥇', '🥈', '🥉']
                return (
                  <div
                    key={entry.uid}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      background: isMe ? `${C.orange}18` : C.card2, borderRadius: 9, marginBottom: 6,
                      border: `1px solid ${isMe ? C.orange + '44' : C.border}`,
                    }}
                  >
                    <span style={{ fontSize: T.text.lg, minWidth: 24, textAlign: 'center' }}>
                      {medals[i] ?? `${i + 1}`}
                    </span>
                    <span style={{ flex: 1, fontSize: T.text.md, fontWeight: isMe ? 700 : 500, color: isMe ? C.orange : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.displayName}{isMe ? ' (você)' : ''}
                    </span>
                    <span style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.blue, flexShrink: 0 }}>
                      {entry.xp.toLocaleString('pt-BR')} XP
                    </span>
                  </div>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted }}>
                <div style={{ fontSize: T.text['7xl'], marginBottom: 10 }}>⭐</div>
                <div style={{ fontSize: T.text.md }}>Registre treinos para entrar no ranking!</div>
              </div>
            )
          ) : (
            /* Amigos tab */
            <>
              {/* User's invite code */}
              <div style={{ background: C.card2, borderRadius: T.radius.md, padding: '10px 14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: T.text.xs, color: C.muted, marginBottom: 4 }}>SEU CÓDIGO DE CONVITE</div>
                <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: C.orange, letterSpacing: 4, ...displayStyle }}>{inviteCode}</div>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 3 }}>Passe esse código para seus amigos te adicionarem</div>
              </div>

              {/* Friend entries */}
              {friendLb.length > 0 ? (
                friendLb.map((entry, i) => {
                  const isMe = entry.uid === user?.uid
                  return (
                    <div
                      key={entry.uid}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                        background: isMe ? `${C.orange}18` : C.card2, borderRadius: 9, marginBottom: 6,
                        border: `1px solid ${isMe ? C.orange + '44' : C.border}`,
                      }}
                    >
                      <span style={{ fontSize: T.text.md, minWidth: 20, color: C.muted, textAlign: 'center' }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: T.text.md, fontWeight: isMe ? 700 : 500, color: isMe ? C.orange : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.displayName}{isMe ? ' (você)' : ''}
                      </span>
                      <span style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.blue, flexShrink: 0 }}>
                        {entry.xp.toLocaleString('pt-BR')} XP
                      </span>
                    </div>
                  )
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 0 8px', color: C.muted, fontSize: T.text.md }}>
                  Adicione amigos para competir juntos
                </div>
              )}

              {/* Add friend */}
              <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={addCode}
                    onChange={e => { setAddCode(e.target.value.toUpperCase()); setAddError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                    maxLength={6}
                    placeholder="Código (6 chars)"
                    style={{
                      flex: 1, background: C.card2, borderRadius: T.radius.sm,
                      border: `1px solid ${addError ? C.red : C.border}`,
                      color: C.text, fontSize: T.text.md, padding: '8px 12px',
                      outline: 'none', fontFamily: 'system-ui', letterSpacing: 2,
                    }}
                  />
                  <button
                    onClick={handleAddFriend}
                    disabled={addLoading || addCode.length < 6}
                    style={{
                      padding: '8px 14px', border: 'none', borderRadius: T.radius.sm,
                      background: addCode.length === 6 ? C.orange : C.border,
                      color: '#fff', fontSize: T.text.base, fontWeight: T.weight.bold,
                      cursor: addCode.length === 6 ? 'pointer' : 'default',
                      transition: 'background .12s',
                    }}
                  >
                    {addLoading ? '...' : '+ Add'}
                  </button>
                </div>
                {addError && <div style={{ fontSize: T.text.sm, color: C.red, marginTop: 5 }}>{addError}</div>}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Dieta widget */}
      <Card onClick={() => setPage('dieta')} style={{ borderTop: wd ? `2px solid ${C.green}` : `2px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}><Salad size={17} color={C.green} /> Dieta & Nutrição</div>
        {wd ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...wd.meals].sort((a, b) => a.time.localeCompare(b.time)).slice(0, 4).map((meal, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: C.card2, borderRadius: T.radius.sm, borderLeft: `2px solid ${meal.done ? C.green : C.border}` }}>
                  <span style={{ fontSize: T.text.xs, color: C.muted, minWidth: 40 }}>{meal.time}</span>
                  <span style={{ fontSize: T.text.base, flex: 1, color: meal.done ? C.muted : C.text, textDecoration: meal.done ? 'line-through' : 'none' }}>{meal.name}</span>
                  <span style={{ fontSize: T.text.sm, fontWeight: T.weight.bold, color: C.orange }}>{meal.cal}kcal</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: T.text.sm, color: C.muted, textAlign: 'right' }}>
              {calConsumed} / {wd.goals.cal} kcal
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted }}>
            <div style={{ fontSize: T.text['7xl'], marginBottom: 10 }}>🥗</div>
            <div style={{ fontSize: T.text.md }}>Configure sua dieta para acompanhar macros e refeições</div>
          </div>
        )}
      </Card>

      {/* Conquistas */}
      <Card style={{ borderTop: `2px solid ${C.purple}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle }}><Award size={17} color={C.purple} /> Conquistas</div>
          <span style={{ fontSize: T.text.sm, color: C.purple, fontWeight: T.weight.bold }}>
            {earnedBadges.length}/{badges.length}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {badges.map(b => (
            <div
              key={b.id}
              title={b.desc}
              style={{
                textAlign: 'center', padding: '10px 4px',
                background: b.earnedAt ? C.od : C.card2,
                borderRadius: T.radius.md,
                border: `1px solid ${b.earnedAt ? C.orange + '44' : C.border}`,
                opacity: b.earnedAt ? 1 : 0.38,
                transition: 'opacity .15s',
                cursor: 'default',
              }}
            >
              <div style={{ fontSize: T.text['5xl'] }}>{b.icon}</div>
              <div style={{ fontSize: T.text.xs, color: b.earnedAt ? C.text : C.muted, fontWeight: T.weight.semibold, marginTop: 4, lineHeight: 1.3 }}>
                {b.name}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
