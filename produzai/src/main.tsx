import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './lib/appUpdate'

// Liga as folhas de estilo que o index.html deixou em `media="print"` para não
// bloquear a primeira pintura (as fontes do Google). Fica aqui, num módulo
// externo, porque um `onload` inline no HTML seria script inline — a primeira
// coisa que uma CSP decente recusa.
for (const link of document.querySelectorAll<HTMLLinkElement>('link[data-deferred-style]')) {
  link.media = 'all'
}

// Vigia de versão: fora do React de propósito — não depende de nenhuma tela
// estar montada e precisa continuar valendo na tela de login e no splash.
watchForUpdates()

// O Analytics fica fora do <App /> de propósito: assim ele também mede a tela
// de carregamento e a de login, que ficam antes da autenticação resolver.
// Em desenvolvimento o pacote não envia nada — só registra no console.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
