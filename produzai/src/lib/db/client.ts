// Núcleo compartilhado dos módulos de db/.
//
// ── O uid mora AQUI, e só aqui ───────────────────────────────────────────────
//
// `currentUid` é estado de escopo de módulo e NÃO é exportado, de propósito.
// Se cada módulo de domínio tivesse a própria cópia, `setDbUid` atualizaria uma
// só e os demais continuariam apontando para o usuário anterior — o app leria e
// escreveria dado de outra conta sem estourar nenhum erro.
//
// Quem precisa do uid chama `getDbUid()`. Nunca importe o valor: uma cópia
// (`const uid = getDbUid()` no topo de um módulo, ou um destructuring de import)
// congela o que valia no momento em que o módulo carregou, que é exatamente o
// bug que este arquivo existe para impedir.

import { doc } from 'firebase/firestore'
import { db } from '../firebase'

let currentUid = ''

export function setDbUid(uid: string) { currentUid = uid }

/** Uid da sessão. String vazia enquanto ninguém está logado. */
export function getDbUid(): string { return currentUid }

// Paths: users/{uid}/data/{docName}  ou  users/{uid}/{sub}/{docId}
export function dataRef(name: string) {
  return doc(db, 'users', currentUid, 'data', name)
}

export function subRef(sub: string, id: string) {
  return doc(db, 'users', currentUid, sub, id)
}

// Monthly aggregation: users/{uid}/dailyMonthly/{yyyy-MM}
// Reduces 35 getDoc calls to 1-2 reads for the Insights history window.
export function monthlyRef(sub: 'dailyMonthly' | 'mentalMonthly' | 'journalMonthly', ym: string) {
  return doc(db, 'users', currentUid, sub, ym)
}

export function logDbError(fn: string, err: unknown) {
  console.error(`[db] ${fn}:`, err)
}

// Com o cache persistente ligado, a promise de uma escrita só resolve quando o
// SERVIDOR confirma — offline ela fica pendente indefinidamente. O dado já está
// salvo localmente e sobe sozinho quando a rede volta, então esperar por essa
// promise só travaria a interface. Disparamos e registramos a falha, se houver.
export function fireWrite(p: Promise<unknown>, fn: string): void {
  p.catch(e => logDbError(fn, e))
}
