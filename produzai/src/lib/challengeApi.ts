import { auth } from './firebase'

// Ponte para o placar do desafio, que vive no servidor.
//
// O app não escreve mais em `challenges/` — as regras do Firestore proíbem. A
// única forma de um dia entrar no placar é este endpoint confirmá-lo, e ele só
// confirma o que viu no dia certo. Ver api/challenge/sync.js.

export interface ChallengeEntryView {
  daysDone: number
  /** Dias que o servidor confirmou, em ordem crescente. */
  confirmedDays: string[]
  lastDay: string
  updatedAt: number
}

export interface ChallengeSyncResult {
  entry: ChallengeEntryView
  /** Dias registrados no app que o servidor NÃO confirmou (backfill). */
  pending: string[]
  state: 'upcoming' | 'running' | 'ended'
}

/** Falha de sincronia — a tela mostra a estimativa local e avisa que é isso. */
export type ChallengeSyncOutcome =
  | { ok: true; data: ChallengeSyncResult }
  | { ok: false; reason: 'offline' | 'unauthenticated' | 'not-configured' | 'error' }

async function authHeader(): Promise<Record<string, string> | null> {
  try {
    const token = await auth.currentUser?.getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : null
  } catch {
    return null
  }
}

/**
 * Recalcula o placar no servidor e devolve o número oficial.
 *
 * Seguro de chamar sempre que o app abre ou um treino é registrado: o servidor
 * é idempotente e o limitador de taxa cobre o resto.
 */
export async function syncChallenge(): Promise<ChallengeSyncOutcome> {
  const headers = await authHeader()
  if (!headers) return { ok: false, reason: 'unauthenticated' }

  let res: Response
  try {
    res = await fetch('/api/challenge/sync', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync' }),
    })
  } catch {
    // Sem rede, ou rodando sem as funções serverless (`npm run dev`).
    return { ok: false, reason: 'offline' }
  }

  if (res.status === 503) return { ok: false, reason: 'not-configured' }
  if (res.status === 401) return { ok: false, reason: 'unauthenticated' }
  if (!res.ok) return { ok: false, reason: 'error' }

  try {
    const data = await res.json()
    return {
      ok: true,
      data: {
        entry: data.entry ?? { daysDone: 0, confirmedDays: [], lastDay: '', updatedAt: 0 },
        pending: Array.isArray(data.pending) ? data.pending : [],
        state: data.state ?? 'running',
      },
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/**
 * Pede ao servidor que apague a entrada deste usuário no placar.
 *
 * Existe porque o cliente perdeu a permissão de escrita em `challenges/` e a
 * exclusão de conta (LGPD, Art. 18, IV) continua tendo de levar tudo embora.
 */
export async function forgetChallengeEntry(): Promise<void> {
  const headers = await authHeader()
  if (!headers) return
  try {
    await fetch('/api/challenge/sync', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'forget' }),
    })
  } catch {
    // Falha aqui não pode travar a exclusão da conta; o restante já foi apagado.
  }
}
