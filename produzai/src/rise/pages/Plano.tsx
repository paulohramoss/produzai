import { useContext, useEffect, useMemo, useState } from 'react'
import { CalendarRange, RefreshCw, Sparkles, Info, CircleCheck, CircleX } from 'lucide-react'
import { T, C, type Page, displayStyle } from '../data'
import { Card, Bar } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useAthleteStore } from '../../store/useAthleteStore'
import { usePlanStore } from '../../store/usePlanStore'
import { useAuthStore } from '../../store/useAuthStore'
import { getMentalHistory, type MentalEntry } from '../../lib/db'
import { buildLoadSeries, computeAcwr, computeReadiness } from '../../lib/trainingLoad'
import { recoveryDeviation } from '../../lib/recovery'
import { estimateFitness } from '../../lib/fitness'
import { generatePlan } from '../../lib/planBuilder'
import {
  SESSION_META, isPlanExpired, planProgress, resolvePace, todayKey,
  type PlanSession,
} from '../../lib/plan'
import { toast } from '../../lib/toast'

interface Props { setPage: (p: Page) => void }

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.card2,
  border: `1px solid ${C.border2}`,
  borderRadius: T.radius.sm,
  padding: '10px 12px',
  color: C.text,
  fontSize: T.text.md,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: T.text.sm,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  display: 'block',
  marginBottom: 6,
}

