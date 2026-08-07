// Página do treinador — read-only, sem login, aberta pelo link `?coach=<token>`.
//
// Renderiza só o resumo publicado em `coachShares/{token}`. Não existe nenhum
// caminho daqui para os dados do atleta: se o documento sumiu (link revogado),
// a tela diz isso e acaba.

import { useState, useEffect } from 'react'
import { Dumbbell, HeartPulse, Droplet, AlertTriangle } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, Bar, Tag } from '../primitives'
import { getCoachShare, type CoachShareSnapshot } from '../../lib/db'
import { dietLabel } from '../../lib/coachShare'
import { friendlyDate } from '../../lib/performance'
import { INJURY_PAIN_LEVEL } from '../../store/useWorkoutStore'

interface Props { token: string }

function painColor(level: number): string {
  return level >= INJURY_PAIN_LEVEL ? C.red : level >= 3 ? C.orange : C.muted2
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: 'system-ui, sans-serif', padding: '28px 16px 60px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

export function TrainerView({ token }: Props) {
  const [snapshot, setSnapshot] = useState<CoachShareSnapshot | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getCoachShare(token).then(s => { setSnapshot(s); setLoading(false) })
  }, [token])

  if (loading) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          Carregando...
        </div>
      </Shell>
    )
  }

  if (!snapshot) {
    return (
      <Shell>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: T.text['2xl'], fontWeight: T.weight.bold, marginBottom: 8 }}>Link indisponível</div>
          <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6 }}>
            Este link foi revogado pelo atleta ou nunca existiu. Peça um novo link para acessar o acompanhamento.
          </div>
        </Card>
      </Shell>
    )
  }

  const s = snapshot
  const updated = new Date(s.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <Shell>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: T.text.sm, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          The Rise Plan · acompanhamento
        </div>
        <div style={{ fontSize: 26, fontWeight: T.weight.extrabold, marginTop: 4, ...displayStyle }}>{s.athleteName}</div>
        <div style={{ fontSize: T.text.md, color: C.muted, marginTop: 4 }}>
          {friendlyDate(s.from)} a {friendlyDate(s.to)} · atualizado em {updated}
        </div>
      </div>

      {/* Resumo do período */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Treinos',    v: String(s.weekSummary.workouts), c: C.purple },
          { l: 'Distância',  v: `${s.weekSummary.km} km`,        c: C.running },
          { l: 'Tempo',      v: `${Math.round(s.weekSummary.minutes / 60)}h${String(s.weekSummary.minutes % 60).padStart(2, '0')}`, c: C.orange },
          { l: 'Prontidão média', v: s.weekSummary.avgReadiness != null ? `${s.weekSummary.avgReadiness}/100` : '—', c: C.blue },
        ].map((k, i) => (
          <Card key={i}>
            <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{k.l}</div>
            <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: k.c, ...displayStyle }}>{k.v}</div>
          </Card>
        ))}
      </div>

      {s.weekSummary.painFlags > 0 && (
        <Card style={{ marginBottom: 20, background: `${C.red}0D`, border: `1px solid ${C.red}33` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, color: C.red, marginBottom: 6 }}>
            <AlertTriangle size={16} /> {s.weekSummary.painFlags} treino{s.weekSummary.painFlags > 1 ? 's' : ''} com dor relatada
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.6 }}>
            Veja as observações abaixo antes de subir carga.
          </div>
        </Card>
      )}

      {/* Treinos */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}>
          <Dumbbell size={17} color={C.purple} /> Treinos do período
        </div>
        {s.workouts.length === 0 ? (
          <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
            Nenhum treino registrado nesse período.
          </div>
        ) : s.workouts.map((w, i) => (
          <div key={i} style={{ padding: 14, background: C.card2, borderRadius: T.radius.lg, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: T.weight.bold, fontSize: T.text.lg }}>{w.name}</div>
                <div style={{ fontSize: T.text.sm, color: C.muted }}>{friendlyDate(w.date)}</div>
              </div>
              <Tag label={w.type} color={C.purple} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { l: 'tempo', v: w.time, c: C.text },
                { l: 'dist', v: w.dist > 0 ? `${w.dist}km` : '—', c: C.running },
                { l: 'kcal', v: w.cal > 0 ? String(w.cal) : '—', c: C.red },
                ...(w.volumeKg ? [{ l: 'volume', v: `${(w.volumeKg / 1000).toFixed(1)}t`, c: C.purple }] : []),
              ].map((x, j) => (
                <div key={j} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: T.text.lg, fontWeight: T.weight.extrabold, color: x.c }}>{x.v}</div>
                  <div style={{ fontSize: T.text.xs, color: C.muted }}>{x.l}</div>
                </div>
              ))}
            </div>
            {w.painLevel != null && (
              <div style={{ marginTop: 10, fontSize: T.text.base, color: painColor(w.painLevel), fontWeight: T.weight.semibold }}>
                ⚠ Dor {w.painLevel}/5{w.painArea ? ` · ${w.painArea}` : ''}
              </div>
            )}
            {w.notes && (
              <div style={{ marginTop: 8, fontSize: T.text.base, color: C.muted2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                “{w.notes}”
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* Dia a dia */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}>
          <HeartPulse size={17} color={C.blue} /> Prontidão, dieta e hidratação
        </div>
        {s.days.length === 0 ? (
          <div style={{ fontSize: T.text.md, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
            Nenhum check-in registrado nesse período.
          </div>
        ) : s.days.map(d => (
          <div key={d.date} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: T.text.md, fontWeight: T.weight.semibold, minWidth: 96 }}>{friendlyDate(d.date)}</span>
              {d.readinessScore != null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
                  <Bar
                    pct={d.readinessScore}
                    color={d.readinessScore >= 78 ? C.green : d.readinessScore >= 58 ? C.orange : C.red}
                    h={4}
                  />
                  <span style={{ fontSize: T.text.sm, color: C.muted2, minWidth: 34, textAlign: 'right' }}>{d.readinessScore}</span>
                </div>
              ) : (
                <span style={{ fontSize: T.text.sm, color: C.muted, flex: 1, minWidth: 160 }}>sem check-in</span>
              )}
              <div style={{ display: 'flex', gap: 10, fontSize: T.text.sm, color: C.muted2 }}>
                {d.sleepHours != null && <span>😴 {d.sleepHours}h</span>}
                {d.soreness != null && <span>💪 dor {d.soreness}/5</span>}
                {d.waterMl != null && <span><Droplet size={11} style={{ verticalAlign: -1 }} /> {(d.waterMl / 1000).toFixed(1).replace('.', ',')}L</span>}
                {d.dietStatus && <span>🍽 {dietLabel(d.dietStatus)}</span>}
              </div>
            </div>
          </div>
        ))}
      </Card>

      <div style={{ fontSize: T.text.sm, color: C.muted, textAlign: 'center', lineHeight: 1.7 }}>
        Somente leitura. Este resumo é publicado pelo próprio atleta e pode ser revogado a qualquer momento.
      </div>
    </Shell>
  )
}
