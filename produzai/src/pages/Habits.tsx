import { useState } from 'react'
import { Plus, Flame, Zap, Trophy, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { ranking } from '../data/mockData'
import ProgressBar from '../components/ui/ProgressBar'

const DAYS = 30
const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D', 'S', 'T', 'Q', 'Q', 'S', 'S', 'D', 'S', 'T', 'Q', 'Q', 'S', 'S', 'D', 'S', 'T', 'Q', 'Q', 'S', 'S', 'D', 'S', 'T']

export default function Habits() {
  const { habits, toggleHabit, profile } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newHabit, setNewHabit] = useState({ name: '', icon: '✅' })

  const totalXP = habits.reduce((s, h) => s + h.xp, 0)
  const avgRate = Math.round(habits.reduce((s, h) => {
    const done = h.completedDays.filter(Boolean).length
    return s + done / DAYS * 100
  }, 0) / habits.length)

  const today = new Date().getDate() - 1

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Hábitos</h1>
          <p className="text-sm text-gray-500 mt-1">Consistência diária que gera resultados reais</p>
        </div>
        <button className="btn-primary self-start md:self-auto" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Novo Hábito
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'XP de Hábitos', value: totalXP.toLocaleString(), icon: <Zap size={16} />, color: 'text-brand-400' },
          { label: 'Taxa Média', value: `${avgRate}%`, icon: <Trophy size={16} />, color: 'text-emerald-400' },
          { label: 'Melhor Sequência', value: `${Math.max(...habits.map(h => h.streak))} dias`, icon: <Flame size={16} />, color: 'text-orange-400' },
          { label: 'Hábitos Ativos', value: `${habits.length}`, icon: null, color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Habit grid - 2 cols */}
        <div className="col-span-1 md:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="font-semibold text-white">Grade de Hábitos — Abril</p>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-600 inline-block" /> Feito</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-surface-border inline-block" /> Não feito</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-surface-raised border border-dashed border-surface-border inline-block" /> Futuro</span>
            </div>
          </div>

          {/* Day header + rows — scrollable on mobile */}
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="flex mb-2">
                <div className="w-40 shrink-0" />
                <div className="flex gap-0.5 flex-1">
                  {dayLabels.map((d, i) => (
                    <div key={i} className={`flex-1 text-center text-[9px] font-medium ${i === today ? 'text-brand-400' : 'text-gray-600'}`}>{d}</div>
                  ))}
                </div>
                <div className="w-16 shrink-0 text-right text-xs text-gray-500 pr-2">%</div>
              </div>

              {/* Habit rows */}
              <div className="space-y-1.5">
                {habits.map(h => {
                  const rate = Math.round(h.completedDays.filter(Boolean).length / DAYS * 100)
                  return (
                    <div key={h.id} className="flex items-center gap-0 hover:bg-surface-hover rounded-lg py-1 px-0 transition-colors group">
                      <div className="w-40 shrink-0 flex items-center gap-2 pl-2">
                        <span className="text-sm">{h.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{h.name}</p>
                          <p className="text-xs text-orange-400">{h.streak}🔥</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 flex-1">
                        {h.completedDays.map((done, i) => (
                          <button
                            key={i}
                            onClick={() => i <= today && toggleHabit(h.id, i)}
                            className={`flex-1 h-5 rounded-sm transition-all ${
                              i > today ? 'bg-surface-raised border border-dashed border-surface-border cursor-default' :
                              done ? 'bg-brand-600 hover:bg-brand-500' : 'bg-surface-border hover:bg-surface-hover'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="w-16 shrink-0 text-right pr-2">
                        <span className={`text-xs font-semibold ${rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{rate}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Ranking */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-white">Ranking Global</p>
            <span className="badge bg-brand-600/20 text-brand-400">#{profile.rank}</span>
          </div>
          <div className="space-y-3">
            {ranking.map(r => (
              <div key={r.rank} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${r.isMe ? 'bg-brand-600/10 border border-brand-600/20' : ''}`}>
                <span className={`text-xs font-bold w-5 text-center ${r.rank <= 3 ? ['text-yellow-400', 'text-gray-400', 'text-orange-500'][r.rank - 1] : 'text-gray-600'}`}>
                  {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${r.isMe ? 'bg-brand-600 text-white' : 'bg-surface-border text-gray-400'}`}>
                  {r.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs font-medium truncate ${r.isMe ? 'text-brand-300' : 'text-gray-300'}`}>{r.name}</p>
                    <span className="text-xs text-orange-400 ml-1">{r.streak}🔥</span>
                  </div>
                  <ProgressBar value={r.xp} max={10000} color={r.isMe ? 'bg-brand-500' : 'bg-surface-border'} />
                  <p className="text-xs text-gray-600 mt-0.5">{r.xp.toLocaleString()} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add habit modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="card-raised p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-white">Novo Hábito</p>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input className="input-field w-16 text-center text-xl" value={newHabit.icon} onChange={e => setNewHabit(p => ({ ...p, icon: e.target.value }))} maxLength={2} />
                <input className="input-field flex-1" placeholder="Nome do hábito" value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))} />
              </div>
              <button
                className="btn-primary w-full justify-center"
                onClick={() => { alert('Hábito adicionado! (demo)'); setShowAdd(false) }}
                disabled={!newHabit.name}
              >
                Criar Hábito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
