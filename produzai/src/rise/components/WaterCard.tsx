// Hidratação — o mesmo card no Hoje e na Dieta.
//
// Beber água é um gesto de dez em dez minutos, não uma decisão de nutrição: ele
// pertence ao check-in do dia. O componente é único para que os dois lugares
// leiam e gravem exatamente o mesmo `waterMl` do dia, sem estados paralelos.

import { useState, useEffect } from 'react'
import { Droplet } from 'lucide-react'
import { T, C, displayStyle } from '../data'
import { Card, Bar } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import { getDaily, saveDaily } from '../../lib/db'
import { todayKey as localTodayKey } from '../../lib/date'
import { WATER_STEP_ML, formatLiters } from '../../lib/hydration'

interface Props {
  /** Avisa a página a cada mudança — usado pelo resumo do topo do Hoje. */
  onChange?: (ml: number) => void
}

export function WaterCard({ onChange }: Props) {
  const user         = useAuthStore(s => s.user)
  const waterGoalMl  = useWebDietStore(s => s.waterGoalMl)
  const setWaterGoal = useWebDietStore(s => s.setWaterGoal)

  const todayKey = localTodayKey()

  const [waterMl, setWaterMl]         = useState(0)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput]     = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!user) return
      const daily = await getDaily(todayKey)
      if (!active) return
      const ml = daily?.waterMl ?? 0
      setWaterMl(ml)
      onChange?.(ml)
    }
    load()
    return () => { active = false }
    // `onChange` costuma ser uma função nova a cada render da página; incluí-la
    // aqui recarregaria o dia em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, todayKey])

  function addWater(deltaMl: number) {
    const next = Math.max(0, waterMl + deltaMl)
    setWaterMl(next)
    onChange?.(next)
    saveDaily(todayKey, { waterMl: next })
  }

  function handleEditGoal() {
    setGoalInput(formatLiters(waterGoalMl))
    setEditingGoal(true)
  }

  function handleSaveGoal() {
    const liters = Number(goalInput.replace(',', '.'))
    if (liters > 0) setWaterGoal(Math.round(liters * 1000))
    setEditingGoal(false)
  }

  const pct = waterGoalMl > 0 ? Math.round(waterMl / waterGoalMl * 100) : 0
  const done = pct >= 100

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.xl, marginBottom: 10, ...displayStyle }}>
        <Droplet size={17} color={C.blue} /> Hidratação
      </div>

      <div style={{ textAlign: 'center', margin: '8px 0' }}>
        <div style={{ fontSize: 28, fontWeight: T.weight.extrabold, color: done ? C.green : C.blue }}>
          {formatLiters(waterMl)}L
        </div>
        {editingGoal ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: T.text.base, color: C.muted }}>meta:</span>
            <input
              type="number"
              step="0.1"
              min="0.5"
              autoFocus
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
              style={{ width: 56, background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '3px 6px', color: C.text, fontSize: T.text.base, outline: 'none' }}
            />
            <span style={{ fontSize: T.text.base, color: C.muted }}>L</span>
            <button
              onClick={handleSaveGoal}
              style={{ background: `${C.green}18`, border: `1px solid ${C.green}44`, borderRadius: T.radius.xs, padding: '3px 8px', color: C.green, fontSize: T.text.base, fontWeight: T.weight.bold, cursor: 'pointer' }}>
              ✓
            </button>
            <button
              onClick={() => setEditingGoal(false)}
              style={{ background: 'transparent', border: `1px solid ${C.border2}`, borderRadius: T.radius.xs, padding: '3px 8px', color: C.muted, fontSize: T.text.base, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        ) : (
          <div
            onClick={handleEditGoal}
            title="Clique para ajustar a meta"
            style={{ fontSize: T.text.base, color: C.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            de {formatLiters(waterGoalMl)}L · {pct}%
            <span style={{ fontSize: T.text.xs }}>✏️</span>
          </div>
        )}
      </div>

      <Bar pct={pct} color={done ? C.green : C.blue} h={8} />

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button
          onClick={() => addWater(WATER_STEP_ML)}
          style={{ flex: 1, background: `${C.blue}18`, border: `1px solid ${C.blue}44`, borderRadius: T.radius.sm, padding: '7px', color: C.blue, fontSize: T.text.base, fontWeight: T.weight.bold, cursor: 'pointer' }}>
          + 250ml
        </button>
        <button
          onClick={() => addWater(500)}
          style={{ flex: 1, background: `${C.blue}18`, border: `1px solid ${C.blue}44`, borderRadius: T.radius.sm, padding: '7px', color: C.blue, fontSize: T.text.base, fontWeight: T.weight.bold, cursor: 'pointer' }}>
          + 500ml
        </button>
        <button
          onClick={() => addWater(-WATER_STEP_ML)}
          disabled={waterMl === 0}
          style={{ background: 'transparent', border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: '7px 10px', color: waterMl === 0 ? C.border2 : C.muted, fontSize: T.text.base, fontWeight: T.weight.bold, cursor: waterMl === 0 ? 'default' : 'pointer' }}>
          −
        </button>
      </div>
    </Card>
  )
}
