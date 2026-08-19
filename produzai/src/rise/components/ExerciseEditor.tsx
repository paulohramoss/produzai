// Editor de exercícios do treino de força.
//
// A tela pede o que o atleta de musculação realmente anota: exercício, e para
// cada série repetições e carga. O botão de repetir a última sessão existe
// porque é assim que a progressão acontece — você olha o que fez da última vez
// e tenta bater.

import { useState } from 'react'
import { Dumbbell, Plus, RotateCcw } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import {
  COMMON_EXERCISES, exerciseVolume, best1RM, knownExercises, lastSessionOf,
  type Exercise, type WorkoutSet,
} from '../../lib/strength'
import type { ManualWorkout } from '../../store/useWorkoutStore'

const cell: React.CSSProperties = {
  width: '100%', background: C.card, border: `1px solid ${C.border2}`,
  borderRadius: T.radius.xs, padding: '7px 8px', color: C.text,
  fontSize: T.text.md, outline: 'none', boxSizing: 'border-box', textAlign: 'center',
}

interface Props {
  exercises: Exercise[]
  onChange: (next: Exercise[]) => void
  /** Histórico, para sugerir nomes e repetir a última sessão. */
  workouts: ManualWorkout[]
}

export function ExerciseEditor({ exercises, onChange, workouts }: Props) {
  const [nameDraft, setNameDraft] = useState('')

  const suggestions = (() => {
    const known = knownExercises(workouts, 12)
    const pool = known.length > 0 ? known : COMMON_EXERCISES.slice(0, 8)
    const used = new Set(exercises.map(e => e.name.toLowerCase()))
    return pool.filter(n => !used.has(n.toLowerCase())).slice(0, 6)
  })()

  function addExercise(name: string) {
    const clean = name.trim()
    if (!clean) return
    // Já treinou isso antes? Começa com as séries da última vez, para o usuário
    // só ajustar o que mudou em vez de digitar tudo de novo.
    const previous = lastSessionOf(workouts, clean)
    onChange([...exercises, {
      name: clean,
      sets: previous ? previous.sets.map(s => ({ ...s })) : [{ reps: 10, weightKg: 0 }],
    }])
    setNameDraft('')
  }

  function updateExercise(i: number, patch: Partial<Exercise>) {
    onChange(exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  function removeExercise(i: number) {
    onChange(exercises.filter((_, idx) => idx !== i))
  }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) {
    const ex = exercises[exIdx]
    updateExercise(exIdx, {
      sets: ex.sets.map((s, idx) => (idx === setIdx ? { ...s, ...patch } : s)),
    })
  }

  function addSet(exIdx: number) {
    const ex = exercises[exIdx]
    const last = ex.sets[ex.sets.length - 1] ?? { reps: 10, weightKg: 0 }
    updateExercise(exIdx, { sets: [...ex.sets, { ...last }] })
  }

  function removeSet(exIdx: number, setIdx: number) {
    const ex = exercises[exIdx]
    if (ex.sets.length <= 1) return
    updateExercise(exIdx, { sets: ex.sets.filter((_, idx) => idx !== setIdx) })
  }

  function repeatLast(exIdx: number) {
    const ex = exercises[exIdx]
    const previous = lastSessionOf(workouts, ex.name)
    if (!previous) return
    updateExercise(exIdx, { sets: previous.sets.map(s => ({ ...s })) })
  }

  const totalVolume = exercises.reduce((s, e) => s + exerciseVolume(e), 0)

  return (
    <div style={{ background: C.card2, borderRadius: T.radius.md, padding: 14, border: `1px solid ${C.border2}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: T.weight.bold, fontSize: T.text.lg, ...displayStyle }}>
          <Dumbbell size={15} color={C.purple} /> Exercícios
        </div>
        {totalVolume > 0 && (
          <span style={{ fontSize: T.text.sm, color: C.muted }}>
            volume: <strong style={{ color: C.text }}>{totalVolume.toLocaleString('pt-BR')} kg</strong>
          </span>
        )}
      </div>

      {exercises.map((ex, i) => {
        const previous = lastSessionOf(workouts, ex.name)
        const rm = best1RM(ex)
        return (
          <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                value={ex.name}
                onChange={e => updateExercise(i, { name: e.target.value })}
                placeholder="Nome do exercício"
                style={{ ...cell, textAlign: 'left', flex: 1, fontWeight: T.weight.semibold }}
              />
              {previous && (
                <button
                  onClick={() => repeatLast(i)}
                  title="Repetir as séries da última vez"
                  style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '6px 8px', color: C.muted, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                onClick={() => removeExercise(i)}
                title="Remover exercício"
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text['2xl'], lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
              >×</button>
            </div>

            {/* Cabeçalho das colunas */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 24px', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: T.text.xs, color: C.muted, textAlign: 'center' }}>#</span>
              <span style={{ fontSize: T.text.xs, color: C.muted, textAlign: 'center' }}>reps</span>
              <span style={{ fontSize: T.text.xs, color: C.muted, textAlign: 'center' }}>kg</span>
              <span />
            </div>

            {ex.sets.map((s, j) => (
              <div key={j} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 24px', gap: 6, marginBottom: 5, alignItems: 'center' }}>
                <span style={{ fontSize: T.text.sm, color: C.muted, textAlign: 'center' }}>{j + 1}</span>
                <input
                  type="number" inputMode="numeric" min={1} max={999}
                  value={s.reps || ''}
                  onChange={e => updateSet(i, j, { reps: parseInt(e.target.value) || 0 })}
                  placeholder="10"
                  style={cell}
                />
                <input
                  type="number" inputMode="decimal" min={0} max={1000} step="0.5"
                  value={s.weightKg || ''}
                  onChange={e => updateSet(i, j, { weightKg: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  style={cell}
                />
                <button
                  onClick={() => removeSet(i, j)}
                  disabled={ex.sets.length <= 1}
                  title="Remover série"
                  style={{ background: 'none', border: 'none', color: ex.sets.length <= 1 ? C.border2 : C.muted, cursor: ex.sets.length <= 1 ? 'default' : 'pointer', fontSize: T.text.lg, lineHeight: 1, padding: 0 }}
                >×</button>
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
              <button
                onClick={() => addSet(i)}
                style={{ background: 'none', border: 'none', padding: 0, color: C.purple, fontSize: T.text.sm, fontWeight: T.weight.bold, cursor: 'pointer' }}
              >
                + série
              </button>
              <span style={{ fontSize: T.text.xs, color: C.muted }}>
                {exerciseVolume(ex) > 0 && `${exerciseVolume(ex).toLocaleString('pt-BR')} kg`}
                {rm !== null && ` · 1RM ~${rm} kg`}
              </span>
            </div>

            {previous && (
              <div style={{ fontSize: T.text.xs, color: C.muted, marginTop: 5 }}>
                última vez: {previous.sets.map(s => `${s.reps}×${s.weightKg || 'PC'}`).join(', ')}
              </div>
            )}
          </div>
        )
      })}

      {/* Adicionar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: suggestions.length > 0 ? 10 : 0 }}>
        <input
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExercise(nameDraft) } }}
          placeholder="Novo exercício"
          style={{ ...cell, textAlign: 'left', flex: 1 }}
        />
        <button
          onClick={() => addExercise(nameDraft)}
          disabled={!nameDraft.trim()}
          style={{
            background: nameDraft.trim() ? C.purple : C.card,
            border: `1px solid ${nameDraft.trim() ? C.purple : C.border2}`,
            borderRadius: T.radius.xs, padding: '0 12px', flexShrink: 0,
            color: nameDraft.trim() ? '#fff' : C.muted,
            cursor: nameDraft.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center',
          }}
        >
          <Plus size={15} />
        </button>
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {suggestions.map(name => (
            <button
              key={name}
              onClick={() => addExercise(name)}
              style={{
                background: C.card, border: `1px solid ${C.border2}`, borderRadius: T.radius.pill,
                padding: '4px 10px', fontSize: T.text.xs, color: C.muted, cursor: 'pointer',
              }}
            >
              + {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
