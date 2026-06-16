import { useEffect, useRef } from 'react'
import { C } from '../data'
import { X, Download, Share2 } from 'lucide-react'

interface ShareData {
  userName: string
  weekWorkouts: number
  weekXP: number
  weekCal: number
  streak: number
  rank: number
  weekLabel: string
}

interface Props extends ShareData {
  onClose: () => void
}

function drawShareCard(canvas: HTMLCanvasElement, data: ShareData): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = 540
  const H = 960
  const FONT = '-apple-system, "Helvetica Neue", Arial, sans-serif'

  ctx.clearRect(0, 0, W, H)

  // Background
  ctx.fillStyle = '#0C0C0C'
  ctx.fillRect(0, 0, W, H)

  // Orange radial glow (top-center)
  const glow1 = ctx.createRadialGradient(W / 2, 350, 80, W / 2, 350, 440)
  glow1.addColorStop(0, 'rgba(249,115,22,0.20)')
  glow1.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)

  // Blue glow (bottom-center)
  const glow2 = ctx.createRadialGradient(W / 2, 750, 40, W / 2, 750, 360)
  glow2.addColorStop(0, 'rgba(96,165,250,0.08)')
  glow2.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  // Header bar
  ctx.fillStyle = '#F97316'
  ctx.fillRect(0, 0, W, 88)

  ctx.font = `bold 25px ${FONT}`
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⚡ THE RISE PLAN', W / 2, 44)

  // Week label
  ctx.font = `500 17px ${FONT}`
  ctx.fillStyle = '#555'
  ctx.textAlign = 'center'
  ctx.fillText(data.weekLabel, W / 2, 122)

  // Thin accent line below week label
  ctx.strokeStyle = '#1E1E1E'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(100, 142)
  ctx.lineTo(W - 100, 142)
  ctx.stroke()

  // Hero: workout count (very large)
  const heroY = 310
  ctx.font = `bold 148px ${FONT}`
  ctx.fillStyle = data.weekWorkouts === 0 ? '#333' : '#F0F0F0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(data.weekWorkouts), W / 2, heroY)

  // Hero sub-label
  ctx.font = `600 14px ${FONT}`
  ctx.fillStyle = '#555'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TREINOS ESTA SEMANA', W / 2, heroY + 100)

  // Divider
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(48, 440)
  ctx.lineTo(W - 48, 440)
  ctx.stroke()

  // Stats row (3 cols): streak | XP | kcal
  const statsY = 510
  const cols = [
    {
      value: data.streak > 0 ? `${data.streak}d` : '—',
      label: 'STREAK',
      color: data.streak >= 7 ? '#F97316' : '#F0F0F0',
    },
    {
      value: data.weekXP > 0 ? data.weekXP.toLocaleString('pt-BR') : '—',
      label: 'XP SEMANA',
      color: '#60A5FA',
    },
    {
      value: data.weekCal > 0 ? data.weekCal.toLocaleString('pt-BR') : '—',
      label: 'KCAL',
      color: '#22C55E',
    },
  ]
  const colW = W / 3
  for (const [i, col] of cols.entries()) {
    const x = colW * i + colW / 2
    ctx.font = `bold 32px ${FONT}`
    ctx.fillStyle = col.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(col.value, x, statsY)

    ctx.font = `500 12px ${FONT}`
    ctx.fillStyle = '#444'
    ctx.fillText(col.label, x, statsY + 32)
  }

  // Vertical dividers between stat cols
  ctx.strokeStyle = '#1E1E1E'
  ctx.lineWidth = 1
  for (let i = 1; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(colW * i, statsY - 28)
    ctx.lineTo(colW * i, statsY + 48)
    ctx.stroke()
  }

  // Divider
  ctx.strokeStyle = '#1C1C1C'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(48, 600)
  ctx.lineTo(W - 48, 600)
  ctx.stroke()

  // User name
  ctx.font = `bold 26px ${FONT}`
  ctx.fillStyle = '#F0F0F0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(data.userName, W / 2, 648)

  // Rank (if in top 100)
  if (data.rank > 0 && data.rank <= 100) {
    const medal = data.rank === 1 ? '🥇 ' : data.rank === 2 ? '🥈 ' : data.rank === 3 ? '🥉 ' : ''
    ctx.font = `500 15px ${FONT}`
    ctx.fillStyle = '#333'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${medal}#${data.rank} no ranking global`, W / 2, 690)
  }

  // Bottom divider
  ctx.strokeStyle = '#181818'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(48, 895)
  ctx.lineTo(W - 48, 895)
  ctx.stroke()

  // Footer watermark
  ctx.font = `400 14px ${FONT}`
  ctx.fillStyle = '#2A2A2A'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('therisepln.com.br', W / 2, 928)
}

export function ShareCard({ onClose, ...data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Draw after fonts are ready to ensure system fonts are applied
    const run = () => drawShareCard(canvas, data)
    if (typeof document.fonts?.ready?.then === 'function') {
      document.fonts.ready.then(run)
    } else {
      run()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleShare() {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
      )
      const file = new File([blob], 'rise-semana.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'The Rise Plan',
          text: `${data.weekWorkouts} treinos essa semana! 🔥`,
          files: [file],
        })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    // Fallback: download
    handleDownload()
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'rise-semana.png'
    a.click()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          maxWidth: 340, width: '100%',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Card preview */}
        <canvas
          ref={canvasRef}
          width={540}
          height={960}
          style={{
            width: '100%',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            display: 'block',
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleShare}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '12px 16px',
              background: C.orange, border: 'none', borderRadius: 12,
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Share2 size={16} /> Compartilhar
          </button>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 7, padding: '12px 16px',
              background: C.card2, border: `1px solid ${C.border}`,
              borderRadius: 12, color: C.muted, fontSize: 14, cursor: 'pointer',
            }}
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 16px',
              background: C.card2, border: `1px solid ${C.border}`,
              borderRadius: 12, color: C.muted, fontSize: 14, cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
