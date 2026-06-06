import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { setUserStorageUid } from '../lib/userStorage'
import { setDbUid, getProfile, getWorkouts, getDiet } from '../lib/db'
import { useWorkoutStore } from './useWorkoutStore'
import { useWebDietStore } from './useWebDietStore'
import { useHabitsStore } from './useHabitsStore'

interface AuthState {
  user:              User | null
  loading:           boolean
  error:             string | null
  initialized:       boolean
  onboardingDone:    boolean
  login:             (email: string, password: string) => Promise<void>
  loginWithGoogle:   () => Promise<void>
  register:          (name: string, email: string, password: string) => Promise<void>
  logout:            () => Promise<void>
  clearError:        () => void
  setOnboardingDone: (v: boolean) => void
  init:              () => () => void
}

async function loadFirestoreData() {
  const [cloudWorkouts, cloudDiet] = await Promise.all([
    getWorkouts(),
    getDiet(),
  ])

  if (cloudWorkouts !== null) {
    useWorkoutStore.getState().setAll(cloudWorkouts)
  } else {
    useWorkoutStore.persist.rehydrate()
  }

  if (cloudDiet !== null) {
    useWebDietStore.getState().setData(cloudDiet)
  } else {
    useWebDietStore.persist.rehydrate()
  }

  // Carrega definições de hábitos customizados
  await useHabitsStore.getState().loadFromCloud()
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
    case 'auth/invalid-credential':   return 'E-mail ou senha incorretos.'
    case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado.'
    case 'auth/weak-password':        return 'Senha muito fraca. Use pelo menos 6 caracteres.'
    case 'auth/invalid-email':        return 'E-mail inválido.'
    case 'auth/too-many-requests':    return 'Muitas tentativas. Tente novamente mais tarde.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return ''
    case 'auth/popup-blocked':        return 'Popup bloqueado pelo navegador. Permita popups para este site.'
    default:                          return 'Erro ao autenticar. Tente novamente.'
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user:           null,
  loading:        false,
  error:          null,
  initialized:    false,
  onboardingDone: false,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // onAuthStateChanged handles the rest
    } catch (e) {
      set({ error: firebaseErrorMsg(e), loading: false })
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null })
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      // onAuthStateChanged handles the rest
    } catch (e) {
      const msg = firebaseErrorMsg(e)
      set({ error: msg || null, loading: false })
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
    setDbUid('')
    await firebaseSignOut(auth)
  },

  clearError: () => set({ error: null }),

  setOnboardingDone: (v) => set({ onboardingDone: v }),

  init: () => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        setUserStorageUid(user.uid)
        setDbUid(user.uid)
        const [profile] = await Promise.all([
          getProfile(),
          loadFirestoreData(),
        ])
        set({
          user,
          loading: false,
          initialized: true,
          onboardingDone: profile?.onboardingDone ?? false,
        })
      } else {
        clearStores()
        setUserStorageUid('')
        setDbUid('')
        set({ user: null, loading: false, initialized: true, onboardingDone: false })
      }
    })
    return unsub
  },
}))
