import { useState } from 'react'
import { Plus, TrendingDown, TrendingUp, CreditCard, X, AlertCircle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useAppStore } from '../store/useAppStore'
import ProgressBar from '../components/ui/ProgressBar'

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: '#f59e0b', Assinaturas: '#8b5cf6', Transporte: '#3b82f6',
  Saúde: '#10b981', Moradia: '#6366f1', Educação: '#ec4899', Renda: '#10b981',
}

const cards = [
  { name: 'Nubank',  color: 'from-purple-700 to-purple-900', limit: 5000, used: 890.2 },
  { name: 'C6 Bank', color: 'from-gray-700 to-gray-900',     limit: 3000, used: 376.9 },
  { name: 'Itaú',    color: 'from-orange-600 to-orange-900', limit: 4000, used: 163.7 },
]

const bills = [
  { name: 'Spotify',   value: 29.9,  date: '10 abr', card: 'Nubank' },
  { name: 'Netflix',   value: 49.9,  date: '12 abr', card: 'C6 Bank' },
  { name: 'Academia',  value: 99.9,  date: '15 abr', card: 'Itaú' },
  { name: 'Internet',  value: 119.9, date: '20 abr', card: 'C6 Bank' },
]

export default function Finance() {
  const { transactions, addTransaction } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<{ description: string; amount: string; category: string; type: 'income' | 'expense'; card: string }>({ description: '', amount: '', category: 'Alimentação', type: 'expense', card: 'Nubank' })

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense
  const budget = 4000
  const budgetUsed = Math.round((expense / budget) * 100)

  // Category pie
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {})
  const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }))

  // Daily bar chart
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const ds = d.toISOString().split('T')[0]
    return {
      day: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      gasto: transactions.filter(t => t.type === 'expense' && t.date === ds).reduce((s, t) => s + t.amount, 0),
    }
  })

  function fmt(v: unknown) { return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="text-sm text-gray-500 mt-1">Controle total do seu dinheiro</p>
        </div>
        <button className="btn-primary self-start md:self-auto" onClick={() => setShowAdd(true)}><Plus size={16} /> Novo Lançamento</button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Entradas', value: fmt(income), icon: <TrendingUp size={16} />, color: 'text-emerald-400' },
          { label: 'Saídas', value: fmt(expense), icon: <TrendingDown size={16} />, color: 'text-red-400' },
          { label: 'Saldo', value: fmt(balance), icon: null, color: balance >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Orçamento', value: `${budgetUsed}%`, icon: <AlertCircle size={16} />, color: budgetUsed > 80 ? 'text-red-400' : 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
              {s.icon && <span className="text-gray-600">{s.icon}</span>}
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            {s.label === 'Orçamento' && (
              <ProgressBar value={expense} max={budget} color={budgetUsed > 80 ? 'bg-red-500' : 'bg-yellow-500'} className="mt-2" showLabel={false} />
            )}
          </div>
        ))}
      </div>

      {/* Charts + cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pie */}
        <div className="card p-5">
          <p className="font-semibold text-white mb-4">Gastos por Categoria</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {pieData.map((e, i) => <Cell key={i} fill={CATEGORY_COLORS[e.name] || '#6366f1'} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.slice(0, 4).map(e => (
              <div key={e.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[e.name] || '#6366f1' }} />
                  <span className="text-xs text-gray-400">{e.name}</span>
                </div>
                <span className="text-xs text-white font-medium">{fmt(e.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart últimos 7 dias */}
        <div className="card p-5">
          <p className="font-semibold text-white mb-4">Gastos — Últimos 7 dias</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="gasto" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Faturas */}
        <div className="card p-5">
          <p className="font-semibold text-white mb-4">Próximas Faturas</p>
          <div className="space-y-3">
            {bills.map(b => (
              <div key={b.name} className="flex items-center justify-between p-3 bg-surface-raised rounded-xl">
                <div>
                  <p className="text-sm text-white font-medium">{b.name}</p>
                  <p className="text-xs text-gray-500">{b.date} · {b.card}</p>
                </div>
                <p className="text-sm font-semibold text-red-400">{fmt(b.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div>
        <p className="font-semibold text-white mb-3">Cartões</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map(c => (
            <div key={c.name} className={`rounded-2xl p-5 bg-gradient-to-br ${c.color} relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
              <CreditCard size={22} className="text-white/70 mb-4" />
              <p className="text-lg font-bold text-white">{c.name}</p>
              <p className="text-xs text-white/60 mb-3">Crédito</p>
              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1.5">
                  <span>Usado: {fmt(c.used)}</span>
                  <span>Limite: {fmt(c.limit)}</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${(c.used / c.limit) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions table */}
      <div className="card p-5">
        <p className="font-semibold text-white mb-4">Lançamentos Recentes</p>
        <div className="space-y-2">
          {transactions.map(t => (
            <div key={t.id} className="flex items-center gap-4 py-2.5 px-3 rounded-xl hover:bg-surface-hover transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: (CATEGORY_COLORS[t.category] || '#6366f1') + '20', color: CATEGORY_COLORS[t.category] || '#6366f1' }}>
                {t.type === 'income' ? '↑' : '↓'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{t.description}</p>
                <p className="text-xs text-gray-500">{t.category}{t.card ? ` · ${t.card}` : ''} · {new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="card-raised p-6 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Novo Lançamento</p>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['expense', 'income'].map(tp => (
                <button key={tp} onClick={() => setForm(p => ({ ...p, type: tp as 'expense' | 'income' }))}
                  className={`py-2 rounded-xl text-sm font-semibold transition-all ${form.type === tp ? (tp === 'income' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-red-600/20 text-red-400 border border-red-600/30') : 'bg-surface-border text-gray-500'}`}>
                  {tp === 'income' ? '↑ Entrada' : '↓ Saída'}
                </button>
              ))}
            </div>
            <input className="input-field" placeholder="Descrição" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <input className="input-field" placeholder="Valor (R$)" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            <select className="input-field" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn-primary w-full justify-center"
              onClick={() => {
                if (!form.description || !form.amount) return
                addTransaction({ description: form.description, amount: parseFloat(form.amount), category: form.category, type: form.type, date: new Date().toISOString().split('T')[0], card: form.card })
                setShowAdd(false)
                setForm({ description: '', amount: '', category: 'Alimentação', type: 'expense', card: 'Nubank' })
              }}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
