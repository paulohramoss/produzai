import { useState } from 'react'
import { Plus, Target, Calendar, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import ProgressBar from '../components/ui/ProgressBar'

const CATEGORY_COLORS: Record<string, string> = {
  Patrimônio: 'bg-brand-600/20 text-brand-400',
  Finanças: 'bg-emerald-600/20 text-emerald-400',
  Experiências: 'bg-orange-600/20 text-orange-400',
  Saúde: 'bg-red-600/20 text-red-400',
  Carreira: 'bg-blue-600/20 text-blue-400',
}

const GOAL_EMOJIS = ['🏠', '🚗', '✈️', '💰', '📚', '💪', '🌍', '🎯', '💍', '🏝️']

export default function Goals() {
  const { goals } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)

  const totalGoalAmount = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0)
  const overallPct = Math.round((totalSaved / totalGoalAmount) * 100)

  function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }

  function daysLeft(deadline: string) {
    const diff = new Date(deadline).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  function monthlyNeeded(goal: typeof goals[0]) {
    const days = daysLeft(goal.deadline)
    const months = Math.ceil(days / 30)
    const remaining = goal.targetAmount - goal.currentAmount
    return remaining / months
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Sonhos & Metas</h1>
          <p className="text-sm text-gray-500 mt-1">Transforme desejos em planos concretos</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Nova Meta</button>
      </div>

      {/* Overview */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-white">Progresso Geral</p>
            <p className="text-sm text-gray-500">{goals.length} metas em andamento</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-400">{overallPct}%</p>
            <p className="text-xs text-gray-500">{fmt(totalSaved)} / {fmt(totalGoalAmount)}</p>
          </div>
        </div>
        <ProgressBar value={totalSaved} max={totalGoalAmount} color="bg-brand-500" showLabel={false} />
      </div>

      {/* Goals grid */}
      <div className="grid grid-cols-2 gap-4">
        {goals.map((g, idx) => {
          const pct = Math.round((g.currentAmount / g.targetAmount) * 100)
          const dl = daysLeft(g.deadline)
          const monthly = monthlyNeeded(g)
          const emoji = GOAL_EMOJIS[idx % GOAL_EMOJIS.length]

          return (
            <div key={g.id} className="card p-5 hover:border-brand-600/30 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-raised border border-surface-border flex items-center justify-center text-2xl">
                    {emoji}
                  </div>
                  <div>
                    <p className="font-bold text-white">{g.title}</p>
                    <p className="text-xs text-gray-500">{g.description}</p>
                  </div>
                </div>
                <span className={`badge text-xs px-2.5 py-1 rounded-full ${CATEGORY_COLORS[g.category] || 'bg-gray-500/20 text-gray-400'}`}>
                  {g.category}
                </span>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">Progresso</span>
                  <span className="text-sm font-bold text-white">{pct}%</span>
                </div>
                <div className="h-2 bg-surface-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 75 ? '#10b981' : pct >= 50 ? '#6366f1' : pct >= 25 ? '#f59e0b' : '#ef4444'
                    }}
                  />
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface-raised rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Guardado</p>
                  <p className="text-sm font-bold text-emerald-400">{fmt(g.currentAmount)}</p>
                </div>
                <div className="bg-surface-raised rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Meta</p>
                  <p className="text-sm font-bold text-white">{fmt(g.targetAmount)}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar size={12} />
                  <span>{dl > 0 ? `${dl} dias restantes` : 'Prazo vencido'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-brand-400">
                  <Target size={12} />
                  <span>{fmt(monthly)}/mês</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="card-raised p-6 w-[420px] space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Nova Meta</p>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <input className="input-field" placeholder="Título da meta" />
            <input className="input-field" placeholder="Descrição" />
            <div className="grid grid-cols-2 gap-3">
              <input className="input-field" placeholder="Valor alvo (R$)" type="number" />
              <input className="input-field" placeholder="Já guardei (R$)" type="number" />
            </div>
            <input className="input-field" type="date" />
            <select className="input-field">
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn-primary w-full justify-center" onClick={() => { alert('Meta criada! (demo)'); setShowAdd(false) }}>
              Criar Meta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
