import { C } from './rise/data'

/**
 * A tela do intervalo — entre "o app abriu" e "o app sabe quem é você".
 *
 * Vive fora do App e fora do AuthGate porque os dois precisam dela em momentos
 * diferentes: o App enquanto o chunk do app autenticado desce pela rede, o
 * AuthGate enquanto o Firebase responde quem está logado. Ela não pode morar no
 * chunk que ainda está sendo baixado.
 */
export function Splash() {
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
      <img className="rise-brand" src="/rise-logo.png" alt="The Rise Plan" style={{ width: 170 }} />
      <div style={{ fontSize: 13, color: C.muted }}>Carregando...</div>
    </div>
  )
}
