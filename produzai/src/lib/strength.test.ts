import { describe, it, expect } from 'vitest'
import type { ManualWorkout } from '../store/useWorkoutStore'
import {
  exerciseKey, setVolume, exerciseVolume, workoutVolume, workoutSetCount,
  workoutRepCount, hasStrengthData, estimate1RM, best1RM, MAX_REPS_FOR_1RM,
  computeExerciseRecords, exerciseProgression, knownExercises, lastSessionOf,
  type Exercise, type WorkoutSet,
} from './strength'

// Treino mínimo: só rawDate e exercises importam para as funções de força.
let seq = 0
function workout(rawDate: string, exercises?: Exercise[]): ManualWorkout {
  return {
    id: `w${seq++}`,
    type: 'Academia', name: 'Treino', rawDate, date: rawDate,
    dist: 0, pace: '', time: '60min', cal: 0, hr: 0, elev: 0,
    ...(exercises ? { exercises } : {}),
  }
}

const ex = (name: string, sets: WorkoutSet[]): Exercise => ({ name, sets })
const set = (reps: number, weightKg: number): WorkoutSet => ({ reps, weightKg })

describe('exerciseKey', () => {
  it('normaliza caixa, espaços nas pontas e espaços repetidos', () => {
    expect(exerciseKey('  Agachamento   Livre ')).toBe('agachamento livre')
  })

  it('remove acentos para casar grafias com e sem acento', () => {
    expect(exerciseKey('Panturrilha em Pé')).toBe('panturrilha em pe')
    expect(exerciseKey('Tríceps Testa')).toBe(exerciseKey('triceps testa'))
  })

  it('trata "Supino Reto" e "supino  reto" como o mesmo exercício', () => {
    expect(exerciseKey('Supino Reto')).toBe(exerciseKey('supino  reto'))
  })

  it('devolve string vazia para nome só de espaços', () => {
    expect(exerciseKey('   ')).toBe('')
    expect(exerciseKey('')).toBe('')
  })
})

describe('volume', () => {
  it('setVolume multiplica repetições por carga', () => {
    expect(setVolume(set(10, 60))).toBe(600)
  })

  it('série de peso corporal (0 kg) não soma tonelagem', () => {
    expect(setVolume(set(15, 0))).toBe(0)
    expect(exerciseVolume(ex('Barra fixa', [set(10, 0), set(8, 0)]))).toBe(0)
  })

  it('exercício sem séries tem volume 0', () => {
    expect(exerciseVolume(ex('Supino', []))).toBe(0)
  })

  it('workoutVolume soma todos os exercícios', () => {
    const w = workout('2026-03-02', [
      ex('Supino', [set(10, 60), set(8, 70)]),
      ex('Remada', [set(12, 40)]),
    ])
    expect(workoutVolume(w)).toBe(600 + 560 + 480)
  })

  it('workoutVolume devolve 0 quando exercises é undefined', () => {
    expect(workoutVolume({})).toBe(0)
    expect(workoutVolume({ exercises: undefined })).toBe(0)
  })

  it('workoutVolume devolve 0 para lista vazia de exercícios', () => {
    expect(workoutVolume({ exercises: [] })).toBe(0)
  })

  it('workoutSetCount e workoutRepCount contam sem olhar a carga', () => {
    const w = workout('2026-03-02', [
      ex('Supino', [set(10, 60), set(8, 70)]),
      ex('Barra fixa', [set(6, 0)]),
    ])
    expect(workoutSetCount(w)).toBe(3)
    expect(workoutRepCount(w)).toBe(24)
  })

  it('contagens devolvem 0 sem exercícios', () => {
    expect(workoutSetCount({})).toBe(0)
    expect(workoutRepCount({})).toBe(0)
  })
})

