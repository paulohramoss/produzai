interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  className?: string
  showLabel?: boolean
}

export default function ProgressBar({ value, max = 100, color = 'bg-brand-500', className = '', showLabel = false }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>}
    </div>
  )
}
