import { Flame, Zap, CheckCircle2, CalendarDays, Wallet, Star, ArrowRight } from 'lucide-react'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAppStore } from '../store/useAppStore'
import { monthlyProgress, ranking } from '../data/mockData'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'

const today = new Date()

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const { profile, habits, transactions, goals, events, setPage } = useAppStore()

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  const todayHabits = habits.filter(h => h.completedDays[today.getDate() - 1]).length
  const habitRate = Math.round((todayHabits / habits.length) * 100)

  const upcomingEvents = events.filter(e => !e.done).slice(0, 3)

  const xpToNext = 5000
  const xpPct = (profile.xp % xpToNext) / xpToNext

  const top5 = ranking.slice(0, 5)

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{getGreeting()},</p>
          <h1 className="text-3xl font-bold text-white">{profile.name.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 text-sm mt-1">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="card px-4 py-3 flex items-center gap-3">
            <Flame size={18} className="text-orange-400" />
            <div>
              <p className="text-xs text-gray-500">Sequência</p>
              <p className="font-bold text-white">{profile.streak} dias</p>
            </div>
          </div>
          <div className="card px-4 py-3 flex items-center gap-3">
            <Zap size={18} className="text-brand-400" />
            <div>
              <p className="text-xs text-gray-500">XP Total</p>
              <p className="font-bold text-white">{profile.xp.toLocaleString()}</p>
            </div>
          </div>
          <div className="card px-4 py-3 flex items-center gap-3">
            <Star size={18} className="text-yellow-400" />
            <div>
              <p className="text-xs text-gray-500">Ranking</p>
              <p className="font-bold text-white">#{profile.rank}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Saldo Atual" value={`R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} sub="Entradas − saídas do mês" icon={<Wallet size={16} />} trend="up" trendValue="12%" color="text-emerald-400" />
        <StatCard label="Hábitos Hoje" value={`${todayHabits}/${habits.length}`} sub={`${habitRate}% de conclusão`} icon={<CheckCircle2 size={16} />} trend={habitRate >= 70 ? 'up' : 'down'} trendValue={`${habitRate}%`} />
        <StatCard label="Nível" value={`${profile.level}`} sub={`${(xpPct * 100).toFixed(0)}% para o próximo`} icon={<Zap size={16} />} color="text-brand-400" />
        <StatCard label="Metas Ativas" value={`${goals.length}`} sub="Sonhos em progresso" icon={<Star size={16} />} color="text-yellow-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Progress chart */}
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-white">Consistência do Mês</p>
              <p className="text-xs text-gray-500">Média diária de conclusão de hábitos</p>
            </div>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-500 inline-block" /> Real</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-surface-border inline-block" /> Meta</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={monthlyProgress} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBrand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="meta" stroke="#2a2a42" strokeDasharray="4 2" fill="none" strokeWidth={1.5} />
              <Area type="monotone" dataKey="real" stroke="#6366f1" fill="url(#gradBrand)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* XP Level card */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">Progresso de Nível</p>
            <span className="badge bg-brand-600/20 text-brand-400">Nível {profile.level}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2a2a42" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="2.5"
                  strokeDasharray={`${xpPct * 100} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{profile.level}</span>
                <span className="text-xs text-gray-500">nível</span>
              </div>
            </div>
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{profile.xp.toLocaleString()} XP</span>
                <span>{xpToNext.toLocaleString()} XP</span>
              </div>
              <ProgressBar value={profile.xp % xpToNext} max={xpToNext} color="bg-brand-500" />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Faltam <span className="text-brand-400 font-semibold">{(xpToNext - (profile.xp % xpToNext)).toLocaleString()} XP</span> para o próximo nível
            </p>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Hábitos de hoje */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-white">Hábitos Hoje</p>
            <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1" onClick={() => setPage('habits')}>
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {habits.slice(0, 5).map(h => {
              const done = h.completedDays[today.getDate() - 1]
              return (
                <div key={h.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-border text-gray-600'}`}>
                    {done ? '✓' : '○'}
                  </div>
                  <span className={`text-sm flex-1 ${done ? 'text-gray-400 line-through' : 'text-white'}`}>
                    {h.icon} {h.name}
                  </span>
                  {h.streak > 0 && <span className="text-xs text-orange-400 font-semibold">{h.streak}🔥</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Agenda */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-white">Próximos Eventos</p>
            <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1" onClick={() => setPage('calendar')}>
              Agenda <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map(e => {
              const color = e.type === 'work' ? 'bg-blue-500/20 text-blue-400' :
                e.type === 'health' ? 'bg-emerald-500/20 text-emerald-400' :
                e.type === 'finance' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-purple-500/20 text-purple-400'
              return (
                <div key={e.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${color}`}>
                    <CalendarDays size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{e.title}</p>
                    <p className="text-xs text-gray-500">{new Date(e.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {e.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Ranking */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-white">Top 5 Ranking</p>
            <span className="text-xs text-gray-500">Sua posição: #{profile.rank}</span>
          </div>
          <div className="space-y-3">
            {top5.map(r => (
              <div key={r.rank} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-5 text-center ${r.rank === 1 ? 'text-yellow-400' : r.rank === 2 ? 'text-gray-400' : r.rank === 3 ? 'text-orange-500' : 'text-gray-600'}`}>
                  #{r.rank}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${r.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-brand-700/40 text-brand-300'}`}>
                  {r.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{r.name}</p>
                  <ProgressBar value={r.xp} max={10000} color={r.rank === 1 ? 'bg-yellow-500' : 'bg-brand-600'} />
                </div>
                <span className="text-xs text-gray-500">{(r.xp / 1000).toFixed(1)}k</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