describe('hasStrengthData', () => {
  it('é falso sem exercícios ou com exercícios sem séries', () => {
    expect(hasStrengthData({})).toBe(false)
    expect(hasStrengthData({ exercises: [] })).toBe(false)
    expect(hasStrengthData({ exercises: [ex('Supino', [])] })).toBe(false)
  })

  it('é verdadeiro assim que um exercício tem ao menos uma série', () => {
    expect(hasStrengthData({ exercises: [ex('Supino', []), ex('Remada', [set(1, 0)])] })).toBe(true)
  })
})

describe('estimate1RM', () => {
  it('aplica Epley e arredonda para inteiro', () => {
    expect(estimate1RM(set(5, 100))).toBe(117)   // 100 × (1 + 5/30) = 116.67
    expect(estimate1RM(set(1, 100))).toBe(103)   // 100 × (1 + 1/30) = 103.33
    expect(estimate1RM(set(7, 82.5))).toBe(102)  // 82.5 × (1 + 7/30) = 101.75
  })

  it('aceita exatamente MAX_REPS_FOR_1RM repetições e recusa uma a mais', () => {
    expect(MAX_REPS_FOR_1RM).toBe(12)
    expect(estimate1RM(set(MAX_REPS_FOR_1RM, 100))).toBe(140)
    expect(estimate1RM(set(MAX_REPS_FOR_1RM + 1, 100))).toBeNull()
  })

  it('recusa peso corporal e carga negativa', () => {
    expect(estimate1RM(set(5, 0))).toBeNull()
    expect(estimate1RM(set(5, -10))).toBeNull()
  })

  it('recusa zero ou menos repetições', () => {
    expect(estimate1RM(set(0, 100))).toBeNull()
    expect(estimate1RM(set(-3, 100))).toBeNull()
  })

  // SUSPEITO: reps NaN escapa das três guardas (NaN <= 0 e NaN > 12 são ambos
  // falsos) e a função devolve NaN em vez de null. Nenhuma outra entrada
  // inválida vaza assim.
  it('devolve NaN — não null — quando reps é NaN', () => {
    expect(estimate1RM({ reps: NaN, weightKg: 100 })).toBeNaN()
  })
})

describe('best1RM', () => {
  it('escolhe o maior 1RM estimado entre as séries', () => {
    // 100×3 = 110 ; 90×8 = 114 ; 120×1 = 124
    expect(best1RM(ex('Supino', [set(3, 100), set(8, 90), set(1, 120)]))).toBe(124)
  })

  it('devolve null quando todas as séries são inválidas para a estimativa', () => {
    expect(best1RM(ex('Barra fixa', [set(10, 0), set(20, 60)]))).toBeNull()
  })

  it('devolve null para exercício sem séries', () => {
    expect(best1RM(ex('Supino', []))).toBeNull()
  })

  it('ignora as séries longas e usa só as válidas', () => {
    expect(best1RM(ex('Supino', [set(20, 200), set(5, 100)]))).toBe(117)
  })
})

