// Wraps localStorage with a per-user UID prefix so each user's data is isolated.
// Call setUserStorageUid(uid) right after login; call setUserStorageUid('') on logout.
//
// Sem uid não há leitura nem escrita: enquanto ninguém está logado, qualquer
// gravação (ex.: o reset de stores no logout) iria parar numa chave sem prefixo
// e, pior, poderia sobrescrever dados do usuário anterior. Melhor não escrever.

let currentUid = ''

export function setUserStorageUid(uid: string) {
  currentUid = uid
}

export const userStorage = {
  getItem: (name: string): string | null => {
    if (!currentUid) return null
    try { return localStorage.getItem(`${currentUid}:${name}`) } catch { return null }
  },
  setItem: (name: string, value: string): void => {
    if (!currentUid) return
    try { localStorage.setItem(`${currentUid}:${name}`, value) } catch { /* cota cheia ou modo privado */ }
  },
  removeItem: (name: string): void => {
    if (!currentUid) return
    try { localStorage.removeItem(`${currentUid}:${name}`) } catch { /* ignore */ }
  },
}
