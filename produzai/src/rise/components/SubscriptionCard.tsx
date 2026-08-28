// A assinatura vista de dentro do app — o outro lado do Paywall.
//
// Quem chega aqui já está em dia (o Paywall é anterior a qualquer tela). Então
// esta seção responde só três coisas: até quando vale, como cancelar e como
// voltar atrás. O cancelamento tem de estar aqui, visível, e não escondido num
// e-mail de suporte: assinatura que só o vendedor consegue encerrar é prática
// abusiva (CDC, art. 39) — e, na prática, vira chargeback.

import { useState } from 'react'
import { T, C } from '../data'
import { toast } from '../../lib/toast'
import { useBillingStore, priceOf } from '../../store/useBillingStore'
import { cancelSubscription } from '../../lib/billing'

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const LABEL: Record<string, { text: string; color: string }> = {
  active:   { text: 'Ativa',              color: C.green },
  free:     { text: 'Conta interna',      color: C.blue },
  pending:  { text: 'Aguardando pagamento', color: C.orange },
  overdue:  { text: 'Em atraso',          color: C.red },
  canceled: { text: 'Cancelada',          color: C.muted },
  none:     { text: 'Sem assinatura',     color: C.muted },
}

export function SubscriptionCard() {
  const view    = useBillingStore(s => s.view)
  const refresh = useBillingStore(s => s.refresh)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!view) return null

  const badge = LABEL[view.status] ?? LABEL.none
  const price = priceOf(view)
  const canceled = view.status === 'canceled'

  async function handleCancel() {
    setBusy(true)
    const ok = await cancelSubscription()
    setBusy(false)
    setConfirming(false)
    if (ok) {
      await refresh()
      toast.success('Assinatura cancelada. Seu acesso vale até o fim do período pago.')
    } else {
      toast.error('Não foi possível cancelar agora. Tente novamente em instantes.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          background: `${badge.color}18`, border: `1px solid ${badge.color}33`,
          borderRadius: T.radius.sm, padding: '6px 12px',
          fontSize: T.text.sm, color: badge.color, fontWeight: T.weight.semibold,
        }}>
          ● {badge.text}
        </div>
        {!view.freeAccess && (
          <div style={{
            background: C.card2, border: `1px solid ${C.border}`,
            borderRadius: T.radius.sm, padding: '6px 12px',
            fontSize: T.text.sm, color: C.muted,
          }}>
            R$ {price},00 / mês
          </div>
        )}
      </div>

      {view.freeAccess ? (
        <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.6 }}>
          Esta conta tem acesso liberado pela equipe — nenhuma cobrança é feita.
        </div>
      ) : (
        <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.6 }}>
          {view.activeUntil
            ? canceled
              ? <>Cancelada. Seu acesso continua até <strong style={{ color: C.text }}>{formatDate(view.activeUntil)}</strong> — depois disso, nada é cobrado.</>
              : <>Próxima renovação em <strong style={{ color: C.text }}>{formatDate(view.activeUntil)}</strong>.</>
            : 'Assinatura mensal, sem fidelidade.'}
        </div>
      )}

      {!view.freeAccess && !canceled && (
        confirming ? (
          <div style={{
            background: C.card2, border: `1px solid ${C.border2}`,
            borderRadius: T.radius.lg, padding: '14px 16px',
          }}>
            <div style={{ fontSize: T.text.base, color: C.text, lineHeight: 1.6, marginBottom: 12 }}>
              Cancelar a renovação? Você continua com acesso até o fim do período
              já pago, e seus dados ficam salvos caso queira voltar.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCancel}
                disabled={busy}
                style={{
                  flex: 1, padding: '10px', borderRadius: T.radius.sm, border: 'none',
                  background: C.red, color: '#fff', fontSize: T.text.md,
                  fontWeight: T.weight.semibold, cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy ? 'Cancelando...' : 'Sim, cancelar'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                style={{
                  flex: 1, padding: '10px', borderRadius: T.radius.sm,
                  border: `1px solid ${C.border2}`, background: 'transparent',
                  color: C.text, fontSize: T.text.md, cursor: 'pointer',
                }}
              >
                Manter assinatura
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              alignSelf: 'flex-start', padding: '9px 16px',
              borderRadius: T.radius.sm, border: `1px solid ${C.border2}`,
              background: 'transparent', color: C.muted,
              fontSize: T.text.md, cursor: 'pointer',
            }}
          >
            Cancelar assinatura
          </button>
        )
      )}
    </div>
  )
}