describe('computeExerciseRecords', () => {
  it('devolve lista vazia sem treinos', () => {
    expect(computeExerciseRecords([])).toEqual([])
  })

  it('ignora treinos sem exercícios e exercícios sem séries', () => {
    expect(computeExerciseRecords([
      workout('2026-03-01'),
      workout('2026-03-02', [ex('Supino', [])]),
    ])).toEqual([])
  })

  it('ignora exercício cujo nome vira chave vazia', () => {
    expect(computeExerciseRecords([workout('2026-03-01', [ex('   ', [set(5, 100)])])])).toEqual([])
  })

  it('agrega sessões, carga máxima, 1RM e volume do mesmo exercício', () => {
    const recs = computeExerciseRecords([
      workout('2026-03-01', [ex('Supino reto', [set(10, 60), set(8, 70)])]),
      workout('2026-03-08', [ex('supino  reto', [set(5, 80)])]),
    ])
    expect(recs).toHaveLength(1)
    const r = recs[0]
    expect(r.sessions).toBe(2)
    expect(r.lastDate).toBe('2026-03-08')
    expect(r.heaviest).toEqual({ weightKg: 80, reps: 5, date: '2026-03-08' })
    expect(r.best1RM).toEqual({ value: 93, weightKg: 80, reps: 5, date: '2026-03-08' })
    expect(r.bestVolume).toEqual({ value: 1160, date: '2026-03-01' })
  })

  it('mantém a grafia mais recente do nome', () => {
    const recs = computeExerciseRecords([
      workout('2026-03-01', [ex('supino reto', [set(5, 60)])]),
      workout('2026-03-08', [ex('Supino Reto', [set(5, 60)])]),
    ])
    expect(recs[0].name).toBe('Supino Reto')
  })

  it('em empate de carga o recorde fica com a sessão mais antiga', () => {
    const recs = computeExerciseRecords([
      workout('2026-03-08', [ex('Agachamento', [set(3, 100)])]),
      workout('2026-03-01', [ex('Agachamento', [set(5, 100)])]),
    ])
    expect(recs[0].heaviest).toEqual({ weightKg: 100, reps: 5, date: '2026-03-01' })
  })

  it('em empate de volume o recorde também fica com a sessão mais antiga', () => {
    const recs = computeExerciseRecords([
      workout('2026-03-01', [ex('Remada', [set(10, 50)])]),
      workout('2026-03-08', [ex('Remada', [set(10, 50)])]),
    ])
    expect(recs[0].bestVolume).toEqual({ value: 500, date: '2026-03-01' })
  })

  it('best1RM fica null quando só houve séries longas ou peso corporal', () => {
    const recs = computeExerciseRecords([
      workout('2026-03-01', [ex('Barra fixa', [set(15, 0), set(20, 0)])]),
    ])
    expect(recs[0].best1RM).toBeNull()
    expect(recs[0].heaviest).toEqual({ weightKg: 0, reps: 15, date: '2026-03-01' })
  })

  it('best1RM aparece na primeira sessão que teve série estimável', () => {
    const recs = computeExerciseRecords([
      workout('2026-03-01', [ex('Supino', [set(20, 40)])]),
      workout('2026-03-08', [ex('Supino', [set(5, 60)])]),
    ])
    expect(recs[0].best1RM).toEqual({ value: 70, weightKg: 60, reps: 5, date: '2026-03-08' })
  })

  it('ordena por número de sessões e desempata pela data mais recente', () => {
    const recs = computeExerciseRecords([
      workout('2026-03-01', [ex('Supino', [set(5, 60)]), ex('Remada', [set(5, 40)])]),
      workout('2026-03-08', [ex('Supino', [set(5, 60)])]),
      workout('2026-03-09', [ex('Rosca', [set(5, 20)])]),
    ])
    expect(recs.map(r => r.name)).toEqual(['Supino', 'Rosca', 'Remada'])
  })
})

