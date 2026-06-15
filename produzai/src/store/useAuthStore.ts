import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { setUserStorageUid } from '../lib/userStorage'
import { setDbUid, getProfile, getWorkouts, getDiet, getHydration } from '../lib/db'
import { useWorkoutStore } from './useWorkoutStore'
import { useWebDietStore } from './useWebDietStore'
import { useHabitsStore } from './useHabitsStore'
import { useCoachStore } from './useCoachStore'

interface AuthState {
  user:              User | null
  displayName:       string | null
  photoURL:          string | null
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
  updateProfileData: (patch: { displayName?: string; photoURL?: string }) => Promise<void>
  changePassword:    (currentPass: string, newPass: string) => Promise<void>
  init:              () => () => void
}

async function loadFirestoreData() {
  const [cloudWorkouts, cloudDiet, cloudHydration] = await Promise.all([
    getWorkouts(),
    getDiet(),
    getHydration(),
  ])

  if (cloudWorkouts !== null) {
    useWorkoutStore.getState().setAll(cloudWorkouts)
  } else {
    useWorkoutStore.persist.rehydrate()
  }

  useWebDietStore.persist.rehydrate()
  if (cloudDiet !== null) {
    useWebDietStore.getState().setData(cloudDiet)
  }
  if (cloudHydration !== null) {
    useWebDietStore.setState({ waterGoalMl: cloudHydration.goalMl })
  }

  // Carrega definições de hábitos customizados
  await useHabitsStore.getState().loadFromCloud()

  // Carrega histórico de conversas com o Coach IA (local, por usuário)
  useCoachStore.persist.rehydrate()
}

function clearStores() {
  useWorkoutStore.setState({ workouts: [] })
  useWebDietStore.setState({ data: null })
  useCoachStore.setState({ messages: [] })
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
  displayName:    null,
  photoURL:       null,
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

  updateProfileData: async (patch) => {
    const u = auth.currentUser
    if (!u) return
    await updateProfile(u, patch)
    set({
      displayName: patch.displayName !== undefined ? patch.displayName : u.displayName,
      photoURL:    patch.photoURL    !== undefined ? patch.photoURL    : u.photoURL,
    })
  },

  changePassword: async (currentPass, newPass) => {
    const u = auth.currentUser
    if (!u || !u.email) throw new Error('Usuário sem e-mail.')
    const credential = EmailAuthProvider.credential(u.email, currentPass)
    await reauthenticateWithCredential(u, credential)
    await updatePassword(u, newPass)
  },

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
          displayName: user.displayName,
          photoURL:    user.photoURL,
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
