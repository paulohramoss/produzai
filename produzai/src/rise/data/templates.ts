export interface WorkoutTemplate {
  name: string
  type: string
  durationMin: number
  dist: number
  cal: number
  label: string
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  { name: 'Corrida leve 5km', type: 'Corrida', durationMin: 30, dist: 5, cal: 300, label: 'Ritmo suave, Z2' },
  { name: 'Corrida intervalada', type: 'Corrida', durationMin: 40, dist: 8, cal: 480, label: '4×800m + recuperação' },
  { name: 'Treino Push (Peito/Tri)', type: 'Academia', durationMin: 60, dist: 0, cal: 380, label: 'Supino, Crucifixo, Tríceps' },
  { name: 'Treino Pull (Costas/Bí)', type: 'Academia', durationMin: 60, dist: 0, cal: 360, label: 'Puxada, Remada, Rosca' },
  { name: 'Treino Legs (Pernas)', type: 'Academia', durationMin: 65, dist: 0, cal: 430, label: 'Squat, Leg press, Extensora' },
  { name: 'Full Body', type: 'Academia', durationMin: 70, dist: 0, cal: 400, label: 'Corpo inteiro, 3x semana' },
  { name: 'Pedal moderado', type: 'Ciclismo', durationMin: 45, dist: 20, cal: 400, label: 'Terreno plano' },
  { name: 'Caminhada rápida', type: 'Caminhada', durationMin: 35, dist: 4, cal: 180, label: 'Passo acelerado' },
  { name: 'Natação contínua', type: 'Natação', durationMin: 45, dist: 1.5, cal: 420, label: '1500m nado livre' },
  { name: 'Futebol recreativo', type: 'Futebol', durationMin: 60, dist: 6, cal: 500, label: 'Jogo amistoso' },
]

export interface DietTemplate {
  name: string
  goal: string
  goals: { cal: number; prot: number; carb: number; fat: number }
  meals: Array<{ name: string; time: string; cal: number; prot: number; carb: number; fat: number }>
}

export const DIET_TEMPLATES: DietTemplate[] = [
  {
    name: 'Bulking Limpo',
    goal: 'Ganhar massa com superávit controlado',
    goals: { cal: 3200, prot: 200, carb: 380, fat: 90 },
    meals: [
      { name: 'Café da manhã', time: '07:00', cal: 700, prot: 45, carb: 80, fat: 20 },
      { name: 'Lanche manhã', time: '10:00', cal: 400, prot: 30, carb: 40, fat: 15 },
      { name: 'Almoço', time: '13:00', cal: 900, prot: 60, carb: 110, fat: 25 },
      { name: 'Pré-treino', time: '16:30', cal: 350, prot: 25, carb: 60, fat: 8 },
      { name: 'Pós-treino', time: '19:00', cal: 450, prot: 40, carb: 55, fat: 10 },
      { name: 'Ceia', time: '21:30', cal: 400, prot: 30, carb: 35, fat: 12 },
    ],
  },
  {
    name: 'Cutting',
    goal: 'Perder gordura preservando músculo',
    goals: { cal: 2000, prot: 180, carb: 160, fat: 65 },
    meals: [
      { name: 'Café da manhã', time: '07:00', cal: 400, prot: 40, carb: 35, fat: 15 },
      { name: 'Lanche manhã', time: '10:30', cal: 200, prot: 25, carb: 15, fat: 8 },
      { name: 'Almoço', time: '13:00', cal: 550, prot: 55, carb: 50, fat: 18 },
      { name: 'Pré-treino', time: '17:00', cal: 200, prot: 25, carb: 30, fat: 5 },
      { name: 'Jantar', time: '20:00', cal: 450, prot: 45, carb: 30, fat: 19 },
    ],
  },
  {
    name: 'Manutenção',
    goal: 'Manter peso e composição atual',
    goals: { cal: 2600, prot: 160, carb: 280, fat: 80 },
    meals: [
      { name: 'Café da manhã', time: '07:00', cal: 600, prot: 40, carb: 65, fat: 20 },
      { name: 'Lanche manhã', time: '10:30', cal: 300, prot: 20, carb: 35, fat: 10 },
      { name: 'Almoço', time: '13:00', cal: 750, prot: 55, carb: 80, fat: 25 },
      { name: 'Jantar', time: '20:00', cal: 650, prot: 45, carb: 70, fat: 25 },
    ],
  },
  {
    name: 'Low Carb',
    goal: 'Redução de carboidratos para emagrecimento',
    goals: { cal: 1800, prot: 150, carb: 80, fat: 110 },
    meals: [
      { name: 'Café da manhã', time: '08:00', cal: 450, prot: 35, carb: 10, fat: 35 },
      { name: 'Almoço', time: '13:00', cal: 650, prot: 55, carb: 30, fat: 40 },
      { name: 'Lanche', time: '16:00', cal: 200, prot: 20, carb: 10, fat: 15 },
      { name: 'Jantar', time: '20:00', cal: 500, prot: 40, carb: 30, fat: 20 },
    ],
  },
]
