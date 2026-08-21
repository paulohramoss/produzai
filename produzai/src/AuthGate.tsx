import { useEffect, useRef } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { RisePlan } from './rise/RisePlan'
import { Login } from './rise/pages/Login'
import { Splash } from './Splash'

/**
 * Tudo o que depende de estar logado — e, por tabela, tudo o que depende do
 * Firebase.
 *
 * Este arquivo existe para ser um CHUNK SEPARADO. O App não o importa
 * diretamente: quem só chega na landing nunca baixa o SDK do Firebase, que
 * sozinho pesa mais do que o resto do app inteiro. É o `import()` do App que
 * traz este módulo — e, com ele, o `useAuthStore`, o Firestore e as telas do
 * usuário.
 *
 * A conta de quem entra não muda: o chunk desce enquanto o `onAuthStateChanged`
 * ainda está resolvendo, no mesmo instante em que antes se olhava o splash.
 */
interface Props {
  /** Em qual aba o formulário de acesso abre, quando não há sessão. */
  initialMode: 'login' | 'register'
  /** Chamado quando não há mais usuário — o App volta para a landing. */
  onSignedOut: () => void
  /** Botão "voltar" do formulário. Ausente para quem chegou já logado. */
  onBack?: () => void
}

export default function AuthGate({ initialMode, onSignedOut, onBack }: Props) {
  const init        = useAuthStore(s => s.init)
  const user        = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)

  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])

  // Sair da conta devolve a pessoa para a landing, não para o formulário de
  // login — o mesmo destino de antes. Só que "sair" e "nunca ter entrado"
  // chegam aqui com o mesmo `user: null`: sem esta memória, quem clicou em
  // "Entrar" na landing seria mandado de volta para ela no primeiro quadro.
  const hadUser = useRef(false)
  useEffect(() => { if (user) hadUser.current = true }, [user])
  useEffect(() => {
    if (initialized && !user && hadUser.current) onSignedOut()
  }, [initialized, user, onSignedOut])

  if (!initialized) return <Splash />
  if (user) return <RisePlan />

  return <Login initialMode={initialMode} onBack={onBack} />
}
