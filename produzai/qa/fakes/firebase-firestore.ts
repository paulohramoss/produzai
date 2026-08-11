// Dublê de `firebase/firestore`: documentos num objeto plano, chaveado pelo
// caminho completo ("users/abc/data/profile"), espelhado em localStorage.
//
// Duas escolhas importam para o QA valer alguma coisa:
//
// 1. `setDoc(..., { merge: true })` faz merge PROFUNDO, como o Firestore real —
//    é disso que `saveDaily` depende para não apagar os hábitos ao gravar água.
// 2. Gravar `undefined` lança erro, também como o Firestore real. Sem isso, um
//    campo opcional mal tratado passaria despercebido e só quebraria em produção.

const KEY = 'qa_firestore'

type Data = Record<string, unknown>

function load(): Record<string, Data> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

let store: Record<string, Data> = load()

function flush() {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* cota */ }
}

interface Ref { path: string; id: string }

export function initializeFirestore() { return { qa: true } }
export function persistentLocalCache() { return {} }
export function persistentMultipleTabManager() { return {} }

export function doc(_db: unknown, ...segments: string[]): Ref {
  return { path: segments.join('/'), id: segments[segments.length - 1] }
}

export function collection(_db: unknown, ...segments: string[]): Ref {
  return { path: segments.join('/'), id: segments[segments.length - 1] }
}

function deepMerge(base: Data, patch: Data): Data {
  const out: Data = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    const prev = out[k]
    const bothMaps = v && typeof v === 'object' && !Array.isArray(v)
      && prev && typeof prev === 'object' && !Array.isArray(prev)
    out[k] = bothMaps ? deepMerge(prev as Data, v as Data) : v
  }
  return out
}

function assertNoUndefined(path: string, value: unknown, trail = '') {
  if (value === undefined) {
    throw new Error(`[qa] Firestore recusa undefined: ${path}${trail}`)
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Data)) assertNoUndefined(path, v, `${trail}.${k}`)
  }
}

export async function getDoc(ref: Ref) {
  const data = store[ref.path]
  return { exists: () => data !== undefined, data: () => data, id: ref.id, ref }
}

export async function setDoc(ref: Ref, data: Data, options?: { merge?: boolean }) {
  assertNoUndefined(ref.path, data)
  store[ref.path] = options?.merge ? deepMerge(store[ref.path] ?? {}, data) : data
  flush()
}

export async function deleteDoc(ref: Ref) {
  delete store[ref.path]
  flush()
}

export async function getDocs(target: Ref | { _coll: Ref }) {
  const coll = '_coll' in target ? target._coll : target
  const prefix = coll.path + '/'
  const docs = Object.entries(store)
    .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .map(([p, d]) => ({ id: p.slice(prefix.length), data: () => d, ref: { path: p, id: p.slice(prefix.length) } }))
  return { docs, empty: docs.length === 0 }
}

// Consultas do leaderboard. Ordenação e limite não mudam nada do que o QA
// verifica, então são no-ops declarados só para a chamada existir.
export function query(coll: Ref) { return { _coll: coll } }
export function orderBy() { return {} }
export function limit() { return {} }
export function where() { return {} }

// Ponte para os cenários: inspecionar e semear o "banco" pelo navegador.
;(window as unknown as { __qaDb: unknown }).__qaDb = {
  dump: () => store,
  seed: (path: string, data: Data) => { store[path] = data; flush() },
  reset: () => { store = {}; flush() },
}
