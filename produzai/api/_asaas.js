// Cliente HTTP do Asaas — a única porta do app para a API de cobrança.
//
// A chave (ASAAS_API_KEY) vive SÓ aqui, no servidor. Nunca leva prefixo VITE_:
// qualquer variável VITE_ entra no bundle do navegador e vira pública, e esta
// chave move dinheiro de verdade.
//
// O ambiente é escolhido por ASAAS_ENV ('sandbox' | 'production'). O padrão é
// sandbox de propósito: esquecer de configurar não pode virar cobrança real.

const BASE = {
  sandbox:    'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
}

/** Valor da assinatura, em reais. Fonte única — o cliente só exibe. */
export const PLAN_VALUE_BRL = Number(process.env.PLAN_VALUE_BRL || 20)

/** Rótulo do plano no extrato do assinante e na fatura do Asaas. */
export const PLAN_DESCRIPTION = 'The Rise Plan — assinatura mensal'

/**
 * Dias de tolerância depois do vencimento antes de cortar o acesso.
 *
 * Existe porque o PIX pago às 23h55 do dia do vencimento pode ser confirmado
 * pelo banco só no dia seguinte, e porque a Asaas reprocessa cartão recusado
 * por alguns dias. Cortar no minuto exato transformaria atraso bancário em
 * usuário trancado para fora.
 */
export const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS || 3)

export function asaasEnv() {
  return process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox'
}

export function asaasConfigured() {
  return !!process.env.ASAAS_API_KEY
}

/**
 * Chamada crua à API do Asaas.
 *
 * @param {string} path   Caminho a partir de /v3 (ex: '/customers').
 * @param {object} [opts] { method, body, query }
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 *
 * Nunca lança por erro HTTP: quem chama decide o que fazer com 400 vs 500. Só
 * lança se a chave não estiver configurada — isso é erro de deploy, não de uso.
 */
export async function asaas(path, { method = 'GET', body, query } = {}) {
  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada')

  const url = new URL(BASE[asaasEnv()] + path)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // O Asaas exige o token neste header (não é Bearer).
      access_token: apiKey,
      // A API bloqueia agentes anônimos em alguns endpoints.
      'User-Agent': 'the-rise-plan/1.0',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  let data = null
  try { data = await res.json() } catch { /* 204 e afins */ }

  if (!res.ok) {
    // `errors` é o formato de erro do Asaas: [{ code, description }].
    const desc = data?.errors?.map(e => e.description).join('; ')
    console.error(`[asaas] ${method} ${path} → ${res.status}`, desc || data)
  }

  return { ok: res.ok, status: res.status, data }
}

/** Primeira mensagem de erro legível de uma resposta do Asaas. */
export function asaasError(data, fallback = 'Não foi possível falar com o Asaas.') {
  return data?.errors?.[0]?.description || fallback
}

// ── Operações usadas pelo app ────────────────────────────────────────────────

/**
 * Acha o cliente do Asaas deste usuário, ou cria um.
 *
 * A busca é por `externalReference` = uid, que é a nossa chave, não a do Asaas:
 * o e-mail pode mudar, o uid não. A busca por e-mail vem depois só para não
 * duplicar cliente de quem já foi cadastrado por fora (importação, cobrança
 * manual feita no painel).
 */
export async function findOrCreateCustomer({ uid, name, email, cpfCnpj, phone }) {
  const byRef = await asaas('/customers', { query: { externalReference: uid, limit: 1 } })
  if (byRef.ok && byRef.data?.data?.length) return { ok: true, customer: byRef.data.data[0] }

  if (email) {
    const byEmail = await asaas('/customers', { query: { email, limit: 1 } })
    const found = byEmail.ok ? byEmail.data?.data?.[0] : null
    if (found) {
      // Amarra o cliente encontrado a este uid para as próximas vezes.
      if (found.externalReference !== uid) {
        await asaas(`/customers/${found.id}`, {
          method: 'POST',
          body: { externalReference: uid },
        })
      }
      return { ok: true, customer: found }
    }
  }

  const created = await asaas('/customers', {
    method: 'POST',
    body: {
      name,
      email,
      cpfCnpj,
      ...(phone ? { mobilePhone: phone } : {}),
      externalReference: uid,
      notificationDisabled: false,
    },
  })
  if (!created.ok) return { ok: false, error: asaasError(created.data, 'Dados de cobrança recusados.') }
  return { ok: true, customer: created.data }
}

/**
 * Cria a assinatura mensal.
 *
 * `billingType: 'UNDEFINED'` deixa a escolha (PIX, cartão ou boleto) para a
 * própria página de fatura do Asaas — um fluxo só, sem precisar reproduzir aqui
 * o formulário de cartão nem lidar com dados de cartão no nosso servidor.
 *
 * `externalReference: uid` é o que faz o webhook saber de quem é o pagamento:
 * o Asaas propaga esse campo da assinatura para cada cobrança que ela gera.
 */
export async function createSubscription({ customerId, uid, billingType = 'UNDEFINED' }) {
  const today = new Date().toISOString().slice(0, 10)
  const created = await asaas('/subscriptions', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType,
      value: PLAN_VALUE_BRL,
      nextDueDate: today,
      cycle: 'MONTHLY',
      description: PLAN_DESCRIPTION,
      externalReference: uid,
    },
  })
  if (!created.ok) return { ok: false, error: asaasError(created.data, 'Não foi possível criar a assinatura.') }
  return { ok: true, subscription: created.data }
}

/**
 * A fatura em aberto de uma assinatura — é este link que o usuário abre.
 *
 * A cobrança do primeiro ciclo não nasce junto com a assinatura; o Asaas a
 * gera logo em seguida. Por isso as tentativas: sem elas, o usuário que assina
 * receberia "link indisponível" na primeira vez e teria que voltar depois.
 */
export async function firstOpenInvoiceUrl(subscriptionId, { attempts = 4, delayMs = 500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const res = await asaas(`/subscriptions/${subscriptionId}/payments`, { query: { limit: 10 } })
    const payments = res.ok ? (res.data?.data ?? []) : []
    const open = payments.find(p => p.status === 'PENDING' || p.status === 'AWAITING_RISK_ANALYSIS')
    if (open?.invoiceUrl) return { invoiceUrl: open.invoiceUrl, payment: open }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs))
  }
  return { invoiceUrl: null, payment: null }
}

/** Cobranças de uma assinatura, mais recentes primeiro. */
export async function subscriptionPayments(subscriptionId) {
  const res = await asaas(`/subscriptions/${subscriptionId}/payments`, { query: { limit: 20 } })
  return res.ok ? (res.data?.data ?? []) : []
}

/** Cancela a assinatura no Asaas. Não mexe no acesso já pago — ver _entitlement. */
export async function cancelSubscription(subscriptionId) {
  const res = await asaas(`/subscriptions/${subscriptionId}`, { method: 'DELETE' })
  return res.ok
}