function friendlyHeader(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const prefix = date === today ? 'Hoje · ' : ''
  return `${prefix}${WEEKDAY_LABELS[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

function SessionCard({ session, today, vdot }: { session: PlanSession; today: string; vdot: number | null }) {
  const meta = SESSION_META[session.kind]
  const pace = resolvePace(session, vdot)
  const isPast = session.date < today
  const isToday = session.date === today

  return (
    <div style={{
      background: isToday ? C.card2 : C.card,
      border: `1px solid ${isToday ? meta.color + '55' : C.border}`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: T.radius.md,
      padding: '12px 14px',
      opacity: isPast && session.status === 'missed' ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.text.xs, color: C.muted, marginBottom: 3 }}>
            {friendlyHeader(session.date, today)}
          </div>
          <div style={{ fontSize: T.text.lg, fontWeight: T.weight.bold, color: C.text }}>
            {meta.icon} {session.title}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: T.text['2xs'], fontWeight: T.weight.bold, textTransform: 'uppercase', letterSpacing: 0.6,
            color: meta.color, background: `${meta.color}22`, borderRadius: T.radius['2xs'], padding: '2px 7px',
          }}>
            {meta.label}
          </span>
          {session.status === 'done' && <CircleCheck size={15} color={C.green} />}
          {session.status === 'missed' && <CircleX size={15} color={C.muted} />}
        </div>
      </div>

      {session.kind !== 'rest' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: meta.color }}>{session.targetMin} min</span>
          {session.targetKm ? <span style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: C.text }}>{session.targetKm} km</span> : null}
          {pace && <span style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: C.blue }}>{pace}</span>}
        </div>
      )}

      {session.description && (
        <div style={{ fontSize: T.text.md, color: C.muted2, lineHeight: 1.55, marginBottom: session.why ? 6 : 0 }}>
          {session.description}
        </div>
      )}

      {session.why && (
        <div style={{ fontSize: T.text.sm, color: C.muted, lineHeight: 1.5, fontStyle: 'italic' }}>
          {session.why}
        </div>
      )}

      {session.adjustmentNote && (
        <div style={{
          display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 8,
          background: `${C.orange}12`, border: `1px solid ${C.orange}33`,
          borderRadius: T.radius.xs, padding: '7px 9px',
        }}>
          <Info size={12} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: T.text.sm, color: C.muted2, lineHeight: 1.45 }}>{session.adjustmentNote}</span>
        </div>
      )}
    </div>
  )
}

export function Plano({ setPage }: Props) {
  const workouts = useWorkoutStore(s => s.workouts)
  const { profile, update: updateAthlete } = useAthleteStore()
  const { plan, setPlan, adapt, lastChanges, dismissChanges } = usePlanStore()
  const displayName = useAuthStore(s => s.displayName)
  const { isMobile } = useContext(LayoutContext)

  const [generating, setGenerating] = useState(false)
  const [mentalHistory, setMentalHistory] = useState<Record<string, MentalEntry>>({})
  const [goal, setGoal] = useState(profile.goal ?? '')
  const [raceDate, setRaceDate] = useState(profile.raceDate ?? '')
  const [raceDistance, setRaceDistance] = useState(profile.raceDistanceKm ? String(profile.raceDistanceKm) : '')
  const [availableDays, setAvailableDays] = useState<number[]>(profile.availableDays ?? [1, 2, 3, 4, 5, 6])

  const today = todayKey()

  useEffect(() => {
    const dates: string[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().slice(0, 10))
    }
    getMentalHistory(dates).then(setMentalHistory)
  }, [])

  const vdot = useMemo(() => estimateFitness(workouts)?.vdot ?? null, [workouts])

  // As regras locais rodam sempre que o usuário abre a página: é o que faz o
  // plano reagir a treino perdido, fadiga alta ou prontidão baixa sem depender
  // de uma nova chamada de IA.
  useEffect(() => {
    if (!plan) return
    const series = buildLoadSeries(workouts, profile, 90)
    const last = series[series.length - 1]
    const deviation = recoveryDeviation(mentalHistory, today)
    const todayMental = mentalHistory[today]

    const readiness = computeReadiness({
      form: series.length >= 14 && last ? last.form : null,
      acwr: computeAcwr(workouts, profile),
      sleepHours: todayMental?.sleepHours ?? null,
      mood: todayMental?.mood ?? null,
      energy: todayMental?.energy ?? null,
      hrvDeviationPct: deviation.hrvDeviationPct,
      restingHrDelta: deviation.restingHrDelta,
    })

    adapt({
      workouts,
      form: series.length >= 14 && last ? last.form : null,
      acwr: computeAcwr(workouts, profile),
      readiness: readiness.confidence >= 2 ? readiness.score : null,
      today,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, profile, mentalHistory, plan?.generatedAt])

  async function handleGenerate() {
    setGenerating(true)

    // O perfil é salvo antes: o briefing lê dele, e assim o objetivo não se
    // perde se a geração falhar.
    const patch = {
      goal: goal.trim() || undefined,
      raceDate: raceDate || undefined,
      raceDistanceKm: raceDistance ? Number(raceDistance) : undefined,
      availableDays,
    }
    updateAthlete(patch)

    const result = await generatePlan({
      workouts,
      profile: { ...profile, ...patch },
      userName: displayName ?? undefined,
      goalOverride: goal,
    })

    setGenerating(false)
    if (!result) {
      toast.error('Não consegui montar o plano agora. Tente novamente em instantes.')
      return
    }
    setPlan(result)
    toast.success('📋 Plano de 14 dias pronto!')
  }

  const progress = plan ? planProgress(plan) : null
  const expired = isPlanExpired(plan, today)

  const grouped = useMemo(() => {
    if (!plan) return []
    const byDate = new Map<string, PlanSession[]>()
    for (const s of [...plan.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
      byDate.set(s.date, [...(byDate.get(s.date) ?? []), s])
    }
    return [...byDate.entries()]
  }, [plan])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}>
            <CalendarRange size={20} color={C.blue} /> Plano
          </div>
          <div style={{ fontSize: T.text.md, color: C.muted }}>
            14 dias que se reescrevem conforme você treina
          </div>
        </div>
        {plan && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: C.card2, border: `1px solid ${C.blue}66`, borderRadius: T.radius.sm,
              padding: '8px 16px', color: C.blue, fontSize: T.text.md, fontWeight: T.weight.bold,
              cursor: generating ? 'default' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={generating ? 'spin' : undefined} />
            {generating ? 'Montando...' : 'Gerar novo bloco'}
          </button>
        )}
      </div>

      {/* Ajustes automáticos aplicados desde a última visita */}
      {lastChanges.length > 0 && (
        <Card style={{ marginBottom: 16, background: `${C.orange}0D`, border: `1px solid ${C.orange}33` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, ...displayStyle }}>
              <Sparkles size={16} color={C.orange} /> Ajustei seu plano
            </div>
            <button
              onClick={dismissChanges}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: T.text['2xl'], cursor: 'pointer', lineHeight: 1, padding: 0 }}
            >×</button>
          </div>
          {lastChanges.map((c, i) => (
            <div key={i} style={{ fontSize: T.text.md, color: C.muted2, lineHeight: 1.6, marginBottom: 4 }}>• {c}</div>
          ))}
        </Card>
      )}

      {!plan || expired ? (
        <Card>
          <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, marginBottom: 6, ...displayStyle }}>
            {expired && plan ? 'Seu bloco terminou' : 'Monte seu bloco de treino'}
          </div>
          <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
            Vou usar seu condicionamento atual, sua carga das últimas semanas e seus ritmos calculados para distribuir 14 dias de treino. Depois disso, o plano se ajusta sozinho conforme você treina (ou deixa de treinar).
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Qual seu objetivo?</label>
              <input
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="ex: correr 10km abaixo de 50min, terminar minha primeira meia"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Data da prova (opcional)</label>
              <input
                type="date"
                value={raceDate}
                min={today}
                onChange={e => setRaceDate(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Distância da prova</label>
              <select
                value={raceDistance}
                onChange={e => setRaceDistance(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              >
                <option value="">Não definida</option>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="21.1">Meia maratona</option>
                <option value="42.2">Maratona</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Dias que consigo treinar</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = availableDays.includes(day)
                  return (
                    <button
                      key={day}
                      onClick={() => setAvailableDays(d => active ? d.filter(x => x !== day) : [...d, day].sort())}
                      style={{
                        flex: 1, minWidth: 42, padding: '9px 0', borderRadius: T.radius.sm, cursor: 'pointer',
                        fontSize: T.text.md, fontWeight: T.weight.semibold,
                        background: active ? C.blue : C.card2,
                        color: active ? '#fff' : C.muted,
                        border: `1px solid ${active ? C.blue : C.border2}`,
                      }}
                    >{label}</button>
                  )
                })}
              </div>
            </div>
          </div>

          {workouts.length < 3 && (
            <div style={{ background: `${C.orange}12`, border: `1px solid ${C.orange}33`, borderRadius: T.radius.sm, padding: '10px 13px', fontSize: T.text.md, color: C.muted2, lineHeight: 1.55, marginBottom: 16 }}>
              Com poucos treinos registrados o plano começa conservador. Sincronize o Strava ou registre alguns treinos para eu calibrar volume e ritmo pelo seu histórico real.
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              background: generating ? C.card2 : C.blue, border: 'none', borderRadius: T.radius.md,
              padding: 13, color: generating ? C.muted : '#fff',
              fontSize: T.text.xl, fontWeight: T.weight.bold, cursor: generating ? 'default' : 'pointer',
            }}
          >
            <Sparkles size={16} />
            {generating ? 'Montando seu bloco...' : 'Gerar plano de 14 dias'}
          </button>
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16, borderTop: `2px solid ${C.blue}` }}>
            <div style={{ fontSize: T.text.xl, fontWeight: T.weight.bold, marginBottom: 6, ...displayStyle }}>{plan.focus}</div>
            <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 14 }}>
              Objetivo: {plan.goal}
              {plan.raceDate && ` · prova em ${plan.raceDate}`}
            </div>

            {progress && progress.total > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.text.md, marginBottom: 6 }}>
                  <span style={{ color: C.muted }}>Aderência ao plano</span>
                  <span style={{ fontWeight: T.weight.bold, color: C.green }}>
                    {progress.done} feitas · {progress.missed} perdidas · {progress.planned} pela frente
                  </span>
                </div>
                <Bar pct={progress.adherencePct} color={C.green} h={6} />
              </>
            )}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            {grouped.map(([date, sessions]) => (
              <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map(s => <SessionCard key={s.id} session={s} today={today} vdot={vdot} />)}
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span
              onClick={() => setPage('treino')}
              style={{ fontSize: T.text.md, color: C.orange, cursor: 'pointer', fontWeight: T.weight.semibold }}
            >
              Registrar um treino →
            </span>
          </div>
        </>
      )}
    </div>
  )
}
