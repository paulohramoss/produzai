import { create } from 'zustand'
import { fetchBilling, DEFAULT_PRICE_BRL, type BillingView } from '../lib/billing'

/**
 * A assinatura, do ponto de vista da interface.
 *
 * `view` começa em `null` e isso é significativo: "ainda não sei" não é a mesma
 * coisa que "não tem acesso". Enquanto for null a tela mostra o esqueleto — se
 * mostrasse o paywall, todo assinante veria um pedido de pagamento piscar a
 * cada abertura do app.
 */
interface BillingState {
  view:     BillingView | null
  loading:  boolean
  /** Consulta o servidor. Idempotente e barata o bastante para chamar à vontade. */
  refresh:  () => Promise<BillingView>
  /** Zerado no logout — a próxima conta não pode herdar o acesso desta. */
  reset:    () => void
  /**
   * Fica perguntando até o pagamento aparecer.
   * Devolve a função que interrompe. Usado enquanto a fatura está aberta em
   * outra aba: o PIX cai em segundos e a volta para o app tem que ser sozinha.
   */
  poll:     (opts?: { intervalMs?: number; maxMs?: number }) => () => void
}

export const useBillingStore = create<BillingState>((set, get) => ({
  view:    null,
  loading: false,

  refresh: async () => {
    set({ loading: true })
    const view = await fetchBilling()
    set({ view, loading: false })
    return view
  },

  reset: () => set({ view: null, loading: false }),

  poll: ({ intervalMs = 5000, maxMs = 15 * 60_000 } = {}) => {
    const startedAt = Date.now()
    let alive = true

    const tick = async () => {
      if (!alive) return
      const view = await get().refresh()
      if (!alive) return
      if (view.active || Date.now() - startedAt > maxMs) return
      setTimeout(tick, intervalMs)
    }
    setTimeout(tick, intervalMs)

    return () => { alive = false }
  },
}))

/** Preço a exibir enquanto o servidor não respondeu. */
export const priceOf = (view: BillingView | null) => view?.priceBRL ?? DEFAULT_PRICE_BRL
