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
  getCoachConversations, saveCoachConversations,
  getWeightLog, saveWeightLog,
  type ActivityLevel, type WeightEntry,
} from '../lib/db'
import { todayKey } from '../lib/date'
import { useWorkoutStore } from './useWorkoutStore'
import { useWebDietStore } from './useWebDietStore'
import { useHabitsStore } from './useHabitsStore'
import { useCoachStore } from './useCoachStore'
import { usePlanStore } from './usePlanStore'

export interface BodyProfile {
  weightKg:      number | null
  heightCm:      number | null
  birthDate:     string | null
  sex:           'masculino' | 'feminino' | null
  activityLevel: ActivityLevel | null
}

const EMPTY_BODY: BodyProfile = {
  weightKg: null, heightCm: null, birthDate: null, sex: null, activityLevel: null,
}

interface AuthState {
  user:              User | null
  displayName:       string | null
  photoURL:          string | null
  loading:           boolean
  error:             string | null
  initialized:       boolean
  onboardingDone:    boolean
  consentAccepted:   boolean
  /** Dados corporais — cada campo é null enquanto o usuário não informa. */
  body:              BodyProfile
  /** Histórico de pesagens, em ordem crescente de data. */
  weightLog:         WeightEntry[]
  /** Atualiza um ou mais campos corporais no perfil. */
  setBody:           (patch: Partial<BodyProfile>) => Promise<void>
  /** Registra a pesagem do dia (substitui a do mesmo dia) e atualiza o peso atual. */
  logWeight:         (kg: number, date?: string) => Promise<void>
  removeWeightEntry: (date: string) => Promise<void>
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
  usePlanStore.persist.rehydrate()
  await usePlanStore.getState().loadFromCloud()
  await loadCoachConversations()
}

// Histórico do Coach: local e nuvem são unidos, nunca substituídos, para que
// nenhuma conversa se perca — nem a que só existe neste aparelho, nem a que só
// existe na nuvem (localStorage limpo, outro navegador, aba anônima).
async function loadCoachConversations() {
  await useCoachStore.persist.rehydrate()
  const read = await getCoachConversations()
  if (!read.ok) return   // falha de leitura: mantém o local intacto e não toca na nuvem

  if (read.items === null) {
    // Ainda não sincronizado neste usuário — sobe o que houver localmente.
    const local = useCoachStore.getState().conversations
    if (local.length > 0) saveCoachConversations(local)
    return
  }

  useCoachStore.getState().mergeConversations(read.items)

  // Devolve para a nuvem se o local tinha algo que ela não tinha.
  const merged = useCoachStore.getState().conversations
  const cloudUpdatedAt = new Map(read.items.map(c => [c.id, c.updatedAt]))
  const needsPush = merged.length !== read.items.length
    || merged.some(c => cloudUpdatedAt.get(c.id) !== c.updatedAt)
  if (needsPush) saveCoachConversations(merged)
}

// Zera apenas o estado em memória ao sair.
//
// A ORDEM IMPORTA: o middleware `persist` do zustand grava em disco a cada
// setState, então limpar os stores com o uid ainda ativo escrevia o estado
// vazio por cima do histórico salvo do usuário — era assim que a conversa com o
// Coach sumia. Soltando o uid antes, o userStorage ignora essas escritas.
function clearSessionState() {
  setUserStorageUid('')
  setDbUid('')
  useWorkoutStore.setState({ workouts: [] })
  useWebDietStore.setState({ data: null })
  usePlanStore.setState({ sessions: [] })
  useCoachStore.setState({ conversations: [], activeId: null })
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  displayName:     null,
  photoURL:        null,
  loading:         false,
  error:           null,
  initialized:     false,
  onboardingDone:  false,
  consentAccepted: false,
  body:            EMPTY_BODY,
  weightLog:       [],

  setBody: async (patch) => {
    const body = { ...get().body, ...patch }
    set({ body })
    // O Firestore rejeita `undefined`; null significa "informado como vazio",
    // então só mandamos o que tem valor de verdade.
    const toSave: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) {
      if (v !== null && v !== undefined) toSave[k] = v
    }
    if (Object.keys(toSave).length > 0) await saveProfile(toSave)
  },

  logWeight: async (kg, date = todayKey()) => {
    const next = [...get().weightLog.filter(e => e.date !== date), { date, kg }]
      .sort((a, b) => a.date.localeCompare(b.date))
    set({ weightLog: next })
    await saveWeightLog(next)
    // O peso "atual" do perfil é sempre a pesagem mais recente registrada.
    const latest = next[next.length - 1]
    if (latest.date === date || latest.kg !== get().body.weightKg) {
      set(s => ({ body: { ...s.body, weightKg: latest.kg } }))
      await saveProfile({ weightKg: latest.kg })
    }
  },

  removeWeightEntry: async (date) => {
    const next = get().weightLog.filter(e => e.date !== date)
    set({ weightLog: next })
    await saveWeightLog(next)
    const latest = next[next.length - 1]
    if (latest) {
      set(s => ({ body: { ...s.body, weightKg: latest.kg } }))
      await saveProfile({ weightKg: latest.kg })
    }
  },

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
      // A conta já existe daqui pra frente: nenhuma falha de perfil pode
      // devolver o usuário para o formulário de cadastro.
      try {
        await updateProfile(user, { displayName: name.trim() || email.split('@')[0] })
        // Record consent immediately after account creation (checkbox was required)
        setDbUid(user.uid)
        await saveProfile({ consentAt: Date.now() })
      } catch (e) {
        console.error('[auth] cadastro criado, mas o perfil inicial falhou', e)
      }
      set({ consentAccepted: true, loading: false })
    } catch (e) {
      set({ error: firebaseErrorMsg(e), loading: false })
    }
  },

  logout: async () => {
    clearSessionState()
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
    clearSessionState()
  },

  init: () => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        setUserStorageUid(user.uid)
        setDbUid(user.uid)

        // A carga da nuvem NUNCA pode impedir a entrada: se o Firestore falhar
        // (offline, regra negada, doc inexistente logo após o cadastro), o
        // `set` abaixo ainda precisa rodar — senão `user` fica null, `loading`
        // fica true e a tela de login trava no "Aguarde...".
        let profile: Awaited<ReturnType<typeof getProfile>> = null
        let weightLog: WeightEntry[] = []
        try {
          const [p, w] = await Promise.all([
            getProfile(),
            getWeightLog(),
            loadFirestoreData(),
          ])
          profile = p
          weightLog = w
        } catch (e) {
          console.error('[auth] falha ao carregar dados do usuário', e)
        }

        set({
          user,
          displayName:     user.displayName,
          photoURL:        user.photoURL,
          loading:         false,
          initialized:     true,
          onboardingDone:  profile?.onboardingDone ?? false,
          // O cadastro já grava o consentimento, mas a escrita é assíncrona e
          // pode não estar visível nesta leitura — não peça consentimento de novo.
          consentAccepted: !!(profile?.consentAt) || get().consentAccepted,
          body: {
            weightKg:      profile?.weightKg ?? null,
            heightCm:      profile?.heightCm ?? null,
            birthDate:     profile?.birthDate ?? null,
            sex:           profile?.sex ?? null,
            activityLevel: profile?.activityLevel ?? null,
          },
          weightLog,
        })
      } else {
        clearSessionState()
        set({
          user: null, loading: false, initialized: true,
          onboardingDone: false, consentAccepted: false,
          body: EMPTY_BODY, weightLog: [],
        })
      }
    })
    return unsub
  },
}))
