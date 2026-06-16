import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { auth, storage } from '../lib/firebase'
import { setUserStorageUid } from '../lib/userStorage'
import {
  setDbUid, getProfile, getWorkouts, getDiet, getHydration,
  saveProfile, deleteAllUserData,
} from '../lib/db'
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
  consentAccepted:   boolean
  login:             (email: string, password: string) => Promise<void>
  loginWithGoogle:   () => Promise<void>
  register:          (name: string, email: string, password: string) => Promise<void>
  logout:            () => Promise<void>
  clearError:        () => void
  setOnboardingDone: (v: boolean) => void
  acceptConsent:     () => Promise<void>
  updateProfileData: (patch: { displayName?: string; photoURL?: string }) => Promise<void>
  changePassword:    (currentPass: string, newPass: string) => Promise<void>
  deleteAccount:     (password?: string) => Promise<void>
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

  await useHabitsStore.getState().loadFromCloud()
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
  user:            null,
  displayName:     null,
  photoURL:        null,
  loading:         false,
  error:           null,
  initialized:     false,
  onboardingDone:  false,
  consentAccepted: false,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      set({ error: firebaseErrorMsg(e), loading: false })
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null })
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
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
      // Record consent immediately after account creation (checkbox was required)
      setDbUid(user.uid)
      await saveProfile({ consentAt: Date.now() })
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

  acceptConsent: async () => {
    await saveProfile({ consentAt: Date.now() })
    set({ consentAccepted: true })
  },

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

  deleteAccount: async (password?: string) => {
    const u = auth.currentUser
    if (!u) throw new Error('Usuário não autenticado.')

    // Re-authenticate before sensitive operation (Firebase requirement)
    const isEmailUser = u.providerData.some(p => p.providerId === 'password')
    if (isEmailUser) {
      if (!password) throw new Error('Senha obrigatória para confirmar exclusão.')
      const cred = EmailAuthProvider.credential(u.email!, password)
      await reauthenticateWithCredential(u, cred)
    } else {
      const provider = new GoogleAuthProvider()
      await reauthenticateWithPopup(u, provider)
    }

    const uid = u.uid

    // Delete all Firestore data first
    await deleteAllUserData(uid)

    // Delete avatar from Storage (best effort — file may not exist)
    try {
      await deleteObject(storageRef(storage, `users/${uid}/avatar`))
    } catch { /* no avatar or already gone */ }

    // Delete the Firebase Auth account (must be last)
    await deleteUser(u)

    // Clear in-memory state (onAuthStateChanged will also fire and clean up)
    clearStores()
    setUserStorageUid('')
    setDbUid('')
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
          displayName:     user.displayName,
          photoURL:        user.photoURL,
          loading:         false,
          initialized:     true,
          onboardingDone:  profile?.onboardingDone ?? false,
          consentAccepted: !!(profile?.consentAt),
        })
      } else {
        clearStores()
        setUserStorageUid('')
        setDbUid('')
        set({ user: null, loading: false, initialized: true, onboardingDone: false, consentAccepted: false })
      }
    })
    return unsub
  },
}))
