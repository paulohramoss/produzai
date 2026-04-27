import { C, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'
import { clearTokens } from '../../services/strava'

interface Props { connected: string[]; setPage: (p: Page) => void }

const TYPE_COLOR: Record<string, string> = { Corrida: '#FC4C02', Ciclismo: '#F97316', Atividade: '#60A5FA' }

export function StravaPage({ connected, setPage }: Props) {
  const strava  = useStravaStore(s => s.data)
  const loading = useStravaStore(s => s.loading)
  const reload  = useStravaStore(s => s.load)
  const stravaOn = connected.includes('strava')

  if (!stravaOn) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏃</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Strava não conectado</div>
        <div style={{ fontSize: 13, marginBottom: 20 }}>Conecte sua conta para visualizar atividades e estatísticas.</div>
        <button onClick={() => setPage('integracoes')} style={{ background: C.strava, border: 'none', borderRadius: 10, padding: '12px 24px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Conectar Strava →
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🏃 Strava</div>
          <div style={{ fontSize: 13, color: C.muted }}>Atividades e performance</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {strava && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
              <Dot color={C.green} />
              Sync: {strava.lastSync}
            </div>
          )}
          <button
            onClick={reload}
            disabled={loading}
            style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: loading ? C.muted : C.text, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? '...' : '↻ Atualizar'}
          </button>
        </div>
      </div>

      {loading && !strava ? (
        <Card style={{ textAlign: 'center', padding: '40px', color: C.muted }}>Carregando dados do Strava...</Card>
      ) : strava ? (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { l: 'Km semana',    v: `${strava.weekKm}km`,    c: C.strava },
              { l: 'Atividades',   v: `${strava.weekRuns}`,     c: C.blue },
              { l: 'Kcal semana',  v: `${strava.weekCal}`,      c: C.red },
              { l: 'Elevação',     v: `${strava.weekElev}m`,    c: C.orange },
            ].map((k, i) => (
              <Card key={i}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Activity feed */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Atividades recentes</div>
                <Tag label="Strava" color={C.strava} />
              </div>
              {strava.activities.map((a, i) => (
                <div key={i} style={{ padding: '14px', background: C.card2, borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${TYPE_COLOR[a.type] ?? C.blue}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{a.date}</div>
                    </div>
                    <Tag label={a.type} color={TYPE_COLOR[a.type] ?? C.blue} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[
                      { l: 'dist',  v: `${a.dist}km`,    c: C.strava },
                      { l: 'pace',  v: a.pace,            c: C.text },
                      { l: 'tempo', v: a.time,            c: C.text },
                      { l: 'kcal',  v: `${a.cal}`,        c: C.red },
                      ...(a.hr > 0 ? [{ l: 'bpm', v: `${a.hr}`, c: C.pink }] : []),
                      { l: 'elev',  v: `${a.elev}m`,      c: C.orange },
                    ].map((s, j) => (
                      <div key={j} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: 9, color: C.muted }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Monthly progress */}
              <Card>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Volume mensal</div>
                <div style={{ textAlign: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: C.strava }}>
                    {strava.monthKm}<span style={{ fontSize: 15, color: C.muted }}> km</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>meta: {strava.monthGoal} km</div>
                </div>
                <Bar pct={Math.round(strava.monthKm / strava.monthGoal * 100)} color={C.strava} h={8} />
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 6 }}>
                  {Math.round(strava.monthKm / strava.monthGoal * 100)}% da meta
                </div>
              </Card>

              {/* PRs */}
              <Card>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏆 Recordes pessoais</div>
                {[
                  { l: '5 km', v: strava.pr5k },
                  { l: '10 km', v: strava.pr10k },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i === 0 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{r.l}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: r.v !== '—' ? C.blue : C.muted }}>{r.v}</span>
                  </div>
                ))}
              </Card>

              {/* HR Zones */}
              <Card>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Zonas de FC</div>
                {strava.zones.map((z, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 60, fontSize: 10, color: C.muted2 }}>{z.z}</span>
                    <Bar pct={z.pct} color={z.c} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: z.c, width: 28, textAlign: 'right' }}>{z.pct}%</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          {/* Disconnect */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              onClick={() => { clearTokens(); setPage('integracoes') }}
              style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12, color: C.muted, cursor: 'pointer' }}>
              Desconectar Strava
            </button>
          </div>
        </>
      ) : (
        <Card style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
          Erro ao carregar dados.{' '}
          <span onClick={reload} style={{ color: C.orange, cursor: 'pointer' }}>Tentar novamente</span>
        </Card>
      )}
    </div>
  )
}
