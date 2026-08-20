import { useState, useContext, useMemo, useRef } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { Dumbbell, TrendingUp, Trophy, Mic, Square, Camera } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Card, Tag, Bar, ChartTooltip } from '../primitives'
import { useWorkoutStore, INJURY_PAIN_LEVEL, type ManualWorkout } from '../../store/useWorkoutStore'
import { useAuthStore } from '../../store/useAuthStore'
import { holdAppUpdate } from '../../lib/appUpdate'
import { toast } from '../../lib/toast'
import { LayoutContext } from '../LayoutContext'
import { WORKOUT_TEMPLATES } from '../data/templates'
import {
  getWeekBuckets, aggregateWorkoutsByWeek, buildPaceTrend, computeRecords, formatPace,
  formatDuration, parseDurationToMinutes,
} from '../../lib/performance'
import { EFFORT_LEVELS, estimateCalories, REFERENCE_WEIGHT_KG, type EffortLevel } from '../../lib/calories'
import {
  ACTIVITY_TYPES, DEFAULT_NAMES, DEFAULT_EFFORT, usesDistance, buildWorkout,
} from '../../lib/workouts'
import { todayKey } from '../../lib/date'
import { useSpeechToText } from '../../lib/useSpeechToText'
import { parseWorkoutFromSpeech, parseWorkoutFromImage } from '../../lib/anthropic'
import { ExerciseEditor } from '../components/ExerciseEditor'
import { TrainingLoadCard } from '../components/TrainingLoadCard'
import { StrengthPanel } from '../components/StrengthPanel'
import { WeekPlanCard } from '../components/WeekPlanCard'
import { TrainingJournal } from '../components/TrainingJournal'
import { workoutVolume, hasStrengthData, type Exercise } from '../../lib/strength'

interface Props {
  setPage: (page: Page) => void
}

const MAX_PHOTO_SIZE = 5 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function typeColor(type: string): string {
  switch (type) {
    case 'Corrida': return C.running
    case 'Caminhada': return C.green
    case 'Academia': return C.purple
    case 'Ciclismo': return C.orange
    case 'Natação': return C.blue
    case 'Futebol': return C.green
    default: return C.muted2
  }
}

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

// Duas colunas quando cabem, uma quando não cabem. O corte é a largura do
// contêiner, não a da janela: dentro do modal sobra bem menos que a tela, e o
// `isMobile` do layout é um único corte em 768px — largo demais para separar um
// 320 de um 414. Com 120px de mínimo, "DISTÂNCIA (KM)" e "FC MÉDIA (BPM)" cabem
// em uma linha e os placeholders não truncam.
const FORM_COLS = 'repeat(auto-fit, minmax(120px, 1fr))'

const labelStyle: React.CSSProperties = {
  fontSize: T.text.sm,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  display: 'block',
  marginBottom: 6,
}

const PAIN_LABELS = ['Leve', 'Incômoda', 'Média', 'Forte', 'Muito forte']

function painColor(level: number): string {
  return level >= INJURY_PAIN_LEVEL ? C.red : level >= 3 ? C.orange : C.muted2
}

