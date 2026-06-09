import { useToastStore } from '../../lib/toast'
import { C } from '../data'

const TYPE_COLOR = { success: C.green, error: C.red, info: C.blue }
const TYPE_ICON  = { success: '✓', error: '✕', info: 'i' }

export function Toaster() {
  const toasts = useToastStore(s => s.toasts)
  const remove = useToastStore(s => s.remove)

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className="toast-slide-in"
          style={{
            pointerEvents: 'auto',
            background: '#1E1E1E',
            border: `1px solid ${TYPE_COLOR[t.type]}44`,
            borderLeft: `4px solid ${TYPE_COLOR[t.type]}`,
            borderRadius: 12,
            padding: '13px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 260,
            maxWidth: 380,
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: TYPE_COLOR[t.type] + '22',
            border: `1.5px solid ${TYPE_COLOR[t.type]}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900, color: TYPE_COLOR[t.type], flexShrink: 0,
          }}>
            {TYPE_ICON[t.type]}
          </span>
          <span style={{ fontSize: 13, color: '#F0F0F0', lineHeight: 1.5, flex: 1 }}>
            {t.message}
          </span>
        </div>
      ))}
    </div>
  )
}
