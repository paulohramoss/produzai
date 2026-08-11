import { useEffect } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { RisePlan } from './rise/RisePlan'
import { Login } from './rise/pages/Login'
import { TrainerView } from './rise/pages/TrainerView'
import { C } from './rise/data'

/** Token do link do treinador, lido uma vez — a rota não muda durante a sessão. */
const coachToken = new URLSearchParams(window.location.search).get('coach')

export default function App() {
  const init        = useAuthStore(s => s.init)
  const user        = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)

  useEffect(() => {
    // A visão do treinador não usa auth: não faz sentido abrir o listener nem
    // carregar dados de usuário nenhum aqui.
    if (coachToken) return
    const unsub = init()
    return unsub
  }, [init])

  // Antes de qualquer coisa: o link do treinador é uma rota pública.
  if (coachToken) return <TrainerView token={coachToken} />

  if (!initialized) {
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

  return user ? <RisePlan /> : <Login />
}
