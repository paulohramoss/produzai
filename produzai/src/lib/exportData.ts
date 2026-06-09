import type { ManualWorkout } from '../store/useWorkoutStore'
import type { WebDietData } from '../store/useWebDietStore'

function download(content: string, filename: string) {
  const bom = '﻿'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function today() { return new Date().toISOString().slice(0, 10) }

export function exportWorkoutsCSV(workouts: ManualWorkout[]) {
  const rows = [
    'Data,Nome,Tipo,Duração,Distância (km),Calorias,FC média (bpm)',
    ...workouts.map(w =>
      [w.rawDate, `"${w.name}"`, w.type, w.time, w.dist || '', w.cal || '', w.hr || ''].join(',')
    ),
  ]
  download(rows.join('\n'), `treinos_${today()}.csv`)
}

export function exportDietCSV(wd: WebDietData) {
  const sorted = [...wd.meals].sort((a, b) => a.time.localeCompare(b.time))
  const rows = [
    'Refeição,Horário,Calorias,Proteína (g),Carbs (g),Gordura (g)',
    ...sorted.map(m => [`"${m.name}"`, m.time, m.cal, m.prot, m.carb, m.fat].join(',')),
    '',
    'Metas,Calorias,Proteína (g),Carbs (g),Gordura (g)',
    `Objetivo,${wd.goals.cal},${wd.goals.prot},${wd.goals.carb},${wd.goals.fat}`,
  ]
  download(rows.join('\n'), `dieta_${today()}.csv`)
}

export function exportAllCSV(workouts: ManualWorkout[], wd: WebDietData | null) {
  const lines: string[] = []

  lines.push('=== TREINOS ===')
  lines.push('Data,Nome,Tipo,Duração,Distância (km),Calorias,FC média (bpm)')
  workouts.forEach(w =>
    lines.push([w.rawDate, `"${w.name}"`, w.type, w.time, w.dist || '', w.cal || '', w.hr || ''].join(','))
  )

  lines.push('')
  lines.push('=== DIETA ===')
  if (wd) {
    const sorted = [...wd.meals].sort((a, b) => a.time.localeCompare(b.time))
    lines.push('Refeição,Horário,Calorias,Proteína (g),Carbs (g),Gordura (g)')
    sorted.forEach(m => lines.push([`"${m.name}"`, m.time, m.cal, m.prot, m.carb, m.fat].join(',')))
    lines.push('')
    lines.push(`Meta calórica,${wd.goals.cal}`)
    lines.push(`Meta proteína,${wd.goals.prot}g`)
  } else {
    lines.push('Não configurada')
  }

  download(lines.join('\n'), `riseplan_${today()}.csv`)
}
