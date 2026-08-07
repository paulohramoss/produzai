import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'

// O Analytics fica fora do <App /> de propósito: assim ele também mede a tela
// de carregamento e a de login, que ficam antes da autenticação resolver.
// Em desenvolvimento o pacote não envia nada — só registra no console.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
