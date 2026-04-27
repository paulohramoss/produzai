import { C, type Page } from '../data'
import { Card, Tag, Bar, Ring } from '../primitives'
import { useStravaStore } from '../../store/useStravaStore'
import { useWebDietStore } from '../../store/useWebDietStore'

interface Props { connected: string[]; setPage: (p: Page) => void }

interface Insight { icon: string; title: string; body: string; color: string; score?: number }

function buildInsights(
  strava: ReturnType<typeof useStravaStore.getState>['data'],
  wd: ReturnType<typeof useWebDietStore.getState>['data'],
  connected: string[],
): Insight[] {
  const list: Insight[] = []
  const stravaOn = connected.includes('strava')
  const wdOn     = connected.includes('webdiet')

  if (stravaOn && strava) {
    const pct = strava.monthGoal > 0 ? Math.round(strava.monthKm / strava.monthGoal * 100) : 0
    list.push({
      icon: '🏃', color: '#FC4C02',
      title: `${strava.weekKm} km rodados esta semana`,
      body: `${strava.weekRuns} atividade${strava.weekRuns !== 1 ? 's' : ''} · ${strava.weekCal} kcal · ${strava.weekElev}m de elevação. Mês: ${strava.monthKm}/${strava.monthGoal} km (${pct}%).`,
      score: pct,
    })

    const z2 = strava.zones.find(z => z.z === 'Z2 Base')
    if (z2) {
      const z2Good = z2.pct >= 25
      list.push({
        icon: '❤️', color: z2Good ? C.green : C.orange,
        title: z2Good ? 'Boa distribuição aeróbica' : 'Aumente o tempo em Z2',
        body: `${z2.pct}% do tempo em Z2 (Base). Treino polarizado recomenda 70–80% em Z1/Z2 para desenvolver base aeróbica.`,
        score: z2.pct,
      })
    }

    if (strava.pr10k !== '—') {
      list.push({
        icon: '🏆', color: C.blue,
        title: `PR 10km: ${strava.pr10k}`,
        body: strava.pr5k !== '—' ? `PR 5km: ${strava.pr5k}. Continue treinando consistência para baixar esses números!` : 'Continue treinando consistência para melhorar o recorde!',
      })
    }
  }

  if (wdOn && wd) {
    const doneMeals  = wd.meals.filter(m => m.done)
    const calEaten   = doneMeals.reduce((s, m) => s + m.cal, 0)
    const protEaten  = doneMeals.reduce((s, m) => s + m.prot, 0)
    const calPct     = wd.goals.cal  > 0 ? Math.round(calEaten  / wd.goals.cal  * 100) : 0
    const protPct    = wd.goals.prot > 0 ? Math.round(protEaten / wd.goals.prot * 100) : 0

    list.push({
      icon: '🥗', color: C.webdiet,
      title: `${calPct}% da meta calórica hoje`,
      body: `${calEaten} de ${wd.goals.cal} kcal consumidas (${doneMeals.length}/${wd.meals.length} refeições). ${calPct < 50 ? 'Não pule refeições — comer bem é parte do treino.' : calPct > 110 ? 'Levemente acima da meta, ajuste no jantar.' : 'Ótimo controle calórico!'}`,
      score: calPct,
    })

    const protColor = protPct >= 80 ? C.green : protPct >= 50 ? C.orange : C.red
    list.push({
      icon: '🥩', color: protColor,
      title: `Proteína: ${protEaten}g de ${wd.goals.prot}g (${protPct}%)`,
      body: protPct >= 80
        ? 'Excelente ingestão proteica — fundamental para recuperação muscular.'
        : `Faltam ${wd.goals.prot - protEaten}g de proteína hoje. Priorize carnes, ovos ou whey nas próximas refeições.`,
      score: protPct,
    })
  }

  if (stravaOn && wdOn && strava && wd) {
    const calBurned   = Math.round(strava.weekCal / 7)
    const doneMeals   = wd.meals.filter(m => m.done)
    const calEaten    = doneMeals.reduce((s, m) => s + m.cal, 0)
    const balance     = calEaten - calBurned
    list.push({
      icon: balance < 0 ? '🟢' : '🟡', color: balance < 0 ? C.green : C.orange,
      title: `Balanço calórico: ${balance > 0 ? '+' : ''}${balance} kcal`,
      body: balance < -300 ? 'Déficit expressivo — ótimo para perda de gordura.' : balance < 0 ? 'Déficit leve, ideal para manutenção e recomposição.' : balance < 300 ? 'Leve superávit, adequado para ganho muscular.' : 'Superávit elevado — ajuste a dieta ou aumente o treino.',
    })
  }

  if (!stravaOn && !wdOn) {
    list.push({
      icon: '🔗', color: C.orange,
      title: 'Conecte suas fontes de dados',
      body: 'Configure o Strava e a Dieta para receber insights personalizados sobre treino, nutrição e performance.',
    })
  }

  return list
}

