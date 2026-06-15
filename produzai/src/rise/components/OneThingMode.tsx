import { C } from '../data'

export interface OneThing {
  kind: 'focus' | 'habit' | 'done'
  id: string
  icon: string
  text: string
  why?: string
}

interface Props {
  thing: OneThing
  onComplete: (kind: 'focus' | 'habit', id: string) => void
  onClose: () => void
}

/**
 * Modo "uma coisa": esconde todo o resto da tela e mostra apenas a próxima
 * ação mais importante agora — antídoto direto à paralisia por sobrecarga.
 */
export function OneThingMode({ thing, onComplete, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.bg, zIndex: 500,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20, background: 'none',
          border: `1px solid ${C.border2}`, borderRadius: 10, width: 38, height: 38,
          fontSize: 18, color: C.muted, cursor: 'pointer', lineHeight: 1,
        }}
      >
        ×
      </button>

      <div style={{ fontSize: 12, color: C.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 22, fontWeight: 700 }}>
        Uma coisa por vez
      </div>

      {thing.kind === 'done' ? (
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Tudo feito por aqui!</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
            Seu foco e seus hábitos de hoje estão completos. Aproveite o resto do dia.
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', maxWidth: 420, width: '100%' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>{thing.icon}</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.35, marginBottom: thing.why ? 14 : 28 }}>
            {thing.text}
          </div>
          {thing.why && (
            <div style={{
              fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 28,
              padding: '12px 16px', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
            }}>
              💭 {thing.why}
            </div>
          )}
          <button
            onClick={() => onComplete(thing.kind as 'focus' | 'habit', thing.id)}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, background: C.green,
              border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
            }}
          >
            ✓ Feito! Próximo
          </button>
        </div>
      )}
    </div>
  )
}
