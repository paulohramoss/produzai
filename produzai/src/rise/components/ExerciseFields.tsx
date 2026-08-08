import { useMemo, useState } from 'react'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import { T, C } from '../data'
import type { ManualWorkout } from '../../store/useWorkoutStore'
import {
  emptyExercise, formatLoad, formatPrescription, loadDelta, previousLoad, MAX_EXERCISES,
  type WorkoutExercise,
} from '../../lib/exercises'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.card,
  border: `1px solid ${C.border2}`,
  borderRadius: T.radius.xs,
  padding: '7px 9px',
  color: C.text,
  fontSize: T.text.base,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const microLabel: React.CSSProperties = {
  fontSize: T.text['2xs'],
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  display: 'block',
  marginBottom: 3,
}

function deltaColor(diffKg: number): string {
  if (diffKg > 0) return C.green
  if (diffKg < 0) return C.muted2
  return C.muted
}

function deltaLabel(diffKg: number): string {
  if (diffKg === 0) return 'mantida'
  const n = Math.abs(diffKg).toString().replace('.', ',')
  return `${diffKg > 0 ? '+' : '−'}${n}kg`
}

// ── Editor (modal de registro) ───────────────────────────────────────────────

interface EditorProps {
  exercises: WorkoutExercise[]
  onChange: (next: WorkoutExercise[]) => void
  /** Histórico para descobrir a carga anterior de cada exercício. */
  workouts: ManualWorkout[]
  /** Data do treino em edição ("YYYY-MM-DD"): só conta o que veio antes dela. */
  date: string
  accent: string
}

export function ExerciseEditor({ exercises, onChange, workouts, date, accent }: EditorProps) {
  const [open, setOpen] = useState(false)
  // Abre sozinho quando a IA trouxe a lista — o usuário precisa revisar as cargas.
  const visible = open || exercises.length > 0

  function update(i: number, patch: Partial<WorkoutExercise>) {
    onChange(exercises.map((ex, j) => (j === i ? { ...ex, ...patch } : ex)))
  }

  function remove(i: number) {
    onChange(exercises.filter((_, j) => j !== i))
  }

  function add() {
    setOpen(true)
    onChange([...exercises, emptyExercise()])
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {!visible ? (
        <button
          onClick={add}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: T.text.base, color: C.muted, fontWeight: T.weight.semibold,
          }}
        >
          + Exercícios, séries e cargas
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: T.text.sm, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Exercícios {exercises.length > 0 && `(${exercises.length})`}
            </span>
            {exercises.length > 0 && (
              <button
                onClick={() => onChange([])}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: T.text.base, color: C.muted }}
              >
                limpar
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {exercises.map((ex, i) => (
              <ExerciseRow
                key={i}
                exercise={ex}
                workouts={workouts}
                date={date}
                accent={accent}
                onChange={patch => update(i, patch)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>

          {exercises.length < MAX_EXERCISES && (
            <button
              onClick={add}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
                background: C.card2, border: `1px dashed ${C.border2}`, borderRadius: T.radius.sm,
                padding: '7px 12px', color: C.muted, fontSize: T.text.base, fontWeight: T.weight.semibold,
                cursor: 'pointer', width: '100%', justifyContent: 'center',
              }}
            >
              <Plus size={13} /> Adicionar exercício
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface RowProps {
  exercise: WorkoutExercise
  workouts: ManualWorkout[]
  date: string
  accent: string
  onChange: (patch: Partial<WorkoutExercise>) => void
  onRemove: () => void
}

function ExerciseRow({ exercise, workouts, date, accent, onChange, onRemove }: RowProps) {
  const previous = useMemo(
    () => (exercise.name.trim() ? previousLoad(exercise.name, workouts, { before: date }) : null),
    [exercise.name, workouts, date],
  )
  const diffKg = previous && exercise.loadKg > 0
    ? Math.round((exercise.loadKg - previous.loadKg) * 10) / 10
    : null

  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.sm, padding: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          value={exercise.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Nome do exercício"
          style={{ ...inputStyle, fontWeight: T.weight.semibold }}
        />
        <button
          onClick={onRemove}
          title="Remover exercício"
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1.2fr', gap: 8 }}>
        <div>
          <label style={microLabel}>Séries</label>
          <input
            type="number" min="0" max="20" inputMode="numeric"
            value={exercise.sets > 0 ? String(exercise.sets) : ''}
            onChange={e => onChange({ sets: Math.max(0, parseInt(e.target.value) || 0) })}
            placeholder="3"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={microLabel}>Repetições</label>
          <input
            value={exercise.reps}
            onChange={e => onChange({ reps: e.target.value })}
            placeholder="10 a 12"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={microLabel}>Carga (kg)</label>
          <input
            type="number" min="0" step="0.5" inputMode="decimal"
            value={exercise.loadKg > 0 ? String(exercise.loadKg) : ''}
            onChange={e => onChange({ loadKg: Math.max(0, parseFloat(e.target.value) || 0) })}
            placeholder="—"
            style={inputStyle}
          />
        </div>
      </div>

      {exercise.note && (
        <div style={{ fontSize: T.text.sm, color: C.muted2, marginTop: 7 }}>{exercise.note}</div>
      )}

      {previous && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => onChange({ loadKg: previous.loadKg })}
            title="Repetir a carga da última vez"
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: T.text.sm, color: C.muted, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <TrendingUp size={11} color={accent} />
            última: <strong style={{ color: C.text }}>{formatLoad(previous.loadKg)}</strong>
          </button>
          {diffKg !== null && (
            <span style={{ fontSize: T.text.sm, fontWeight: T.weight.bold, color: deltaColor(diffKg) }}>
              {deltaLabel(diffKg)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Leitura (card do histórico) ──────────────────────────────────────────────

interface SummaryProps {
  workout: ManualWorkout
  /** Todos os treinos, para comparar cada carga com a sessão anterior. */
  workouts: ManualWorkout[]
}

export function ExerciseSummary({ workout, workouts }: SummaryProps) {
  const [open, setOpen] = useState(false)
  const exercises = workout.exercises ?? []
  if (exercises.length === 0) return null

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: T.text.base, fontWeight: T.weight.semibold, color: open ? C.orange : C.muted,
        }}
      >
        🏋 {open ? 'Fechar exercícios' : `Ver ${exercises.length} exercícios`}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {exercises.map((ex, i) => {
            const delta = loadDelta(ex, workout, workouts)
            const spec = formatPrescription(ex)
            return (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10,
                  padding: '7px 10px', background: C.card, borderRadius: T.radius.xs, border: `1px solid ${C.border}`,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: T.text.md, color: C.text }}>{ex.name}</div>
                  {(spec || ex.note) && (
                    <div style={{ fontSize: T.text.sm, color: C.muted }}>
                      {[spec, ex.note].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: ex.loadKg > 0 ? C.text : C.muted }}>
                    {formatLoad(ex.loadKg)}
                  </div>
                  {delta && (
                    <div style={{ fontSize: T.text.xs, fontWeight: T.weight.semibold, color: deltaColor(delta.diffKg) }}>
                      {deltaLabel(delta.diffKg)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
