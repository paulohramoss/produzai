// Limitador de taxa das funções serverless — duas camadas.
//
// ── Por que duas ─────────────────────────────────────────────────────────────
//
// A camada de MEMÓRIA é a que estava aqui sozinha: um contador no escopo do
// módulo, vivo só dentro de uma instância quente. Sob concorrência a Vercel sobe
// várias instâncias, cada uma com o próprio contador, e o teto real vira
// "limite × número de instâncias". Nunca foi cota; era só um freio barato.
//
// A camada do FIRESTORE é o teto de verdade: um documento por chave, atualizado
// em transação, compartilhado por todas as instâncias. Custa uma leitura e uma
// escrita por requisição permitida — irrelevante ao lado de uma chamada de LLM,
// que é o que estes endpoints protegem.
//
// A ordem importa: a memória vem primeiro e, quando ELA já barra, a resposta sai
// sem tocar no banco. Quem está martelando o endpoint é exatamente quem cai na
// instância quente, então o caso de abuso é o mais barato de negar.
//
// ── Quando o Firestore não está disponível ───────────────────────────────────
//
// Sem FIREBASE_SERVICE_ACCOUNT_B64, ou se a transação falhar, vale o veredito da
// memória. É deliberado: um limitador fora do ar não pode virar uma negação de
// serviço contra os próprios usuários. O comportamento degrada para o de antes.
//
// ── Manutenção ───────────────────────────────────────────────────────────────
//
// A coleção `rateLimits` cresce até um documento por (usuário × endpoint) e é
// reescrita a cada janela. Para não acumular contas antigas, configure uma
// política de TTL no campo `expiresAt` no console do Firebase
// (Firestore → TTL). Nada no app lê esses documentos.

import { getAdminDb } from '../_admin.js'

const COLLECTION = 'rateLimits'

const buckets = new Map() // key -> { count, resetAt }

/**
 * Contador de janela fixa, só nesta instância.
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
function memoryLimit(key, { limit, windowMs }) {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count++

  // Limpeza oportunista para o Map não crescer sem limite entre muitos uids.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k)
    }
  }

  const allowed = bucket.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  }
}

/** Id de documento seguro: '/' é o único caractere proibido pelo Firestore. */
function docId(key) {
  return key.replace(/\//g, '_')
}

/**
 * Janela fixa compartilhada por todas as instâncias.
 * @returns {Promise<{allowed:boolean,remaining:number,retryAfterSec:number}|null>}
 *          `null` quando não há como consultar — o chamador fica com a memória.
 */
async function sharedLimit(key, { limit, windowMs }) {
  let db
  try {
    db = await getAdminDb('ratelimit')
  } catch (e) {
    console.error('[rateLimit] admin indisponível:', e.message)
    return null
  }
  if (!db) return null

  const ref = db.collection(COLLECTION).doc(docId(key))

  try {
    return await db.runTransaction(async tx => {
      const snap = await tx.get(ref)
      const now = Date.now()
      const data = snap.exists ? snap.data() : null

      // Janela nova: ou nunca existiu, ou a anterior já venceu.
      if (!data || typeof data.resetAt !== 'number' || now >= data.resetAt) {
        const resetAt = now + windowMs
        tx.set(ref, { count: 1, resetAt, expiresAt: new Date(resetAt) })
        return { allowed: 1 <= limit, remaining: Math.max(0, limit - 1), retryAfterSec: 0 }
      }

      const count = (data.count ?? 0) + 1
      tx.set(ref, { count, resetAt: data.resetAt, expiresAt: new Date(data.resetAt) })

      const allowed = count <= limit
      return {
        allowed,
        remaining: Math.max(0, limit - count),
        retryAfterSec: allowed ? 0 : Math.ceil((data.resetAt - now) / 1000),
      }
    })
  } catch (e) {
    console.error('[rateLimit] transação falhou:', e.message)
    return null
  }
}

/**
 * @param {string} key           Chave única do balde (ex: `completion:${uid}`).
 * @param {{limit:number,windowMs:number}} opts
 * @returns {Promise<{allowed:boolean,remaining:number,retryAfterSec:number}>}
 */
export async function rateLimit(key, { limit, windowMs }) {
  const local = memoryLimit(key, { limit, windowMs })
  if (!local.allowed) return local

  const shared = await sharedLimit(key, { limit, windowMs })
  return shared ?? local
}