export function Coach({ connected, setPage }: Props) {
  const strava = useStravaStore(s => s.data)
  const wd     = useWebDietStore(s => s.data)
  const insights = buildInsights(strava, wd, connected)

  const stravaOn = connected.includes('strava')
  const wdOn     = connected.includes('webdiet')

  const perf = stravaOn && strava
    ? Math.min(100, Math.round(
        (strava.monthKm / strava.monthGoal) * 40 +
        (strava.weekRuns >= 3 ? 30 : strava.weekRuns * 10) +
        (wdOn && wd ? Math.min(30, wd.meals.filter(m => m.done).length / Math.max(wd.meals.length, 1) * 30) : 0)
      ))
    : 0

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🤖 Coach IA</div>
        <div style={{ fontSize: 13, color: C.muted }}>Análise automática do seu desempenho</div>
      </div>

      {/* Performance score */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg,#F9731611,#FC4C0211)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Ring pct={perf} size={90} stroke={8} color={perf >= 70 ? C.green : perf >= 40 ? C.orange : C.red} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Performance Score</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {perf === 0
                ? 'Conecte o Strava para calcular seu score de performance.'
                : perf >= 80 ? '🔥 Semana excelente! Você está no limite do seu potencial.'
                : perf >= 60 ? '💪 Boa semana. Pequenos ajustes podem otimizar ainda mais.'
                : perf >= 40 ? '📈 Em progresso. Foque na consistência de treino e dieta.'
                : '🎯 Comece devagar e construa o hábito — consistência é tudo.'}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {stravaOn ? <Tag label="🏃 Strava ativo" color={C.strava} /> : <span onClick={() => setPage('integracoes')} style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}>+ Conectar Strava</span>}
              {wdOn ? <Tag label="🥗 Dieta ativa" color={C.webdiet} /> : <span onClick={() => setPage('integracoes')} style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}>+ Configurar Dieta</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Insights grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {insights.map((ins, i) => (
          <Card key={i} style={{ borderLeft: `3px solid ${ins.color}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{ins.icon}</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: ins.color, lineHeight: 1.4 }}>{ins.title}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{ins.body}</div>
            {ins.score !== undefined && (
              <div style={{ marginTop: 10 }}>
                <Bar pct={ins.score} color={ins.color} h={4} />
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{ins.score}%</div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Weekly summary */}
      {stravaOn && strava && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📊 Resumo semanal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {[
              { l: 'Km semana',  v: `${strava.weekKm}`,   u: 'km',  c: C.strava },
              { l: 'Atividades', v: `${strava.weekRuns}`,  u: '',    c: C.blue },
              { l: 'Calorias',   v: `${strava.weekCal}`,   u: 'kcal',c: C.red },
              { l: 'Elevação',   v: `${strava.weekElev}`,  u: 'm',   c: C.orange },
              { l: 'PR 10km',    v: strava.pr10k,          u: '',    c: C.green },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '10px 6px', background: C.card2, borderRadius: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: s.c }}>{s.v}<span style={{ fontSize: 10, color: C.muted }}>{s.u}</span></div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
