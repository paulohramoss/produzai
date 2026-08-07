import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:         import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:     import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:      import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:  import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId:          import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app     = initializeApp(firebaseConfig)
export const auth    = getAuth(app)
export const storage = getStorage(app)

// Cache local persistente (IndexedDB): leituras funcionam sem rede e escritas
// ficam numa fila que sobe sozinha quando a conexão volta. Sem isso, treino
// registrado na academia com sinal ruim só existia no localStorage do aparelho.
//
// `persistentMultipleTabManager` mantém o cache coerente com o app aberto em
// mais de uma aba. Se o navegador não suportar IndexedDB (aba anônima, storage
// bloqueado), a inicialização falha — aí caímos no Firestore só-memória, que é
// o comportamento antigo, em vez de derrubar o app inteiro.
function createDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (e) {
    console.warn('[firebase] cache persistente indisponível, usando memória:', e)
    return initializeFirestore(app, {})
  }
}

export const db = createDb()
