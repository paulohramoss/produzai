import { useEffect, useState } from 'react'
import { Trophy, Gift, Flame, ShieldCheck, CloudOff } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useAuthStore } from '../../store/useAuthStore'
import {
  ACTIVE_CHALLENGE, challengeWindow, challengeProgress, challengeStatusLabel,
} from '../../lib/challenge'
import { syncChallenge, type ChallengeSyncResult } from '../../lib/challengeApi'
import { getChallengeLeaderboard, type ChallengeEntry } from '../../lib/db'

/**
 * O desafio da temporada: janela fechada, placar próprio e prêmio no fim.
 *
 * O número grande é o do SERVIDOR, não o desta máquina. O cálculo local só
 * aparece quando a sincronia falha, e sempre rotulado como não confirmado —
 * um card que mostra "21 dias" sem o servidor concordar é exatamente o que
 * transformaria o prêmio numa briga.
 */
export function ChallengeCard() {
  const workouts = useWorkoutStore(s => s.workouts)
  const user = useAuthStore(s => s.user)
  const [board, setBoard] = useState<ChallengeEntry[]>([])
  const [sync, setSync] = useState<ChallengeSyncResult | null>(null)
  const [syncFailed, setSyncFailed] = useState(false)

  const def = ACTIVE_CHALLENGE
  const window_ = challengeWindow(def)
  const local = challengeProgress(def, workouts)

  useEffect(() => {
    if (!user || window_.state === 'upcoming') return
    let alive = true
    syncChallenge().then(result => {
      if (!alive) return
      if (result.ok) {
        setSync(result.data)
        setSyncFailed(false)
      } else {
        setSyncFailed(true)
      }
      // O placar é lido direto do Firestore (leitura é liberada); só a escrita
      // passa pelo servidor. Lido DEPOIS da sincronia para já incluir você.
      getChallengeLeaderboard(def.id).then(b => { if (alive) setBoard(b) })
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, local.daysDone, window_.state])

  // Sem resposta do servidor a tela mostra a estimativa local, avisando que é.
  const daysDone = sync ? sync.entry.daysDone : local.daysDone
  const completed = daysDone >= def.goalDays
  const confirmed = new Set(sync?.entry.confirmedDays ?? [])
  const pendingCount = sync ? sync.pending.length : 0

  const myPos = board.findIndex(e => e.uid === user?.uid) + 1
  const statusColor = window_.state === 'running' && window_.daysLeft <= 3 ? C.red : C.orange

  return (
    <Card style={{ borderTop: `2px solid ${C.orange}` }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: 14,
      }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontWeight: T.weight.bold, fontSize: T.text.xl, ...displayStyle,
          }}>
            <Trophy size={17} color={C.orange} /> {def.name}
          </div>
          <div style={{ fontSize: T.text.md, color: C.muted, marginTop: 4 }}>{def.pitch}</div>
        </div>
        <span style={{
          fontSize: T.text.sm, fontWeight: T.weight.bold, color: statusColor,
          background: `${statusColor}1F`, border: `1px solid ${statusColor}44`,
          borderRadius: T.radius.pill, padding: '4px 11px', whiteSpace: 'nowrap',
        }}>
          {challengeStatusLabel(window_)}
        </span>
      </div>

      {window_.state === 'upcoming' ? (
        <div style={{
          textAlign: 'center', padding: '18px 0', color: C.muted2, fontSize: T.text.lg,
        }}>
          Começa em <strong style={{ color: C.text }}>
            {new Date(def.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </strong>. Registre um treino nesse dia e você já está dentro.
        </div>
      ) : (
        <>
          {/* Progresso pessoal */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: T.text['7xl'], fontWeight: T.weight.extrabold,
              color: completed ? C.green : C.orange, ...displayStyle,
            }}>
              {daysDone}
            </span>
            <span style={{ fontSize: T.text['3xl'], color: C.muted }}>/ {def.goalDays} dias</span>
            {completed && (
              <span style={{ fontSize: T.text.md, color: C.green, fontWeight: T.weight.bold, marginLeft: 'auto' }}>
                ✅ Fechou
              </span>
            )}
          </div>

          {/* Cada barrinha é um dia. Confirmado pelo servidor fica sólido. */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
            {Array.from({ length: def.goalDays }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 8, borderRadius: 2,
                background: i < daysDone ? C.orange : C.card3,
              }} />
            ))}
          </div>

          {/* Procedência do número — o card diz de onde ele veio */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 7,
            fontSize: T.text.sm, color: C.muted, marginBottom: 14, lineHeight: 1.5,
          }}>
            {syncFailed ? (
              <>
                <CloudOff size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Contagem deste aparelho, ainda <strong style={{ color: C.muted2 }}>não confirmada</strong>.
                  O placar oficial é conferido pelo servidor quando a conexão voltar.
                </span>
              </>
            ) : (
              <>
                <ShieldCheck size={13} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Confirmado pelo servidor.
                  {pendingCount > 0 && (
                    <> {pendingCount} {pendingCount === 1 ? 'dia registrado' : 'dias registrados'} fora
                    da data não {pendingCount === 1 ? 'entrou' : 'entraram'} no placar — só conta
                    o treino lançado no próprio dia.</>
                  )}
                </span>
              </>
            )}
          </div>

          {/* Placar do desafio */}
          {board.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {board.slice(0, 5).map((entry, i) => {
                const isMe = entry.uid === user?.uid
                const medals = ['🥇', '🥈', '🥉']
                return (
                  <div key={entry.uid} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                    background: isMe ? C.od : C.card2, borderRadius: 9, marginBottom: 5,
                    border: `1px solid ${isMe ? C.orange + '44' : C.border}`,
                  }}>
                    <span style={{ fontSize: T.text.lg, minWidth: 24, textAlign: 'center' }}>
                      {medals[i] ?? `${i + 1}`}
                    </span>
                    <span style={{
                      flex: 1, fontSize: T.text.md, fontWeight: isMe ? 700 : 500,
                      color: isMe ? C.orange : C.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.displayName}{isMe ? ' (você)' : ''}
                    </span>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: T.text.base, fontWeight: T.weight.bold, color: C.orange, flexShrink: 0,
                    }}>
                      <Flame size={12} /> {entry.daysDone}d
                    </span>
                  </div>
                )
              })}
              {myPos > 5 && (
                <div style={{ fontSize: T.text.sm, color: C.muted, textAlign: 'center', marginTop: 6 }}>
                  Você está em #{myPos}
                </div>
              )}
            </div>
          )}

          {/* Hoje ainda não contou? O card avisa antes de o dia virar. */}
          {window_.state === 'running' && sync && !completed
            && local.lastDay && !confirmed.has(local.lastDay) && (
            <div style={{
              background: `${C.blue}14`, border: `1px solid ${C.blue}33`,
              borderRadius: T.radius.md, padding: '9px 13px', marginBottom: 14,
              fontSize: T.text.md, color: C.blue,
            }}>
              O treino de {new Date(local.lastDay + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} ainda
              não foi confirmado. Abra o app com internet para ele entrar no placar.
            </div>
          )}
        </>
      )}

      {/* Prêmio */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.card2, border: `1px solid ${C.border}`,
        borderRadius: T.radius.md, padding: '10px 14px',
      }}>
        <Gift size={16} color={C.pink} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: T.text.md, color: C.muted2, lineHeight: 1.45 }}>
          Quem terminar no topo leva <strong style={{ color: C.text }}>{def.prize}</strong>
          {def.partner ? <> — cortesia de <strong style={{ color: C.text }}>{def.partner}</strong></> : null}.
        </span>
      </div>
    </Card>
  )
}
