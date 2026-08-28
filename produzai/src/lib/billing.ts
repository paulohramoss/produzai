import { auth } from './firebase'

// Ponte para a assinatura, que vive no servidor.
//
// Nada aqui decide se o usuário pode usar o app — só transporta a resposta de
// quem decide (`/api/billing/subscription`, que lê `billing/{uid}`, gravado só
// pelo servidor). Se este arquivo mentisse, a pessoa ainda apanharia nas regras
// do Firestore e nos endpoints de IA. Ver api/_entitlement.js.

export type BillingStatus = 'none' | 'free' | 'pending' | 'active' | 'overdue' | 'canceled'

export interface BillingView {
  /** Pode usar o app AGORA. É a única pergunta que a tela faz. */
  active: boolean
  /** Por que sim/não — usado para escolher o texto do paywall. */
  reason: 'free-access' | 'paid' | 'no-subscription' | 'awaiting-payment'
        | 'expired' | 'unavailable' | 'unauthenticated' | 'offline'
  status: BillingStatus
  /** Fim do período pago, em ms. */
  activeUntil: number | null
  /** Já existe assinatura no Asaas — o botão vira "abrir fatura". */
  hasSubscription: boolean
  freeAccess: boolean
  canceledAt: number | null
  /** Preço mensal, em reais, vindo do servidor. */
  priceBRL: number
}

/** Fallback local do preço, só para a tela não piscar vazia. */
export const DEFAULT_PRICE_BRL = 20

const OFFLINE: BillingView = {
  active: false, reason: 'offline', status: 'none', activeUntil: null,
  hasSubscription: false, freeAccess: false, canceledAt: null,
  priceBRL: DEFAULT_PRICE_BRL,
}

async function authHeader(): Promise<Record<string, string> | null> {
  try {
    const token = await auth.currentUser?.getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : null
  } catch {
    return null
  }
}

function toView(data: Record<string, unknown>): BillingView {
  return {
    active:          !!data.active,
    reason:          (data.reason as BillingView['reason']) ?? 'no-subscription',
    status:          (data.status as BillingStatus) ?? 'none',
    activeUntil:     typeof data.activeUntil === 'number' ? data.activeUntil : null,
    hasSubscription: !!data.hasSubscription,
    freeAccess:      !!data.freeAccess,
    canceledAt:      typeof data.canceledAt === 'number' ? data.canceledAt : null,
    priceBRL:        typeof data.priceBRL === 'number' ? data.priceBRL : DEFAULT_PRICE_BRL,
  }
}

/**
 * Situação da assinatura.
 *
 * Falha FECHADA de propósito: sem rede, sem token ou com o servidor fora, a
 * resposta é "sem acesso". O contrário transformaria um erro de rede em app
 * liberado — e é justamente o erro que dá para provocar de fora.
 */
export async function fetchBilling(): Promise<BillingView> {
  const headers = await authHeader()
  if (!headers) return { ...OFFLINE, reason: 'unauthenticated' }

  let res: Response
  try {
    res = await fetch('/api/billing/subscription', { headers })
  } catch {
    return OFFLINE
  }

  if (res.status === 401) return { ...OFFLINE, reason: 'unauthenticated' }
  if (res.status === 503) return { ...OFFLINE, reason: 'unavailable' }
  if (!res.ok) return OFFLINE

  try {
    return toView(await res.json())
  } catch {
    return OFFLINE
  }
}

export type CheckoutResult =
  | { ok: true; invoiceUrl: string }
  | { ok: true; alreadyActive: true }
  | { ok: false; error: string }

/**
 * Cria a assinatura e devolve o link da fatura do Asaas.
 *
 * O pagamento em si acontece na página do Asaas — cartão, PIX e boleto na mesma
 * tela. Nenhum dado de cartão passa por aqui nem pelo nosso servidor, o que
 * mantém o app fora do escopo de PCI.
 */
export async function startCheckout(input: {
  name: string
  cpfCnpj: string
  phone?: string
}): Promise<CheckoutResult> {
  const headers = await authHeader()
  if (!headers) return { ok: false, error: 'Sessão expirada. Entre novamente.' }

  let res: Response
  try {
    res = await fetch('/api/billing/subscription', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    return { ok: false, error: 'Sem conexão. Tente novamente.' }
  }

  let data: Record<string, unknown> = {}
  try { data = await res.json() } catch { /* corpo vazio */ }

  if (res.ok && data.alreadyActive) return { ok: true, alreadyActive: true }
  if (res.ok && typeof data.invoiceUrl === 'string') return { ok: true, invoiceUrl: data.invoiceUrl }

  return {
    ok: false,
    error: typeof data.error === 'string' ? data.error : 'Não foi possível iniciar a assinatura.',
  }
}

/** Cancela a renovação. O período já pago continua valendo até vencer. */
export async function cancelSubscription(): Promise<boolean> {
  const headers = await authHeader()
  if (!headers) return false
  try {
    const res = await fetch('/api/billing/subscription', { method: 'DELETE', headers })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Cancela E apaga o registro de cobrança — só na exclusão de conta.
 *
 * O cancelamento comum preserva o documento (é ele que diz até quando o mês
 * pago vale). Aqui não sobra nada: `billing/{uid}` guarda uid, e-mail e os ids
 * do Asaas, e o direito de eliminação não abre exceção para eles.
 */
export async function purgeBilling(): Promise<boolean> {
  const headers = await authHeader()
  if (!headers) return false
  try {
    const res = await fetch('/api/billing/subscription?purge=1', { method: 'DELETE', headers })
    return res.ok
  } catch {
    return false
  }
}

/** Máscara de CPF/CNPJ enquanto digita. */
export function maskDocument(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Máscara de telefone brasileiro (com DDD). */
export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

/**
 * CPF/CNPJ válido pelos dígitos verificadores.
 *
 * A mesma conta roda no servidor (api/billing/subscription.js). Aqui é só para
 * a pessoa descobrir o erro de digitação antes de esperar uma ida à rede.
 */
export function isValidDocument(raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false
    for (const len of [9, 10]) {
      let sum = 0
      for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
      if ((sum * 10) % 11 % 10 !== Number(d[len])) return false
    }
    return true
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false
    const calc = (len: number) => {
      const weights = len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      let sum = 0
      for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]
      const rest = sum % 11
      return rest < 2 ? 0 : 11 - rest
    }
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
  }
  return false
}
