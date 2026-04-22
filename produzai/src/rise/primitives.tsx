import { C } from './data'

export const Card = ({ children, style, onClick }: {
  children: React.ReactNode
  style?: React.CSSProperties
  onClick?: () => void
}) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, cursor: onClick ? "pointer" : undefined, ...style }}>
    {children}
  </div>
)

export const Tag = ({ label, color, small }: { label: string; color: string; small?: boolean }) => (
  <span style={{ fontSize: small ? 9 : 10, color, background: color + "22", borderRadius: 4, padding: small ? "1px 6px" : "2px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>
    {label}
  </span>
)

export const Bar = ({ pct, color, h = 5 }: { pct: number; color: string; h?: number }) => (
  <div style={{ background: C.border, borderRadius: 4, height: h, flex: 1 }}>
    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s" }} />
  </div>
)

export const Ring = ({ pct, size = 80, stroke = 7, color = C.orange }: { pct: number; size?: number; stroke?: number; color?: string }) => {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill={C.text} fontSize={size / 6} fontWeight={700}>{pct}%</text>
    </svg>
  )
}

export const Dot = ({ color }: { color: string }) => (
  <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
)
