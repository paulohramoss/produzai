import { useEffect } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { RisePlan } from './rise/RisePlan'
import { Login } from './rise/pages/Login'
import { C } from './rise/data'

export default function App() {
  const init        = useAuthStore(s => s.init)
  const user        = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)

  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])

  if (!initialized) {
    return (
      <div style={{
        minHeight: '100vh',
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
