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
import { markSignedIn, markSignedOut } from '../lib/sessionHint'
import {
  setDbUid, getProfile, getWorkouts, getDiet, getHydration,
  saveProfile, deleteAllUserData,
  getCoachConversations, saveCoachConversations,
  getWeightLog, saveWeightLog,
  lookupByInviteCode, addFriend, joinClub, getMyClubId,
  type ActivityLevel, type WeightEntry, type UserProfile,
} from '../lib/db'
import { todayKey } from '../lib/date'
import { getAttribution, attributionFields } from '../lib/attribution'
import { useWorkoutStore } from './useWorkoutStore'
import { useWebDietStore } from './useWebDietStore'
import { useHabitsStore } from './useHabitsStore'
import { useCoachStore } from './useCoachStore'
import { usePlanStore } from './usePlanStore'
import { useCycleStore } from './useCycleStore'
import { useBillingStore } from './useBillingStore'
import { cancelSubscription } from '../lib/billing'

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

/**
 * Carrega o resto dos dados do usuário — DEPOIS que a tela já está de pé.
 *
 * Nada aqui bloqueia a entrada no app (ver `init`): cada bloco atualiza sua
 * store quando chega. As três cargas do fim são independentes entre si, então
 * vão juntas — em série eram quatro idas ao Firestore uma esperando a outra,
 * somadas na conta de quem estava olhando para o splash.
 *
 * O histórico do Coach saiu daqui de propósito: é o documento mais pesado do
 * usuário (teto de 900 KB) e só interessa a quem abre a aba do Coach, que o
 * carrega sozinha via `ensureCoachConversations`.
 */
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

  // A releitura do disco vem antes da nuvem, como antes: `loadFromCloud` funde
  // com o que já está na store.
  usePlanStore.persist.rehydrate()

  await Promise.allSettled([
    useHabitsStore.getState().loadFromCloud(),
    usePlanStore.getState().loadFromCloud(),
    useCycleStore.getState().load(),
  ])
}

/**
 * Grava a origem do atleta e cumpre o que o link prometeu.
 *
 * Roda depois do primeiro login, não no clique: só aqui existe uid, e sem uid
 * não há como consultar o código de convite nem entrar em clube. É idempotente
 * — o perfil que já tem `attribution` não é tocado de novo, então voltar pelo
 * mesmo link amanhã não reescreve a origem nem re-adiciona ninguém.
 */
async function applyAttribution(profile: UserProfile | null) {
  const local = getAttribution()
  if (!local || profile?.attribution) return

  await saveProfile(attributionFields() as Partial<UserProfile>)

  // ?ref=ABC123 — quem indicou entra na lista de amigos do indicado. A volta
  // depende do outro lado: cada um só pode escrever na própria lista.
  if (local.ref) {
    try {
      const referrer = await lookupByInviteCode(local.ref)
      if (referrer && referrer.uid !== auth.currentUser?.uid) await addFriend(referrer.uid)
    } catch (e) {
      console.error('[auth] indicação não pôde ser aplicada', e)
    }
  }

  // ?club=XXXXXX — o convite de clube entra direto, se a pessoa ainda não tem um.
  const clubCode = new URLSearchParams(window.location.search).get('club')
  if (clubCode && !(await getMyClubId())) {
    try {
      await joinClub(clubCode)
    } catch (e) {
      console.error('[auth] convite de clube não pôde ser aplicado', e)
    }
  }
}

// Histórico do Coach: local e nuvem são unidos, nunca substituídos, para que
// nenhuma conversa se perca — nem a que só existe neste aparelho, nem a que só
// existe na nuvem (localStorage limpo, outro navegador, aba anônima).
let coachLoad: Promise<void> | null = null

/**
 * Carrega o histórico do Coach sob demanda, uma vez por sessão.
 *
 * Chamado pela tela do Coach ao montar. A promessa fica guardada para que duas
 * montagens seguidas (StrictMode, ida e volta entre abas) não disparem duas
 * leituras nem dois merges.
 */
export function ensureCoachConversations(): Promise<void> {
  if (!coachLoad) {
    coachLoad = loadCoachConversations().catch(e => {
      console.error('[coach] falha ao carregar as conversas', e)
      coachLoad = null   // deixa a próxima abertura tentar de novo
    })
  }
  return coachLoad
}

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
  useCycleStore.getState().reset()
  // A assinatura é de quem entrou, não do navegador: sem este reset a próxima
  // conta a abrir o app entraria direto, herdando o acesso da anterior enquanto
  // o servidor ainda não respondeu.
  useBillingStore.getState().reset()
  // Sem isto a próxima conta a entrar neste navegador herdaria a promessa já
  // resolvida e abriria o Coach sem nunca ler o histórico dela.
  coachLoad = null
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

    // Cancela a cobrança ANTES de apagar a conta: sem isto o Asaas continuaria
    // emitindo a mensalidade de alguém que não existe mais no app.
    await cancelSubscription().catch(() => { /* a exclusão não pode travar por isto */ })

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
        // Antes de qualquer await: é este bilhete que faz o próximo F5 abrir no
        // splash do app em vez da landing. Ver lib/sessionHint.
        markSignedIn()
        setUserStorageUid(user.uid)
        setDbUid(user.uid)

        // A carga da nuvem NUNCA pode impedir a entrada: se o Firestore falhar
        // (offline, regra negada, doc inexistente logo após o cadastro), o
        // `set` abaixo ainda precisa rodar — senão `user` fica null, `loading`
        // fica true e a tela de login trava no "Aguarde...".
        // ÚNICA leitura que trava a entrada: é o perfil que decide para qual
        // tela mandar a pessoa (onboarding, consentimento ou o app). Tudo o
        // mais — pesagens, treinos, dieta, hábitos, plano, ciclo — chega
        // depois, com a tela já de pé; ficar no splash esperando o app inteiro
        // custava vários round-trips de Firestore antes do primeiro pixel.
        let profile: Awaited<ReturnType<typeof getProfile>> = null
        try {
          profile = await getProfile()
        } catch (e) {
          console.error('[auth] falha ao carregar o perfil', e)
        }

        const weightLog: WeightEntry[] = []

        getWeightLog()
          .then(log => set({ weightLog: log }))
          .catch(e => console.error('[auth] falha ao carregar as pesagens', e))

        loadFirestoreData().catch(e =>
          console.error('[auth] falha ao carregar dados do usuário', e),
        )

        // Não bloqueia a entrada: a origem é métrica, não requisito de acesso.
        applyAttribution(profile).catch(e =>
          console.error('[auth] falha ao registrar a origem', e),
        )

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
        markSignedOut()
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
