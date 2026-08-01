import { useState } from 'react'
import type { TooltipContentProps } from 'recharts'
import { C, T } from './data'

/**
 * Foto do usuário com fallback para a inicial do nome.
 * A URL pode falhar por motivos fora do nosso controle (foto do Google
 * bloqueada pelo navegador, arquivo removido do Storage, link expirado) —
 * nesses casos cai na inicial em vez de mostrar imagem quebrada.
 */
export const Avatar = ({
  url, initial, size = 32, fontSize = T.text.md,
  background = C.orange, color = '#000', border,
}: {
  url: string | null
  initial: string
  size?: number
  fontSize?: number | string
  background?: string
  color?: string
  border?: string
}) => {
  // Guarda qual URL falhou, não um booleano: assim uma foto nova é tentada
  // de novo automaticamente, sem precisar resetar nada.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background, border,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: T.weight.extrabold, color,
    }}>
      {url && url !== failedUrl ? (
        <img
          src={url}
          alt=""
          onError={() => setFailedUrl(url)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : initial}
    </div>
  )
}

export const Card = ({ children, style, onClick }: {
  children: React.ReactNode
  style?: React.CSSProperties
  onClick?: () => void
}) => (
  <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    style={{
      background: `linear-gradient(180deg, #181818 0%, ${C.card} 58%)`,
      border: `1px solid ${C.border}`,
      borderRadius: T.radius.xl,
      padding: T.space.xl,
      boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 2px 6px rgba(0,0,0,.28), 0 12px 28px -16px rgba(0,0,0,.55)',
      cursor: onClick ? "pointer" : undefined,
      ...style,
    }}
  >
    {children}
  </div>
)

export const Tag = ({ label, color, small }: { label: string; color: string; small?: boolean }) => (
  <span style={{ fontSize: small ? T.text['2xs'] : T.text.xs, color, background: color + "22", borderRadius: T.radius['2xs'], padding: small ? "1px 6px" : "2px 8px", fontWeight: T.weight.semibold, whiteSpace: "nowrap" }}>
    {label}
  </span>
)

export const Bar = ({ pct, color, h = 5 }: { pct: number; color: string; h?: number }) => (
  <div style={{ background: C.border, borderRadius: T.radius['2xs'], height: h, flex: 1 }}>
    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: T.radius['2xs'], transition: "width .5s" }} />
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

type ChartTooltipProps = Partial<Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'>>

export const ChartTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
      padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,.4)',
    }}>
      {label !== undefined && (
        <div style={{ fontSize: T.text.xs, color: C.muted, fontWeight: T.weight.bold, marginBottom: 4 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, justifyContent: 'space-between', fontSize: T.text.sm }}>
          <span style={{ color: C.muted }}>{p.name}</span>
          <span style={{ fontWeight: T.weight.bold, color: (p.color as string) ?? C.text }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}
