import { useEffect, useMemo, useState } from 'react'
import { HeartPulse, TrendingDown, TrendingUp } from 'lucide-react'
import { C, T, displayStyle } from '../data'
import { Card, Ring } from '../primitives'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useAthleteStore } from '../../store/useAthleteStore'
import { getMentalHistory, type MentalEntry } from '../../lib/db'
import { buildLoadSeries, computeAcwr, computeReadiness } from '../../lib/trainingLoad'
import { recoveryDeviation } from '../../lib/recovery'

/** Janela usada para a linha de base de VFC e FC de repouso. */
const BASELINE_DAYS = 30

function lastDates(n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function ReadinessCard({ onOpenMental }: { onOpenMental?: () => void }) {
  const workouts = useWorkoutStore(s => s.workouts)
  const profile = useAthleteStore(s => s.profile)
  const [mentalHistory, setMentalHistory] = useState<Record<string, MentalEntry>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getMentalHistory(lastDates(BASELINE_DAYS))
      .then(setMentalHistory)
      .finally(() => setLoaded(true))
  }, [])

  const readiness = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const today = mentalHistory[todayKey]
    const series = buildLoadSeries(workouts, profile, 90)
    const last = series[series.length - 1]
    const deviation = recoveryDeviation(mentalHistory, todayKey)

    return computeReadiness({
      form: series.length >= 14 && last ? last.form : null,
      acwr: computeAcwr(workouts, profile),
      sleepHours: today?.sleepHours ?? null,
      mood: today?.mood ?? null,
      energy: today?.energy ?? null,
      hrvDeviationPct: deviation.hrvDeviationPct,
      restingHrDelta: deviation.restingHrDelta,
    })
  }, [workouts, profile, mentalHistory])

  if (!loaded) return null

  // Um único sinal não é prontidão, é chute — melhor pedir os dados que faltam.
  if (readiness.confidence < 2) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 8, ...displayStyle }}>
          <HeartPulse size={17} color={C.pink} /> Prontidão
        </div>
        <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6 }}>
          Registre sono, humor e energia no check-in de hoje para eu calcular sua prontidão.
          {onOpenMental && (
            <>
              {' '}
              <span onClick={onOpenMental} style={{ color: C.pink, cursor: 'pointer', fontWeight: T.weight.semibold }}>
                Fazer check-in →
              </span>
            </>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card style={{ borderTop: `2px solid ${readiness.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 12, ...displayStyle }}>
        <HeartPulse size={17} color={readiness.color} /> Prontidão de hoje
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <Ring pct={readiness.score} size={78} stroke={7} color={readiness.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: readiness.color, ...displayStyle }}>
            {readiness.label}
          </div>
          <div style={{ fontSize: T.text.base, color: C.muted, marginTop: 2 }}>
            {readiness.confidence} sinais considerados
          </div>
        </div>
      </div>

      {readiness.drivers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {readiness.drivers.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: T.text.md, color: C.muted2 }}>
              {d.impact === 'up'
                ? <TrendingUp size={13} color={C.green} style={{ flexShrink: 0 }} />
                : <TrendingDown size={13} color={C.orange} style={{ flexShrink: 0 }} />}
              {d.text}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: `${readiness.color}12`, border: `1px solid ${readiness.color}33`, borderRadius: T.radius.sm, padding: '10px 12px', fontSize: T.text.md, color: C.muted2, lineHeight: 1.55 }}>
        {readiness.recommendation}
      </div>
    </Card>
  )
}