describe('exerciseProgression', () => {
  it('devolve lista vazia sem treinos', () => {
    expect(exerciseProgression([], 'Supino')).toEqual([])
  })

  it('devolve lista vazia para exercício nunca treinado', () => {
    expect(exerciseProgression([workout('2026-03-01', [ex('Supino', [set(5, 60)])])], 'Agachamento'))
      .toEqual([])
  })

  it('ordena da sessão mais antiga para a mais recente e rotula como dd/mm', () => {
    const points = exerciseProgression([
      workout('2026-03-08', [ex('Supino', [set(5, 80)])]),
      workout('2026-03-01', [ex('supino', [set(10, 60), set(8, 70)])]),
    ], 'SUPINO')
    expect(points).toEqual([
      { date: '2026-03-01', label: '01/03', est1RM: 89, topWeight: 70, volume: 1160 },
      { date: '2026-03-08', label: '08/03', est1RM: 93, topWeight: 80, volume: 400 },
    ])
  })

  it('est1RM do ponto fica null quando a sessão não tem série estimável', () => {
    const points = exerciseProgression(
      [workout('2026-03-01', [ex('Barra fixa', [set(12, 0)])])], 'Barra fixa',
    )
    expect(points[0].est1RM).toBeNull()
    expect(points[0].topWeight).toBe(0)
  })

  it('ignora sessões em que o exercício aparece sem séries', () => {
    const points = exerciseProgression([
      workout('2026-03-01', [ex('Supino', [])]),
      workout('2026-03-08', [ex('Supino', [set(5, 60)])]),
    ], 'Supino')
    expect(points.map(p => p.date)).toEqual(['2026-03-08'])
  })

  it('mantém só os últimos `limit` pontos', () => {
    const ws = ['2026-03-01', '2026-03-02', '2026-03-03']
      .map(d => workout(d, [ex('Supino', [set(5, 60)])]))
    expect(exerciseProgression(ws, 'Supino', 2).map(p => p.date))
      .toEqual(['2026-03-02', '2026-03-03'])
  })

  // SUSPEITO: `points.slice(-limit)` com limit 0 vira `slice(-0)` === `slice(0)`
  // e devolve TUDO em vez de nada — o oposto do que o parâmetro pede.
  it('com limit 0 devolve todos os pontos, não nenhum', () => {
    const ws = ['2026-03-01', '2026-03-02'].map(d => workout(d, [ex('Supino', [set(5, 60)])]))
    expect(exerciseProgression(ws, 'Supino', 0)).toHaveLength(2)
  })
})

describe('knownExercises', () => {
  it('devolve lista vazia sem treinos', () => {
    expect(knownExercises([])).toEqual([])
  })

  it('lista do mais recente para o mais antigo, sem repetir', () => {
    expect(knownExercises([
      workout('2026-03-01', [ex('Supino', [set(5, 60)]), ex('Remada', [set(5, 40)])]),
      workout('2026-03-08', [ex('Agachamento', [set(5, 100)]), ex('supino', [set(5, 60)])]),
    ])).toEqual(['Agachamento', 'supino', 'Remada'])
  })

  // SUSPEITO: knownExercises inclui exercício sem nenhuma série, ao contrário de
  // computeExerciseRecords e lastSessionOf, que exigem série. Um exercício
  // criado e esvaziado continua sendo sugerido no autocompletar.
  it('inclui exercício sem séries', () => {
    expect(knownExercises([workout('2026-03-01', [ex('Supino', [])])])).toEqual(['Supino'])
  })

  it('respeita o limite', () => {
    const w = workout('2026-03-01', [ex('A', [set(1, 1)]), ex('B', [set(1, 1)]), ex('C', [set(1, 1)])])
    expect(knownExercises([w], 2)).toEqual(['A', 'B'])
  })
})

describe('lastSessionOf', () => {
  it('devolve null sem treinos e para exercício desconhecido', () => {
    expect(lastSessionOf([], 'Supino')).toBeNull()
    expect(lastSessionOf([workout('2026-03-01', [ex('Supino', [set(5, 60)])])], 'Remada')).toBeNull()
  })

  it('devolve a sessão mais recente do exercício, casando sem acento e sem caixa', () => {
    const found = lastSessionOf([
      workout('2026-03-01', [ex('Tríceps Testa', [set(10, 20)])]),
      workout('2026-03-08', [ex('triceps testa', [set(8, 25)])]),
    ], 'TRICEPS  TESTA')
    expect(found).toEqual(ex('triceps testa', [set(8, 25)]))
  })

  it('pula sessões em que o exercício ficou sem séries', () => {
    const found = lastSessionOf([
      workout('2026-03-01', [ex('Supino', [set(5, 60)])]),
      workout('2026-03-08', [ex('Supino', [])]),
    ], 'Supino')
    expect(found).toEqual(ex('Supino', [set(5, 60)]))
  })
})
