// Dublê de `firebase/app`. Só existe sob o alias do qa/vite.qa.config.ts —
// nunca entra no bundle de produção.
export function initializeApp() {
  return { name: 'qa' }
}
