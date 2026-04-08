import { TrendingUp, TrendingDown, Plus, Target } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis } from 'recharts'
import { useAppStore } from '../store/useAppStore'
import ProgressBar from '../components/ui/ProgressBar'

const CAT_LABELS: Record<string, string> = { fixed: 'Renda Fixa', variable: 'Renda Variável', crypto: 'Criptomoedas', real_estate: 'FIIs' }
const CAT_COLORS: Record<string, string> = { fixed: '#6366f1', variable: '#10b981', crypto: '#f59e0b', real_estate: '#8b5cf6' }

const projectionData = Array.from({ length: 13 }, (_, i) => ({
  month: i === 0 ? 'Hoje' : `+${i}m`,
  value: Math.round(43000 * Math.pow(1.008, i)),
  goal: 43000 + i * 3000,
}))

export default function Investments() {
  const { investments } = useAppStore()

  const totalInvested = investments.reduce((s, i) => s + i.invested, 0)
  const totalCurrent = investments.reduce((s, i) => s + i.current, 0)
  const totalReturn = totalCurrent - totalInvested
  const returnPct = ((totalReturn / totalInvested) * 100).toFixed(2)

  const byCategory = investments.reduce((acc: Record<string, number>, inv) => {
    acc[inv.category] = (acc[inv.category] || 0) + inv.current
    return acc
  }, {})
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }))

  function fmt(v: unknown) { return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Investimentos</h1>
          <p className="text-sm text-gray-500 mt-1">Construa patrimônio com consistência</p>
        </div>
        <button className="btn-primary"><Plus size={16} /> Novo Ativo</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Investido', value: fmt(totalInvested), color: 'text-white' },
          { label: 'Valor Atual', value: fmt(totalCurrent), color: 'text-white' },
          { label: 'Rentabilidade', value: fmt(totalReturn), sub: `+${returnPct}%`, color: 'text-emerald-400' },
          { label: 'Ativos', value: `${investments.length}`, sub: '4 categorias', color: 'text-brand-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            {s.sub && <p className="text-xs text-emerald-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pie + legend */}
        <div className="card p-5">
          <p className="font-semibold text-white mb-4">Distribuição</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                {pieData.map((e, i) => <Cell key={i} fill={CAT_COLORS[e.name]} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map(e => {
              const pct = ((e.value / totalCurrent) * 100).toFixed(1)
              return (
                <div key={e.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[e.name] }} />
                      <span className="text-xs text-gray-400">{CAT_LABELS[e.name]}</span>
                    </div>
                    <span className="text-xs text-white">{pct}%</span>
                  </div>
                  <ProgressBar value={e.value} max={totalCurrent} color="" className="[&>div>div]:bg-[var(--c)]" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Projection */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-white">Projeção 12 meses</p>
              <p className="text-xs text-gray-500">Com aporte mensal de R$ 3.000</p>
            </div>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-500 inline-block" /> Carteira</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Meta</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={projectionData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="goal" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assets table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-white">Carteira</p>
          <Target size={16} className="text-gray-500" />
        </div>
        <div className="space-y-2">
          {investments.map(inv => {
            const ret = inv.current - inv.invested
            const retPct = ((ret / inv.invested) * 100).toFixed(1)
            const positive = ret >= 0
            return (
              <div key={inv.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-hover transition-colors">
                <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[inv.category] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{inv.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: CAT_COLORS[inv.category] + '20', color: CAT_COLORS[inv.category] }}>
                    {CAT_LABELS[inv.category]}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Investido</p>
                  <p className="text-sm text-white font-medium">{fmt(inv.invested)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Atual</p>
                  <p className="text-sm text-white font-medium">{fmt(inv.current)}</p>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="text-sm font-semibold">{positive ? '+' : ''}{retPct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
