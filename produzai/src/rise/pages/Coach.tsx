import { C, type Page } from '../data'
import { Card, Ring } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'

interface Props { setPage: (p: Page) => void }

export function Coach({ setPage }: Props) {
  const workouts = useWorkoutStore(s => s.workouts)
  const wd       = useWebDietStore(s => s.data)

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

  const doneMeals  = wd?.meals.filter(m => m.done) ?? []
  const calPct     = wd && wd.goals.cal > 0
    ? Math.min(Math.round(doneMeals.reduce((s, m) => s + m.cal, 0) / wd.goals.cal * 100), 100)
    : 0

  const treinoScore = Math.min(weekWorkouts.length * 20, 60)
  const dietaScore  = wd ? Math.round(calPct * 0.4) : 0
  const perf        = treinoScore + dietaScore

  interface Insight { icon: string; title: string; body: string; color: string }
  const insights: Insight[] = []

  if (weekWorkouts.length > 0) {
    const weekCal = weekWorkouts.reduce((s, w) => s + w.cal, 0)
    insights.push({
      icon: '🏋', color: C.purple,
      title: `${weekWorkouts.length} treino${weekWorkouts.length > 1 ? 's' : ''} esta semana`,
      body: `${weekCal > 0 ? weekCal + ' kcal queimadas · ' : ''}Continue assim para manter a consistência!`,
    })
  } else {
    insights.push({
      icon: '📅', color: C.orange,
      title: 'Nenhum treino esta semana',
      body: 'Registre seus treinos na aba Treino para acompanhar sua evolução.',
    })
  }

  if (wd) {
    const protPct = wd.goals.prot > 0
      ? Math.round(doneMeals.reduce((s, m) => s + m.prot, 0) / wd.goals.prot * 100)
      : 0
    insights.push({
      icon: '🥗', color: C.green,
      title: `${calPct}% da meta calórica hoje`,
      body: calPct < 50
        ? 'Não pule refeições — comer bem é parte do treino.'
        : calPct > 110
        ? 'Levemente acima da meta, ajuste no jantar.'
        : 'Ótimo controle calórico!',
    })
    insights.push({
      icon: '🥩', color: protPct >= 80 ? C.green : C.orange,
      title: `Proteína: ${protPct}% da meta`,
      body: protPct >= 80
        ? 'Excelente ingestão proteica — fundamental para recuperação muscular.'
        : 'Priorize carnes, ovos ou whey nas próximas refeições.',
    })
  } else {
    insights.push({
      icon: '🥗', color: C.muted,
      title: 'Dieta não configurada',
      body: 'Configure sua dieta para receber insights sobre nutrição e macros.',
    })
  }

  insights.push({
    icon: '💡', color: C.blue,
    title: 'Dica de consistência',
    body: 'Pequenas ações diárias constroem grandes resultados. 80% de consistência supera 100% de perfeição ocasional.',
  })

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🤖 Coach IA</div>
        <div style={{ fontSize: 13, color: C.muted }}>Análise do seu desempenho semanal</div>
      </div>

      {/* Performance score */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg,#F9731611,#A78BFA11)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Ring pct={perf} size={90} stroke={8} color={perf >= 70 ? C.green : perf >= 40 ? C.orange : C.red} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Performance Score</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {perf === 0
                ? 'Registre treinos e configure sua dieta para calcular seu score.'
                : perf >= 80 ? '🔥 Semana excelente! Você está no limite do seu potencial.'
                : perf >= 60 ? '💪 Boa semana. Pequenos ajustes podem otimizar ainda mais.'
                : perf >= 40 ? '📈 Em progresso. Foque na consistência de treino e dieta.'
                : '🎯 Comece devagar e construa o hábito — consistência é tudo.'}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span
                onClick={() => setPage('treino')}
                style={{ fontSize: 11, color: C.orange, cursor: 'pointer' }}
              >
                {weekWorkouts.length > 0 ? `🏋 ${weekWorkouts.length} treinos esta semana` : '+ Registrar treino'}
              </span>
              <span
                onClick={() => setPage('dieta')}
                style={{ fontSize: 11, color: C.green, cursor: 'pointer' }}
              >
                {wd ? '🥗 Dieta configurada' : '+ Configurar dieta'}
              </span>
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
          </Card>
        ))}
      </div>

      {/* Weekly summary */}
      {weekWorkouts.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📊 Resumo semanal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { l: 'Treinos', v: String(weekWorkouts.length), c: C.purple },
              { l: 'Km rodados', v: `${Math.round(weekWorkouts.reduce((s, w) => s + w.dist, 0) * 10) / 10}km`, c: C.running },
              { l: 'Kcal queimadas', v: String(weekWorkouts.reduce((s, w) => s + w.cal, 0)), c: C.red },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '10px 6px', background: C.card2, borderRadius: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
