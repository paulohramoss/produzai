// Dublê de `firebase/auth`.
//
// A sessão vive em localStorage (`qa_auth_user`) para sobreviver a reloads e
// para que os cenários possam pular o cadastro semeando a chave direto.
// O uid é derivado do e-mail de forma determinística — cenários precisam saber
// em qual caminho do Firestore semear os dados antes de a página abrir.

export interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  providerData: { providerId: string }[]
}

export const AUTH_KEY = 'qa_auth_user'

let current: User | null = readStored()
const listeners = new Set<(u: User | null) => void>()

function readStored(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch { return null }
}

function persist() {
  if (current) localStorage.setItem(AUTH_KEY, JSON.stringify(current))
  else localStorage.removeItem(AUTH_KEY)
}

function notify() {
  persist()
  for (const cb of listeners) cb(current)
}

/** Mesmo algoritmo do helper `uidFor` em qa/lib/app.mjs — mantenha os dois em sincronia. */
export function uidFor(email: string): string {
  let h = 0
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 'qa' + h.toString(36).padStart(7, '0')
}

function makeUser(email: string, displayName: string | null = null): User {
  return {
    uid: uidFor(email),
    email,
    displayName,
    photoURL: null,
    providerData: [{ providerId: 'password' }],
  }
}

export const auth = {
  get currentUser() { return current },
}

export function getAuth() { return auth }

export function onAuthStateChanged(_auth: unknown, cb: (u: User | null) => void) {
  listeners.add(cb)
  // O SDK real também entrega o estado inicial de forma assíncrona.
  setTimeout(() => cb(current), 0)
  return () => listeners.delete(cb)
}

export async function createUserWithEmailAndPassword(_a: unknown, email: string, password: string) {
  if (password.length < 6) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' })
  if (!email.includes('@')) throw Object.assign(new Error('invalid'), { code: 'auth/invalid-email' })
  current = makeUser(email)
  notify()
  return { user: current }
}

export async function signInWithEmailAndPassword(_a: unknown, email: string) {
  current = makeUser(email)
  notify()
  return { user: current }
}

export async function signInWithPopup() {
  current = { ...makeUser('google@qa.dev'), providerData: [{ providerId: 'google.com' }] }
  notify()
  return { user: current }
}

export async function signOut() {
  current = null
  notify()
}

export async function updateProfile(user: User, patch: Partial<User>) {
  Object.assign(user, patch)
  if (current && current.uid === user.uid) current = { ...current, ...patch }
  notify()
}

export async function updatePassword() {}
export async function deleteUser() { current = null; notify() }
export async function reauthenticateWithCredential() {}
export async function reauthenticateWithPopup() {}

export const EmailAuthProvider = { credential: () => ({}) }
export class GoogleAuthProvider {}
