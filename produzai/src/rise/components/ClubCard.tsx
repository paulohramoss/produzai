import { useCallback, useEffect, useState } from 'react'
import { Users, Copy, LogOut, Target } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, Bar } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { buildInviteLink } from '../../lib/attribution'
import { getMonthKey } from '../../lib/xp'
import { toast } from '../../lib/toast'
import {
  createClub, getClub, getMyClubId, joinClub, leaveClub, updateClubGoal,
  getFriendLeaderboard, CLUB_MAX_MEMBERS,
  type Club, type LeaderboardEntry,
} from '../../lib/db'

/**
 * Clube — grupo fechado com meta coletiva.
 *
 * Não é feed: não tem post, curtida nem estranho. A lista de amigos existente é
 * assimétrica (cada um tem a sua), então ela nunca conseguiria mostrar UM número
 * somado igual para todo mundo — que é o ponto da meta coletiva. Por isso o
 * clube é um documento próprio com a lista de membros dentro.
 */

const DEFAULT_GOAL = 100

export function ClubCard() {
  const user = useAuthStore(s => s.user)
  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [nameInput, setNameInput] = useState('')
  const [goalInput, setGoalInput] = useState(DEFAULT_GOAL)
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const monthKey = getMonthKey()

  const loadMembers = useCallback(async (c: Club) => {
    const entries = await getFriendLeaderboard(c.memberUids)
    setMembers(entries.sort((a, b) => monthWorkouts(b, monthKey) - monthWorkouts(a, monthKey)))
  }, [monthKey])

  useEffect(() => {
    if (!user) return
    let alive = true
    getMyClubId()
      .then(id => (id ? getClub(id) : null))
      .then(c => {
        if (!alive) return
        setClub(c)
        setLoading(false)
        if (c) loadMembers(c)
      })
    return () => { alive = false }
  }, [user, loadMembers])

  async function handleCreate() {
    if (busy || nameInput.trim().length < 2) return
    setBusy(true); setError('')
    const c = await createClub(nameInput, goalInput)
    setBusy(false)
    if (!c) { setError('Não foi possível criar o clube'); return }
    setClub(c)
    setMode('idle')
    loadMembers(c)
    toast.success(`Clube ${c.name} criado 🎉`)
  }

  async function handleJoin() {
    if (busy || codeInput.trim().length < 4) return
    setBusy(true); setError('')
    const res = await joinClub(codeInput)
    setBusy(false)
    if (!res.ok) {
      setError({
        'not-found':  'Código não encontrado',
        'full':       `Clube lotado (máx. ${CLUB_MAX_MEMBERS})`,
        'already-in': 'Você já está nesse clube',
        'error':      'Não foi possível entrar',
      }[res.reason])
      return
    }
    setClub(res.club)
    setMode('idle')
    setCodeInput('')
    loadMembers(res.club)
    toast.success(`Você entrou no ${res.club.name}`)
  }

  async function handleLeave() {
    if (!club || busy) return
    setBusy(true)
    await leaveClub(club.id)
    setBusy(false)
    setClub(null)
    setMembers([])
  }

  async function handleGoalChange(next: number) {
    if (!club) return
    setClub({ ...club, monthlyGoal: next })
    await updateClubGoal(club.id, next)
  }

  function copyInvite() {
    if (!club || !user) return
    const link = `${buildInviteLink(user.uid.slice(0, 6).toUpperCase(), 'clube')}&club=${club.id}`
    navigator.clipboard.writeText(link)
      .then(() => toast.success('Link do clube copiado'))
      .catch(() => toast.error('Não foi possível copiar'))
  }

  if (loading) return null

  // ── Sem clube: criar ou entrar ───────────────────────────────────────────
  if (!club) {
    return (
      <Card style={{ borderTop: `2px solid ${C.blue}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 6, ...displayStyle,
        }}>
          <Users size={17} color={C.blue} /> Clube
        </div>
        <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          Um grupo fechado com uma meta que só fecha se todo mundo aparecer.
          Sem feed, sem estranho — só os seus.
        </div>

        {mode === 'idle' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setMode('create'); setError('') }} style={primaryBtn}>
              Criar um clube
            </button>
            <button onClick={() => { setMode('join'); setError('') }} style={ghostBtn}>
              Tenho um código
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Nome do clube (ex.: Box da Beira-Mar)"
              maxLength={40}
              autoFocus
              style={inputStyle}
            />
            <div>
              <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 6 }}>
                Meta do mês: <strong style={{ color: C.text }}>{goalInput} treinos</strong> somados
              </div>
              <input
                type="range" min={20} max={500} step={10}
                value={goalInput}
                onChange={e => setGoalInput(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.blue }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreate} disabled={busy || nameInput.trim().length < 2} style={primaryBtn}>
                {busy ? '...' : 'Criar'}
              </button>
              <button onClick={() => setMode('idle')} style={ghostBtn}>Cancelar</button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Código do clube"
              maxLength={6}
              autoFocus
              style={{ ...inputStyle, letterSpacing: 3, flex: 1 }}
            />
            <button onClick={handleJoin} disabled={busy || codeInput.length < 4} style={primaryBtn}>
              {busy ? '...' : 'Entrar'}
            </button>
            <button onClick={() => setMode('idle')} style={ghostBtn}>✕</button>
          </div>
        )}

        {error && <div style={{ fontSize: T.text.sm, color: C.red, marginTop: 8 }}>{error}</div>}
      </Card>
    )
  }

  // ── Com clube: meta coletiva ─────────────────────────────────────────────
  const total = members.reduce((s, m) => s + monthWorkouts(m, monthKey), 0)
  const pct = club.monthlyGoal > 0 ? Math.round((total / club.monthlyGoal) * 100) : 0
  const isOwner = club.ownerUid === user?.uid
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <Card style={{ borderTop: `2px solid ${C.blue}` }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: 16,
      }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle,
          }}>
            <Users size={17} color={C.blue} /> {club.name}
          </div>
          <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 4 }}>
            {members.length} {members.length === 1 ? 'membro' : 'membros'} · código{' '}
            <strong style={{ color: C.blue, letterSpacing: 1 }}>{club.id}</strong>
          </div>
        </div>
        <button onClick={copyInvite} title="Copiar link de convite" style={iconBtn}>
          <Copy size={14} />
        </button>
      </div>

      {/* Meta coletiva */}
      <div style={{
        background: C.card2, border: `1px solid ${C.border}`,
        borderRadius: T.radius.lg, padding: 16, marginBottom: 14,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase',
          letterSpacing: .8, marginBottom: 10,
        }}>
          <Target size={12} /> Meta de {monthLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{
            fontSize: T.text['7xl'], fontWeight: T.weight.extrabold,
            color: pct >= 100 ? C.green : C.blue, ...displayStyle,
          }}>
            {total}
          </span>
          <span style={{ fontSize: T.text['3xl'], color: C.muted }}>/ {club.monthlyGoal} treinos</span>
        </div>
        <Bar pct={pct} color={pct >= 100 ? C.green : C.blue} h={7} />
        <div style={{ fontSize: T.text.md, color: C.muted2, marginTop: 10 }}>
          {pct >= 100
            ? '🏆 Meta batida. O clube inteiro entregou.'
            : `Faltam ${club.monthlyGoal - total} treinos para o clube fechar o mês.`}
        </div>
        {isOwner && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 6 }}>
              Ajustar meta (só você, como dono)
            </div>
            <input
              type="range" min={20} max={500} step={10}
              value={club.monthlyGoal}
              onChange={e => handleGoalChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.blue }}
            />
          </div>
        )}
      </div>

      {/* Quem entregou o quê */}
      {members.map(m => {
        const isMe = m.uid === user?.uid
        const n = monthWorkouts(m, monthKey)
        return (
          <div key={m.uid} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
            background: isMe ? C.od : C.card2, borderRadius: 9, marginBottom: 5,
            border: `1px solid ${isMe ? C.orange + '44' : C.border}`,
          }}>
            <span style={{
              flex: 1, fontSize: T.text.md, fontWeight: isMe ? 700 : 500,
              color: isMe ? C.orange : C.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {m.displayName}{isMe ? ' (você)' : ''}
              {m.uid === club.ownerUid && (
                <span style={{ fontSize: T.text.xs, color: C.muted, marginLeft: 6 }}>dono</span>
              )}
            </span>
            <span style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.blue, flexShrink: 0 }}>
              {n} {n === 1 ? 'treino' : 'treinos'}
            </span>
          </div>
        )
      })}

      <button
        onClick={handleLeave}
        disabled={busy}
        style={{
          ...ghostBtn, marginTop: 10, color: C.muted,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <LogOut size={13} /> Sair do clube
      </button>
    </Card>
  )
}

/** Treinos do mês corrente — entrada de mês antigo não conta para a meta atual. */
function monthWorkouts(entry: LeaderboardEntry, monthKey: string): number {
  return entry.monthKey === monthKey ? (entry.monthlyWorkouts ?? 0) : 0
}

const inputStyle: React.CSSProperties = {
  background: C.card2,
  border: `1px solid ${C.border}`,
  borderRadius: T.radius.sm,
  color: C.text,
  fontSize: T.text.md,
  padding: '9px 12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  background: C.blue, border: 'none', borderRadius: T.radius.sm,
  padding: '9px 16px', color: '#0C0C0C',
  fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
  padding: '9px 16px', color: C.text,
  fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
  padding: '7px 9px', color: C.muted2, cursor: 'pointer', flexShrink: 0,
}
