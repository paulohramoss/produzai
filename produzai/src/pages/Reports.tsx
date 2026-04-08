import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { Zap, Flame, CheckCircle2, TrendingUp, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { monthlyProgress } from '../data/mockData'

const TABS = ['XP', 'Hábitos', 'Financeiro', 'Investimentos']

const xpHistory = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i],
  xp: Math.round(200 + Math.random() * 600),
  acumulado: 0,
})).map((v, i, arr) => ({ ...v, acumulado: arr.slice(0, i + 1).reduce((s, x) => s + x.xp, 0) }))

const habitMonthly = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i],
  taxa: Math.round(50 + Math.random() * 45),
}))

const financeMonthly = Array.from({ length: 6 }, (_, i) => ({
  month: ['Nov','Dez','Jan','Fev','Mar','Abr'][i],
  entrada: Math.round(7000 + Math.random() * 3000),
  saida: Math.round(2000 + Math.random() * 2500),
}))

const investColors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6']
const investPie = [
  { name: 'Renda Fixa', value: 43 },
  { name: 'Renda Variável', value: 21 },
  { name: 'Criptomoedas', value: 12 },
  { name: 'FIIs', value: 14 },
]

export default function Reports() {
  const { profile, habits, transactions, investments } = useAppStore()
  const [activeTab, setActiveTab] = useState('XP')

  const totalXP = profile.xp
  const habitAvg = Math.round(habits.reduce((s, h) => s + h.completedDays.filter(Boolean).length / 30 * 100, 0) / habits.length)
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const invested = investments.reduce((s, i) => s + i.invested, 0)
  const current = investments.reduce((s, i) => s + i.current, 0)

  function fmt(v: unknown) { return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }

  const topStats = [
    { label: 'XP Total', value: totalXP.toLocaleString(), icon: <Zap size={18} className="text-brand-400" />, color: 'text-brand-400' },
    { label: 'Sequência Atual', value: `${profile.streak} dias`, icon: <Flame size={18} className="text-orange-400" />, color: 'text-orange-400' },
    { label: 'Taxa de Hábitos', value: `${habitAvg}%`, icon: <CheckCircle2 size={18} className="text-emerald-400" />, color: 'text-emerald-400' },
    { label: 'Rentabilidade', value: `+${(((current - invested) / invested) * 100).toFixed(1)}%`, icon: <TrendingUp size={18} className="text-purple-400" />, color: 'text-purple-400' },
  ]

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-1">Sua evolução em números</p>
        </div>
        <button className="btn-ghost"><RefreshCw size={16} /> Atualizar</button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-4">
        {topStats.map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center flex-shrink-0">{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-surface-card p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'XP' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="font-semibold text-white mb-4">XP por Mês</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={xpHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="xp" fill="#6366f1" radius={[4, 4, 0, 0]} name="XP" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <p className="font-semibold text-white mb-4">XP Acumulado</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={xpHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="acumulado" stroke="#6366f1" fill="url(#xpGrad)" strokeWidth={2} name="XP Acumulado" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'Hábitos' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="font-semibold text-white mb-4">Taxa Mensal de Hábitos</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={habitMonthly} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip formatter={(v: unknown) => `${v}%`} contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="taxa" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="Taxa %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <p className="font-semibold text-white mb-4">Consistência — Abril</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyProgress} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="habGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="real" stroke="#10b981" fill="url(#habGrad)" strokeWidth={2} name="Real" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'Financeiro' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="font-semibold text-white mb-4">Entradas vs Saídas (6 meses)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={financeMonthly} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="entrada" fill="#10b981" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="saida" fill="#ef4444" radius={[4, 4, 0, 0]} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5 flex flex-col justify-between">
            <p className="font-semibold text-white mb-4">Resumo do Mês</p>
            <div className="space-y-4">
              {[
                { label: 'Receita total', value: fmt(income), color: 'text-emerald-400' },
                { label: 'Despesas totais', value: fmt(expense), color: 'text-red-400' },
                { label: 'Saldo líquido', value: fmt(income - expense), color: income >= expense ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Taxa de poupança', value: `${Math.round(((income - expense) / income) * 100)}%`, color: 'text-brand-400' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center py-2 border-b border-surface-border last:border-0">
                  <span className="text-sm text-gray-400">{s.label}</span>
                  <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Investimentos' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="font-semibold text-white mb-4">Distribuição da Carteira</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={investPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {investPie.map((_, i) => <Cell key={i} fill={investColors[i]} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => `${v}%`} contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {investPie.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: investColors[i] }} />
                  <span className="text-xs text-gray-400 truncate">{p.name}</span>
                  <span className="text-xs text-white ml-auto">{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5 flex flex-col justify-between">
            <p className="font-semibold text-white mb-4">Performance da Carteira</p>
            <div className="space-y-4">
              {[
                { label: 'Total investido', value: fmt(invested), color: 'text-white' },
                { label: 'Valor atual', value: fmt(current), color: 'text-white' },
                { label: 'Lucro total', value: fmt(current - invested), color: 'text-emerald-400' },
                { label: 'Rentabilidade', value: `+${(((current - invested) / invested) * 100).toFixed(2)}%`, color: 'text-emerald-400' },
                { label: 'Número de ativos', value: `${investments.length}`, color: 'text-brand-400' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center py-2 border-b border-surface-border last:border-0">
                  <span className="text-sm text-gray-400">{s.label}</span>
                  <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
