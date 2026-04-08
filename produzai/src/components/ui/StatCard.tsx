interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: string
}

export default function StatCard({ label, value, sub, icon, trend, trendValue, color = 'text-white' }: StatCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {trend && trendValue && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
            trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' :
            trend === 'down' ? 'bg-red-500/10 text-red-400' :
            'bg-gray-500/10 text-gray-400'
          }`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'} {trendValue}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}
