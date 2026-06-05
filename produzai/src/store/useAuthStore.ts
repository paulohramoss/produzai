import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { setUserStorageUid } from '../lib/userStorage'
import { useWorkoutStore } from './useWorkoutStore'
import { useWebDietStore } from './useWebDietStore'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  initialized: boolean
  login:     (email: string, password: string) => Promise<void>
  register:  (name: string, email: string, password: string) => Promise<void>
  logout:    () => Promise<void>
  clearError: () => void
  init:      () => () => void   // returns unsubscribe function
}

function hydrateStores() {
  useWorkoutStore.persist.rehydrate()
  useWebDietStore.persist.rehydrate()
}

function clearStores() {
  useWorkoutStore.setState({ workouts: [] })
  useWebDietStore.setState({ data: null })
}

function firebaseErrorMsg(e: unknown): string {
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':  return 'E-mail ou senha incorretos.'
    case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado.'
    case 'auth/weak-password':        return 'Senha muito fraca. Use pelo menos 6 caracteres.'
    case 'auth/invalid-email':        return 'E-mail inválido.'
    case 'auth/too-many-requests':    return 'Muitas tentativas. Tente novamente mais tarde.'
    default:                          return 'Erro ao autenticar. Tente novamente.'
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // onAuthStateChanged handles the rest
    } catch (e) {
      set({ error: firebaseErrorMsg(e), loading: false })
    }
  },

  register: async (name, email, password) => {
    set({ loading: true, error: null })
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName: name.trim() || email.split('@')[0] })
      // onAuthStateChanged handles the rest
    } catch (e) {
      set({ error: firebaseErrorMsg(e), loading: false })
    }
  },

  logout: async () => {
    clearStores()
    setUserStorageUid('')
    await firebaseSignOut(auth)
  },

  clearError: () => set({ error: null }),

  init: () => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        setUserStorageUid(user.uid)
        hydrateStores()
      } else {
        clearStores()
        setUserStorageUid('')
      }
      set({ user, loading: false, initialized: true })
    })
    return unsub
  },
}))
