import { useMemo, useState } from 'react'
import { X, Copy, ShoppingCart, RotateCcw } from 'lucide-react'
import { T, C, displayStyle, safeInset } from '../data'
import { useWebDietStore } from '../../store/useWebDietStore'
import { useIsMobile } from '../../lib/useIsMobile'
import { toast } from '../../lib/toast'
import {
  buildShoppingList, shoppingListToText, formatQty, CATEGORY_ORDER,
  type Category,
} from '../../lib/shoppingList'

/**
 * Lista de compras da semana, gerada da própria dieta.
 *
 * O usuário já respondeu "o que eu como" quando montou o plano; esta tela só
 * responde a pergunta seguinte, que o app deixava em aberto: "o que eu compro".
 * Os riscados vivem só enquanto o modal está aberto — a lista é descartável por
 * natureza, e persistir isso criaria estado velho para limpar toda semana.
 */

const DAY_OPTIONS = [3, 5, 7, 14]

export function ShoppingListModal({ onClose }: { onClose: () => void }) {
  const meals = useWebDietStore(s => s.data?.meals)
  const isMobile = useIsMobile()
  const [days, setDays] = useState(7)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const items = useMemo(() => buildShoppingList(meals ?? [], days), [meals, days])

  const usedCategories = CATEGORY_ORDER.filter(c => items.some(i => i.category === c))
  const doneCount = items.filter(i => checked.has(i.key + i.unit)).length

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function copyAll() {
    navigator.clipboard.writeText(shoppingListToText(items, days))
      .then(() => toast.success('Lista copiada — é só colar no WhatsApp'))
      .catch(() => toast.error('Não foi possível copiar'))
  }

  return (
    <div
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,.72)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 24,
      }}
    >
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: isMobile ? `${T.radius['4xl']}px ${T.radius['4xl']}px 0 0` : T.radius['4xl'],
        width: '100%', maxWidth: 560,
        maxHeight: isMobile ? '88dvh' : '86vh',
        display: 'flex', flexDirection: 'column',
        paddingBottom: isMobile ? safeInset('bottom', 0) : 0,
      }}>

        {/* Cabeçalho */}
        <div style={{
          padding: '20px 22px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, ...displayStyle,
              }}>
                <ShoppingCart size={19} color={C.green} /> Lista de compras
              </div>
              <div style={{ fontSize: T.text.md, color: C.muted, marginTop: 4 }}>
                {items.length > 0
                  ? `${items.length} itens · ${doneCount} no carrinho`
                  : 'Montada a partir das suas refeições'}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fechar" style={{
              background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
              padding: 7, color: C.muted2, cursor: 'pointer', lineHeight: 0, flexShrink: 0,
            }}>
              <X size={15} />
            </button>
          </div>

          {/* Janela */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: T.text.sm, color: C.muted }}>Compra para</span>
            <div style={{ display: 'flex', gap: 3, background: C.card2, borderRadius: T.radius.sm, padding: 3 }}>
              {DAY_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: T.radius.xs, cursor: 'pointer',
                    background: days === d ? C.card3 : 'transparent',
                    color: days === d ? C.text : C.muted,
                    fontSize: T.text.sm, fontWeight: days === d ? 700 : 500,
                  }}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', padding: '16px 22px', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: C.muted }}>
              <div style={{ fontSize: T.text['7xl'], marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: T.text.lg, lineHeight: 1.6 }}>
                Suas refeições ainda não têm ingredientes listados.<br />
                Edite o plano e escreva os itens de cada refeição —
                <br />ex.: <code style={{ color: C.green }}>150g de peito de frango</code>.
              </div>
            </div>
          ) : (
            usedCategories.map(category => (
              <CategoryGroup
                key={category}
                category={category}
                items={items.filter(i => i.category === category)}
                checked={checked}
                onToggle={toggle}
              />
            ))
          )}
        </div>

        {/* Rodapé */}
        {items.length > 0 && (
          <div style={{
            padding: '14px 22px', borderTop: `1px solid ${C.border}`,
            display: 'flex', gap: 10, flexShrink: 0,
          }}>
            <button onClick={copyAll} style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: C.green, border: 'none', borderRadius: T.radius.md,
              padding: '12px 18px', color: '#08210F',
              fontSize: T.text.lg, fontWeight: T.weight.bold, cursor: 'pointer',
            }}>
              <Copy size={15} /> Copiar lista
            </button>
            {doneCount > 0 && (
              <button
                onClick={() => setChecked(new Set())}
                title="Desmarcar tudo"
                style={{
                  background: 'transparent', border: `1px solid ${C.border2}`,
                  borderRadius: T.radius.md, padding: '12px 14px',
                  color: C.muted2, cursor: 'pointer', lineHeight: 0,
                }}
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryGroup({ category, items, checked, onToggle }: {
  category: Category
  items: ReturnType<typeof buildShoppingList>
  checked: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: T.text.xs, color: C.muted, fontWeight: T.weight.bold,
        textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 8,
      }}>
        {category}
      </div>
      {items.map(item => {
        const id = item.key + item.unit
        const isChecked = checked.has(id)
        const qty = formatQty(item)
        return (
          <button
            key={id}
            onClick={() => onToggle(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, width: '100%',
              background: isChecked ? 'transparent' : C.card2,
              border: `1px solid ${isChecked ? C.border : C.border2}`,
              borderRadius: T.radius.md, padding: '10px 13px', marginBottom: 6,
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: T.radius['2xs'], flexShrink: 0,
              border: `1.5px solid ${isChecked ? C.green : C.border2}`,
              background: isChecked ? C.green : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#08210F', fontWeight: 700, lineHeight: 1,
            }}>
              {isChecked ? '✓' : ''}
            </span>
            <span style={{
              flex: 1, fontSize: T.text.lg,
              color: isChecked ? C.muted : C.text,
              textDecoration: isChecked ? 'line-through' : 'none',
            }}>
              {item.name}
            </span>
            {qty && (
              <span style={{
                fontSize: T.text.md, fontWeight: T.weight.bold, flexShrink: 0,
                color: isChecked ? C.muted : C.green,
              }}>
                {qty}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
