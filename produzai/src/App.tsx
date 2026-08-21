import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { Landing } from './rise/pages/Landing'
import { Splash } from './Splash'
import { captureAttribution } from './lib/attribution'
import { hasStoredSession, sessionFlag, probeFirebaseSession } from './lib/sessionHint'

/**
 * O app autenticado e a visão do treinador viajam em chunks próprios.
 *
 * Este é o corte que mais pesa no primeiro acesso: os dois arrastam o SDK do
 * Firebase junto (~154 KB comprimidos, mais que todo o resto do app somado), e
 * quem cai na landing pela primeira vez não precisa de nenhum deles. A landing
 * fica estática porque é ELA que precisa aparecer rápido.
 */
const AuthGate    = lazy(() => import('./AuthGate'))
const TrainerView = lazy(() => import('./rise/pages/TrainerView').then(m => ({ default: m.TrainerView })))

/** Token do link do treinador, lido uma vez — a rota não muda durante a sessão. */
const coachToken = new URLSearchParams(window.location.search).get('coach')

/** De onde a pessoa veio. Gravado antes de qualquer render para não perder o
 *  parâmetro se ela navegar dentro da landing. */
captureAttribution()

const maybeReturningUser = hasStoredSession()

// Só vale sondar o IndexedDB quando o palpite síncrono não teve nada em que se
// apoiar. Quem saiu de propósito ('0') deixou o banco do Firebase para trás e
// seria mandado de volta para dentro do app sem ter pedido.
const shouldProbe = !maybeReturningUser && sessionFlag() === null

type View = 'landing' | 'login' | 'register' | 'app'

export default function App() {
  // Quem já entrou neste navegador vai direto para o app: mandá-lo para a
  // landing e só depois descobrir que há sessão faria a tela piscar duas vezes.
  const [view, setView] = useState<View>(maybeReturningUser ? 'app' : 'landing')

  // Referência estável: o AuthGate usa isto dentro de um efeito, e uma função
  // nova a cada render o faria disparar de novo sem motivo.
  const backToLanding = useCallback(() => setView('landing'), [])

  // Rede de segurança para a conta antiga cujo bilhete de sessão se perdeu: a
  // landing já está pintada quando isto roda, e só carrega o app de verdade se
  // houver mesmo um banco de sessão do Firebase neste navegador.
  useEffect(() => {
    if (!shouldProbe) return
    let alive = true
    probeFirebaseSession().then(has => {
      if (alive && has) setView(v => (v === 'landing' ? 'app' : v))
    })
    return () => { alive = false }
  }, [])

  // Antes de qualquer coisa: o link do treinador é uma rota pública.
  if (coachToken) {
    return (
      <Suspense fallback={<Splash />}>
        <TrainerView token={coachToken} />
      </Suspense>
    )
  }

  if (view === 'landing') {
    return <Landing onEnter={mode => setView(mode)} />
  }

  return (
    <Suspense fallback={<Splash />}>
      <AuthGate
        initialMode={view === 'app' ? 'login' : view}
        onSignedOut={backToLanding}
        onBack={view === 'app' ? undefined : backToLanding}
      />
    </Suspense>
  )
}