export function Treino({ setPage }: Props) {
  const { workouts, add, remove, update } = useWorkoutStore()
  const { isMobile } = useContext(LayoutContext)
  const weightKg = useAuthStore(s => s.body.weightKg)

  const [showModal, setShowModal] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  // Detalhes opcionais ficam recolhidos: o registro pede tipo + duração e deriva o resto.
  const [showMore, setShowMore] = useState(false)
  /** id do treino sendo corrigido — null quando o modal está registrando um novo. */
  const [editingId, setEditingId] = useState<string | null>(null)

  // Treino no meio de ser registrado é trabalho não salvo. A regra de "parado há
  // um minuto" não cobre isto: descansar 90s entre séries com o formulário
  // aberto é exatamente o normal aqui, e não é hora de trocar de versão.
  useEffect(() => {
    if (!showModal) return
    return holdAppUpdate()
  }, [showModal])
  const [form, setForm] = useState({
    type: 'Corrida',
    name: '',
    date: todayKey(),
    durationMin: '',
    dist: '',
    effort: DEFAULT_EFFORT as EffortLevel,
    hr: '',
    notes: '',
    painLevel: 0,
    painArea: '',
  })

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
  const weekKm = Math.round(weekWorkouts.reduce((s, w) => s + w.dist, 0) * 10) / 10
  const weekCal = weekWorkouts.reduce((s, w) => s + w.cal, 0)
  const weekCount = weekWorkouts.length

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const monthWorkouts = workouts.filter(w => {
    const [y, m, d] = w.rawDate.split('-').map(Number)
    return new Date(y, m - 1, d) >= monthStart
  })
  const monthKm = Math.round(monthWorkouts.reduce((s, w) => s + w.dist, 0) * 10) / 10

  const weeklyVolume = useMemo(() => aggregateWorkoutsByWeek(workouts, getWeekBuckets(8)), [workouts])
  const paceTrend = useMemo(() => buildPaceTrend(workouts, 12), [workouts])
  const records = useMemo(() => computeRecords(workouts), [workouts])
  const hasVolumeData = weeklyVolume.some(w => w.km > 0)

  const [dictation, setDictation] = useState('')
  const [parsing, setParsing] = useState(false)
  const [photo, setPhoto] = useState<{ name: string; mediaType: string; data: string } | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const { recording, toggle: toggleDictation, supported: speechSupported } = useSpeechToText(transcript => {
    setDictation(prev => (prev ? `${prev} ${transcript}` : transcript))
  })

  function openModal() {
    setEditingId(null)
    setForm({
      type: 'Corrida', name: '', date: todayKey(), durationMin: '', dist: '',
      effort: DEFAULT_EFFORT, hr: '', notes: '', painLevel: 0, painArea: '',
    })
    setShowTemplates(false)
    setShowMore(false)
    setDictation('')
    setPhoto(null)
    setExercises([])
    setShowModal(true)
  }

  // Correção de um treino já salvo: o formulário é o mesmo, preenchido a partir
  // do registro. Duração volta do tempo formatado ("1h05" → 65).
  function openEdit(w: ManualWorkout) {
    setEditingId(w.id)
    setForm({
      type: ACTIVITY_TYPES.includes(w.type) ? w.type : 'Outro',
      name: w.name,
      date: w.rawDate,
      durationMin: String(parseDurationToMinutes(w.time) ?? ''),
      dist: w.dist > 0 ? String(w.dist) : '',
      effort: w.effort ?? DEFAULT_EFFORT,
      hr: w.hr > 0 ? String(w.hr) : '',
      notes: w.notes ?? '',
      painLevel: w.painLevel ?? 0,
      painArea: w.painArea ?? '',
    })
    setShowTemplates(false)
    // Numa correção o que a pessoa quer mexer costuma estar justamente aqui.
    setShowMore(true)
    setDictation('')
    setPhoto(null)
    setExercises(w.exercises ?? [])
    setShowModal(true)
  }

  function applyTemplate(t: typeof WORKOUT_TEMPLATES[0]) {
    setForm(f => ({
      ...f,
      type: t.type,
      name: t.name,
      durationMin: String(t.durationMin),
      dist: t.dist > 0 ? String(t.dist) : '',
      effort: t.effort,
    }))
    setShowTemplates(false)
    toast.info(`📋 Template "${t.name}" aplicado`)
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error('Envie uma imagem (JPG, PNG, WEBP ou GIF).')
      return
    }
    if (file.size > MAX_PHOTO_SIZE) {
      toast.error('Imagem muito grande. Máximo 5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setPhoto({ name: file.name, mediaType: file.type, data: result.split(',')[1] })
    }
    reader.readAsDataURL(file)
  }

  // Voz, texto e foto caem no mesmo extrator — a foto tem prioridade quando existe.
  async function handleFillFromAI() {
    if (!dictation.trim() && !photo) return
    setParsing(true)
    const parsed = photo
      ? await parseWorkoutFromImage({ mediaType: photo.mediaType, data: photo.data }, dictation)
      : await parseWorkoutFromSpeech(dictation)
    setParsing(false)
    if (!parsed) {
      toast.error(
        photo
          ? 'Não consegui ler os dados dessa imagem. Tente outra foto ou preencha manualmente.'
          : 'Não consegui entender o treino. Tente descrever de novo ou preencha manualmente.',
      )
      return
    }
    setForm(f => ({
      ...f,
      type: parsed.type,
      name: parsed.name,
      durationMin: String(parsed.durationMin),
      dist: parsed.dist > 0 ? String(parsed.dist) : '',
      effort: parsed.effort,
      hr: parsed.hr > 0 ? String(parsed.hr) : '',
    }))
    toast.success(photo ? '📷 Treino lido da foto! Revise e salve.' : '🎤 Treino preenchido! Revise e salve.')
  }

  function handleSubmit() {
    const durationMin = parseInt(form.durationMin)
    if (!durationMin || durationMin <= 0) return
    // buildWorkout deriva pace, tempo formatado, nome e calorias — aqui só vai o
    // que o usuário informou. O peso entra na fórmula MET do gasto calórico.
    const workout = buildWorkout({
      type: form.type,
      name: form.name,
      date: form.date,
      durationMin,
      dist: usesDistance(form.type) ? form.dist : 0,
      effort: form.effort,
      hr: form.hr,
      weightKg,
      exercises,
      notes: form.notes,
      painLevel: form.painLevel,
      painArea: form.painArea,
    })
    if (editingId) {
      update(editingId, workout)
      toast.success(`✏️ ${workout.name} atualizado`)
    } else {
      add(workout)
      toast.success(`🏋 ${workout.name} registrado com sucesso!`)
    }
    setShowModal(false)
    setEditingId(null)
  }

  function handleRemove(id: string) {
    const w = workouts.find(x => x.id === id)
    remove(id)
    if (w) toast.info(`🗑 "${w.name}" removido`)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><Dumbbell size={20} color={C.orange} /> Treino</div>
          <div style={{ fontSize: T.text.md, color: C.muted }}>Performance física — força + cardio</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={openModal}
            style={{ background: C.purple, border: 'none', borderRadius: T.radius.sm, padding: '8px 16px', color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer' }}
          >
            + Registrar treino
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          {
            l: 'Treinos semana',
            v: weekCount > 0 ? String(weekCount) : '—',
            sub: weekCount > 0 ? 'esta semana' : 'Sem atividades',
            c: C.purple,
          },
          {
            l: 'Km semana',
            v: weekKm > 0 ? `${weekKm}km` : '—',
            sub: weekKm > 0 ? 'distância total' : '—',
            c: C.running,
          },
          {
            l: 'Kcal semana',
            v: weekCal > 0 ? String(weekCal) : '—',
            sub: weekCal > 0 ? 'queimadas' : '—',
            c: C.red,
          },
          {
            l: 'Km no mês',
            v: monthKm > 0 ? `${monthKm}km` : '—',
            sub: monthKm > 0 ? 'distância mensal' : '—',
            c: C.orange,
          },
        ].map((k, i) => (
          <Card key={i}>
            <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{k.l}</div>
            <div style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: k.c, marginBottom: 4, ...displayStyle }}>{k.v}</div>
            <div style={{ fontSize: T.text.sm, color: C.muted2 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Plano da semana e carga — o que vem, e se o corpo aguenta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
        <WeekPlanCard />
        <TrainingLoadCard workouts={workouts} />
        <StrengthPanel workouts={workouts} />
      </div>

      {/* Evolução de performance */}
      {(hasVolumeData || paceTrend.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {hasVolumeData && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
                <TrendingUp size={17} color={C.running} /> Volume semanal
              </div>
              <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 12 }}>Km percorridos por semana — últimas 8 semanas</div>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <AreaChart data={weeklyVolume} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kmGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.running} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={C.running} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="km" name="km" stroke={C.running} strokeWidth={2} fill="url(#kmGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {paceTrend.length >= 2 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 4, ...displayStyle }}>
                <TrendingUp size={17} color={C.blue} /> Evolução do ritmo
              </div>
              <div style={{ fontSize: T.text.base, color: C.muted, marginBottom: 12 }}>Pace (min/km) nas últimas corridas — quanto menor, melhor</div>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <LineChart data={paceTrend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={30} reversed />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="pace" name="min/km" stroke={C.blue} strokeWidth={2} dot={{ r: 3, fill: C.blue }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Recordes pessoais */}
      {(records.bestPace || records.longestDist || records.longestDuration || records.mostCal) && (
        <Card style={{ marginBottom: 16, borderTop: `2px solid ${C.orange}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 14, ...displayStyle }}>
            <Trophy size={17} color={C.orange} /> Recordes pessoais
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12 }}>
            {[
              records.bestPace && { l: 'Melhor pace (corrida)', v: `${formatPace(records.bestPace.value)}/km`, sub: records.bestPace.workout.name, c: C.blue },
              records.longestDist && { l: 'Maior distância', v: `${records.longestDist.value}km`, sub: records.longestDist.workout.name, c: C.running },
              records.longestDuration && { l: 'Treino mais longo', v: formatDuration(records.longestDuration.value), sub: records.longestDuration.workout.name, c: C.purple },
              records.mostCal && { l: 'Mais calorias', v: `${records.mostCal.value} kcal`, sub: records.mostCal.workout.name, c: C.red },
            ].filter((x): x is { l: string; v: string; sub: string; c: string } => Boolean(x)).map((r, i) => (
              <div key={i} style={{ background: C.card2, borderRadius: T.radius.md, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{r.l}</div>
                <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: r.c, ...displayStyle }}>{r.v}</div>
                <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TrainingJournal />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: 16 }}>
        {/* Activities */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl }}>Atividades recentes</div>
          </div>

          {workouts.length > 0 ? (
            workouts.slice(0, 6).map((a, i) => (
              <div key={i} style={{ padding: 14, background: C.card2, borderRadius: T.radius.lg, marginBottom: 8, borderLeft: `3px solid ${typeColor(a.type)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: T.weight.bold, fontSize: T.text.lg }}>{a.name}</div>
                    <div style={{ fontSize: T.text.sm, color: C.muted }}>{a.date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    {a.painLevel != null && a.painLevel > 0 && (
                      <Tag label={`Dor ${a.painLevel}/5`} color={painColor(a.painLevel)} small />
                    )}
                    <Tag label={a.type} color={typeColor(a.type)} />
                    <button
                      onClick={() => openEdit(a)}
                      title="Editar"
                      style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text.md, padding: '0 2px', lineHeight: 1 }}
                    >✎</button>
                    <button
                      onClick={() => handleRemove(a.id)}
                      title="Remover"
                      style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text['2xl'], padding: '0 2px', lineHeight: 1 }}
                    >×</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { l: 'dist', v: a.dist > 0 ? `${a.dist}km` : '—', c: typeColor(a.type) },
                    { l: 'pace', v: a.pace, c: C.text },
                    { l: 'tempo', v: a.time, c: C.text },
                    { l: 'kcal', v: a.cal > 0 ? String(a.cal) : '—', c: C.red },
                    { l: 'bpm', v: a.hr > 0 ? String(a.hr) : '—', c: C.pink },
                    // Tonelagem só aparece quando o treino tem exercícios —
                    // é a leitura de volume de quem levanta peso.
                    ...(hasStrengthData(a)
                      ? [{ l: 'volume', v: `${(workoutVolume(a) / 1000).toFixed(1)}t`, c: C.purple }]
                      : []),
                  ].map((s, j) => (
                    <div key={j} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: T.text.lg, fontWeight: T.weight.extrabold, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: T.text.xs, color: C.muted }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {a.painLevel != null && a.painLevel > 0 && (
                  <div style={{ marginTop: 10, fontSize: T.text.base, color: painColor(a.painLevel), fontWeight: T.weight.semibold }}>
                    ⚠ {PAIN_LABELS[a.painLevel - 1]}{a.painArea ? ` · ${a.painArea}` : ''}
                  </div>
                )}
                {a.notes && (
                  <div style={{ marginTop: 8, fontSize: T.text.base, color: C.muted2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    “{a.notes}”
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏋</div>
              <div style={{ fontWeight: T.weight.semibold, marginBottom: 6 }}>Nenhuma atividade registrada</div>
              <div style={{ fontSize: T.text.md }}>Registre seus treinos manualmente</div>
              <button
                onClick={openModal}
                style={{ marginTop: 16, background: C.purple, border: 'none', borderRadius: T.radius.sm, padding: '8px 20px', color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer' }}
              >
                + Registrar treino
              </button>
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {weekCount > 0 && (
            <Card>
              <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 12 }}>Resumo semanal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { l: 'Atividades', v: String(weekCount), c: C.text },
                  { l: 'Distância', v: `${weekKm} km`, c: C.running },
                  { l: 'Calorias', v: `${weekCal} kcal`, c: C.red },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: T.text.md, color: C.muted }}>{r.l}</span>
                    <span style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {monthKm > 0 && (
            <Card>
              <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 10 }}>Volume mensal</div>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.running }}>{monthKm}<span style={{ fontSize: T.text['2xl'], color: C.muted }}> km</span></div>
              </div>
              <Bar pct={Math.min(Math.round(monthKm / 120 * 100), 100)} color={C.running} h={8} />
              <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 6, textAlign: 'right' }}>meta: 120km</div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          className="rise-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: T.radius['3xl'], padding: 'clamp(20px, 6vw, 28px)', width: '100%', maxWidth: 480, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold }}>
                {editingId ? 'Editar treino' : 'Registrar treino'}
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</button>
            </div>

            {/* Registro rápido: voz, foto ou texto livre — só ao criar, porque
                numa correção o preenchimento automático sobrescreveria o que já
                está certo no formulário. */}
            {!editingId && (
            <div style={{ marginBottom: 16, background: C.card2, borderRadius: T.radius.md, padding: 14, border: `1px solid ${C.border2}` }}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {speechSupported && (
                  <button
                    onClick={toggleDictation}
                    title={recording ? 'Parar gravação' : 'Descrever treino por voz'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: recording ? C.red : C.purple, border: 'none', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    {recording ? <Square size={14} /> : <Mic size={16} />}
                  </button>
                )}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  title="Foto do relógio, da esteira ou do app"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: photo ? C.blue : C.card, border: `1px solid ${photo ? C.blue : C.border2}`,
                    color: photo ? '#fff' : C.muted, cursor: 'pointer',
                  }}
                >
                  <Camera size={16} />
                </button>
                <div style={{ fontSize: T.text.base, color: C.muted, flex: 1 }}>
                  {recording
                    ? '🔴 Ouvindo... descreva seu treino'
                    : 'Fale, digite ou mande o print do relógio — ex: "corri 5 km em 30 min"'}
                </div>
              </div>

              {photo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '6px 10px', marginBottom: 8 }}>
                  <img
                    src={`data:${photo.mediaType};base64,${photo.data}`}
                    alt={photo.name}
                    style={{ width: 34, height: 34, borderRadius: T.radius.xs, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: T.text.base, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {photo.name}
                  </span>
                  <button
                    onClick={() => setPhoto(null)}
                    style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text['2xl'], padding: '0 2px', lineHeight: 1 }}
                  >×</button>
                </div>
              )}

              <textarea
                value={dictation}
                onChange={e => setDictation(e.target.value)}
                placeholder={photo ? 'Quer complementar a foto? (opcional)' : 'Descreva o treino aqui — ou use o microfone'}
                rows={2}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: T.text.base, color: C.text, background: C.card, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '8px 10px', marginBottom: 8, lineHeight: 1.5, resize: 'none', fontFamily: 'inherit', outline: 'none' }}
              />

              {(() => {
                const canFill = Boolean(dictation.trim() || photo) && !parsing && !recording
                return (
                  <button
                    onClick={handleFillFromAI}
                    disabled={!canFill}
                    style={{
                      width: '100%', background: canFill ? C.purple : C.card, border: 'none', borderRadius: T.radius.sm,
                      padding: '8px', color: canFill ? '#fff' : C.muted, fontSize: T.text.base, fontWeight: T.weight.bold,
                      cursor: canFill ? 'pointer' : 'default',
                    }}
                  >
                    {parsing ? '✨ Lendo...' : '✨ Preencher com IA'}
                  </button>
                )
              })()}
            </div>
            )}

            {/* Template picker */}
            {!editingId && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowTemplates(s => !s)}
                style={{ background: showTemplates ? C.purple : C.card2, border: `1px solid ${showTemplates ? C.purple : C.border2}`, borderRadius: T.radius.sm, padding: '7px 14px', fontSize: T.text.base, fontWeight: T.weight.bold, color: showTemplates ? '#fff' : C.muted, cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                📋 {showTemplates ? 'Fechar templates' : 'Usar um template de treino'}
              </button>
              {showTemplates && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {WORKOUT_TEMPLATES.map((t, i) => (
                    <div
                      key={i}
                      onClick={() => applyTemplate(t)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: C.card2, borderRadius: 9, cursor: 'pointer', border: `1px solid ${C.border}` }}
                    >
                      <div>
                        <div style={{ fontSize: T.text.md, fontWeight: T.weight.semibold }}>{t.name}</div>
                        <div style={{ fontSize: T.text.xs, color: C.muted }}>{t.label} · {t.durationMin}min · {EFFORT_LEVELS[t.effort - 1].label}</div>
                      </div>
                      <span style={{ fontSize: T.text.sm, color: C.purple, fontWeight: T.weight.bold, flexShrink: 0 }}>{t.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Type selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Tipo de atividade</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t, name: '' }))}
                    style={{
                      padding: '6px 14px', borderRadius: T.radius.sm, border: 'none', cursor: 'pointer', fontSize: T.text.md, fontWeight: T.weight.semibold,
                      background: form.type === t ? typeColor(t) : C.card2,
                      color: form.type === t ? '#fff' : C.muted,
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* Essencial: duração e, em cardio, distância. O resto é derivado. */}
            <div style={{ display: 'grid', gridTemplateColumns: usesDistance(form.type) ? FORM_COLS : '1fr', gap: 14, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Duração (min) *</label>
                <input
                  type="number" min="1" max="600"
                  value={form.durationMin}
                  onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))}
                  placeholder="ex: 45"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[30, 45, 60, 90].map(min => (
                    <button
                      key={min}
                      onClick={() => setForm(f => ({ ...f, durationMin: String(min) }))}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: T.radius.xs, cursor: 'pointer',
                        fontSize: T.text.sm, fontWeight: T.weight.semibold,
                        background: form.durationMin === String(min) ? typeColor(form.type) : C.card2,
                        color: form.durationMin === String(min) ? '#fff' : C.muted,
                        border: `1px solid ${C.border}`,
                      }}
                    >{min}min</button>
                  ))}
                </div>
              </div>

              {usesDistance(form.type) && (
                <div>
                  <label style={labelStyle}>Distância (km)</label>
                  <input
                    type="number" min="0" step="0.1"
                    value={form.dist}
                    onChange={e => setForm(f => ({ ...f, dist: e.target.value }))}
                    placeholder="ex: 5.2"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            {/* Detalhes opcionais */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setShowMore(s => !s)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: T.text.base, color: C.muted, fontWeight: T.weight.semibold }}
              >
                {showMore ? '− Menos opções' : '+ Nome, data, esforço e FC'}
              </button>

              {showMore && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: FORM_COLS, gap: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Nome</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={DEFAULT_NAMES[form.type]}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Data</label>
                    <input
                      type="date"
                      value={form.date}
                      max={todayKey()}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      style={{ ...inputStyle, colorScheme: 'dark' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>FC média (bpm)</label>
                    <input
                      type="number" min="0" max="250"
                      value={form.hr}
                      onChange={e => setForm(f => ({ ...f, hr: e.target.value }))}
                      placeholder="ex: 145"
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Grau de esforço</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {EFFORT_LEVELS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setForm(f => ({ ...f, effort: value }))}
                          style={{
                            flex: 1, padding: '10px 4px', borderRadius: T.radius.sm, border: 'none', cursor: 'pointer',
                            fontSize: T.text.sm, fontWeight: T.weight.semibold, textAlign: 'center',
                            background: form.effort === value ? typeColor(form.type) : C.card2,
                            color: form.effort === value ? '#fff' : C.muted,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Exercícios de força */}
            <div style={{ marginBottom: 14 }}>
              <ExerciseEditor exercises={exercises} onChange={setExercises} workouts={workouts} />
            </div>

            {/* Como foi + dor — o que os números do treino não contam */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Como foi o treino</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Sensação, clima, o que travou, o que rendeu..."
                rows={2}
                maxLength={500}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />

              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Sentiu dor?</label>
                {/* Seis opções numa linha só: `minWidth` maior fazia "Muito forte"
                    quebrar sozinha numa segunda linha. */}
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    onClick={() => setForm(f => ({ ...f, painLevel: 0, painArea: '' }))}
                    style={{
                      flex: 1, minWidth: 0, padding: '9px 2px', borderRadius: T.radius.sm, cursor: 'pointer',
                      fontSize: T.text.sm, fontWeight: T.weight.semibold,
                      background: form.painLevel === 0 ? C.green : C.card2,
                      border: `1px solid ${form.painLevel === 0 ? C.green : C.border2}`,
                      color: form.painLevel === 0 ? '#fff' : C.muted,
                    }}
                  >
                    Não
                  </button>
                  {PAIN_LABELS.map((lbl, i) => {
                    const level = i + 1
                    const active = form.painLevel === level
                    return (
                      <button
                        key={level}
                        onClick={() => setForm(f => ({ ...f, painLevel: level }))}
                        style={{
                          flex: 1, minWidth: 0, padding: '9px 2px', borderRadius: T.radius.sm, cursor: 'pointer',
                          fontSize: T.text.sm, fontWeight: T.weight.semibold,
                          background: active ? painColor(level) : C.card2,
                          border: `1px solid ${active ? painColor(level) : C.border2}`,
                          color: active ? '#fff' : C.muted,
                        }}
                      >
                        {lbl}
                      </button>
                    )
                  })}
                </div>

                {form.painLevel > 0 && (
                  <>
                    <input
                      value={form.painArea}
                      onChange={e => setForm(f => ({ ...f, painArea: e.target.value }))}
                      placeholder="Onde doeu? ex: joelho direito, lombar"
                      maxLength={60}
                      style={{ ...inputStyle, marginTop: 10 }}
                    />
                    {form.painLevel >= INJURY_PAIN_LEVEL && (
                      <div style={{ fontSize: T.text.sm, color: C.red, marginTop: 8, lineHeight: 1.6 }}>
                        ⚠️ Dor nesse nível é sinal de lesão, não de treino puxado. Registre e
                        considere segurar a carga até melhorar.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Prévia do que será salvo */}
            {parseInt(form.durationMin) > 0 && (
              <div style={{ background: C.card2, borderRadius: T.radius.sm, padding: '10px 14px', marginBottom: 14, fontSize: T.text.md, color: C.muted }}>
                Gasto calórico estimado: <strong style={{ color: C.text }}>{estimateCalories(form.type, parseInt(form.durationMin), form.effort, weightKg)} kcal</strong>
                {weightKg == null && (
                  <div style={{ fontSize: T.text.sm, color: C.orange, marginTop: 6, lineHeight: 1.5 }}>
                    Calculado com peso de referência de {REFERENCE_WEIGHT_KG}kg.{' '}
                    <span
                      onClick={() => setPage('perfil')}
                      style={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Informe seu peso no Perfil
                    </span>{' '}
                    para uma estimativa real.
                  </div>
                )}
              </div>
            )}

            {(() => {
              const canSave = parseInt(form.durationMin) > 0
              return (
                <button
                  onClick={handleSubmit}
                  disabled={!canSave}
                  style={{
                    width: '100%', padding: 12, borderRadius: T.radius.md, border: 'none',
                    cursor: canSave ? 'pointer' : 'not-allowed',
                    background: canSave ? typeColor(form.type) : C.border2,
                    color: '#fff', fontSize: T.text.xl, fontWeight: T.weight.bold,
                  }}
                >
                  {editingId ? 'Salvar alterações' : 'Salvar treino'}
                </button>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
