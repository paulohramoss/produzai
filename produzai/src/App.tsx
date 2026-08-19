import { useEffect, useState } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { RisePlan } from './rise/RisePlan'
import { Landing } from './rise/pages/Landing'
import { Login } from './rise/pages/Login'
import { TrainerView } from './rise/pages/TrainerView'
import { captureAttribution } from './lib/attribution'
import { C } from './rise/data'

/** Token do link do treinador, lido uma vez — a rota não muda durante a sessão. */
const coachToken = new URLSearchParams(window.location.search).get('coach')

/** De onde a pessoa veio. Gravado antes de qualquer render para não perder o
 *  parâmetro se ela navegar dentro da landing. */
captureAttribution()

/**
 * Existe sessão guardada neste navegador?
 *
 * O Firebase Auth persiste a sessão em localStorage e só confirma o usuário
 * depois de uma ida à rede. Esperar por isso faz sentido para quem já tem
 * conta — mas prender o VISITANTE numa tela de "Carregando..." até o Firebase
 * responder mata justamente o que a landing existe para fazer. Quem nunca
 * logou não tem chave nenhuma aqui, então vê a página na hora; o listener
 * continua rodando em segundo plano e troca a tela sozinho se algo aparecer.
 */
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith('firebase:authUser:')) return true
    }
  } catch {
    // Storage bloqueado: trate como visitante e mostre a landing.
  }
  return false
}

const maybeReturningUser = hasStoredSession()

type PublicView = 'landing' | 'login' | 'register'

export default function App() {
  const init        = useAuthStore(s => s.init)
  const user        = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)

  // Visitante começa na landing; os botões de entrar/criar conta abrem o
  // formulário sem sair da página.
  const [publicView, setPublicView] = useState<PublicView>('landing')

  useEffect(() => {
    // A visão do treinador não usa auth: não faz sentido abrir o listener nem
    // carregar dados de usuário nenhum aqui.
    if (coachToken) return
    const unsub = init()
    return unsub
  }, [init])

  // Antes de qualquer coisa: o link do treinador é uma rota pública.
  if (coachToken) return <TrainerView token={coachToken} />

  if (!initialized && maybeReturningUser) {
    return (
      <div className="rise-screen" style={{
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        gap: 16,
        color: C.text,
      }}>
        <div style={{ fontSize: 48 }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>The Rise Plan</div>
        <div style={{ fontSize: 13, color: C.muted }}>Carregando...</div>
      </div>
    )
  }

  if (user) return <RisePlan />

  if (publicView === 'landing') {
    return <Landing onEnter={mode => setPublicView(mode)} />
  }

  return (
    <Login
      initialMode={publicView}
      onBack={() => setPublicView('landing')}
    />
  )
}
