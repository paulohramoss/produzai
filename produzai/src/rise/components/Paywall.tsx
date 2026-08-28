// Tela de assinatura — o portão entre a conta criada e o app.
//
// Ela BLOQUEIA a interface, mas não é ela que protege o produto: quem protege
// são as regras do Firestore (negam escrita a quem não está em dia) e os
// endpoints de IA (respondem 402). Aqui é só a versão da mesma decisão que o
// usuário consegue ler e resolver.
//
// O pagamento acontece na página de fatura do Asaas, aberta em outra aba: PIX,
// cartão e boleto na mesma tela, e nenhum dado de cartão passando por nós.

import { useState, useEffect, useRef } from 'react'
import { T, C, safeInset } from '../data'
import { useAuthStore } from '../../store/useAuthStore'
import { useBillingStore, priceOf } from '../../store/useBillingStore'
import { startCheckout, maskDocument, maskPhone, isValidDocument } from '../../lib/billing'

const BENEFITS = [
  { icon: '🏋️', title: 'Treino e dieta em um lugar só', text: 'Plano da semana, registro de treinos, macros e lista de compras.' },
  { icon: '🤖', title: 'Coach com IA', text: 'Ajuste de plano, análise dos seus dados e resposta a qualquer hora.' },
  { icon: '📈', title: 'Progresso medido', text: 'Prontidão, carga de treino, streaks, fotos e histórico completo.' },
  { icon: '🔁', title: 'Sem fidelidade', text: 'Mensal. Cancele quando quiser, direto no Perfil.' },
]

export function Paywall() {
  const { user, displayName, logout } = useAuthStore()
  const view    = useBillingStore(s => s.view)
  const refresh = useBillingStore(s => s.refresh)
  const poll    = useBillingStore(s => s.poll)
  const loading = useBillingStore(s => s.loading)

  const [name,    setName]    = useState(displayName || user?.displayName || '')
  const [doc,     setDoc]     = useState('')
  const [phone,   setPhone]   = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)

  // A consulta em andamento é interrompida ao sair da tela: quando o pagamento
  // entra, este componente desmonta, e um timer sobrevivente continuaria batendo
  // no servidor pelo resto da sessão.
  const stopPoll = useRef<(() => void) | null>(null)
  useEffect(() => () => stopPoll.current?.(), [])

  const price = priceOf(view)
  const unavailable = view?.reason === 'unavailable' || view?.reason === 'offline'

  async function handleSubscribe() {
    setError(null)

    if (!name.trim() || name.trim().split(/\s+/).length < 2) {
      return setError('Informe seu nome completo, como no documento.')
    }
    if (!isValidDocument(doc)) {
      return setError('CPF ou CNPJ inválido. Confira os números.')
    }

    setBusy(true)
    const result = await startCheckout({
      name: name.trim(),
      cpfCnpj: doc.replace(/\D/g, ''),
      phone: phone.replace(/\D/g, ''),
    })
    setBusy(false)

    if (!result.ok) return setError(result.error)
    if ('alreadyActive' in result) return void refresh()

    // A aba nova é aberta na MESMA ação do clique — o navegador bloqueia popup
    // aberto depois de um await se o clique não estiver mais "quente"; por isso
    // o link também fica visível abaixo, como saída manual.
    window.open(result.invoiceUrl, '_blank', 'noopener,noreferrer')
    setWaiting(true)
    stopPoll.current?.()
    stopPoll.current = poll()
  }

  const input: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: T.radius.lg,
    border: `1px solid ${C.border2}`,
    background: C.card2,
    color: C.text,
    fontSize: T.text.md,
    marginBottom: 10,
    boxSizing: 'border-box',
  }

  return (
    <div
      className="rise-screen"
      style={{
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        overflowY: 'auto',
        paddingTop:    safeInset('top', 20),
        paddingBottom: safeInset('bottom', 20),
        paddingLeft:   safeInset('left', 16),
        paddingRight:  safeInset('right', 16),
      }}
    >
      <div style={{ width: '100%', maxWidth: 500, margin: 'auto' }}>
        {/* Marca */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: T.radius.xl, background: C.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <img className="rise-brand rise-brand--mark" src="/rise-mark.png" alt="" style={{ width: 46, display: 'block' }} />
          </div>
          <div style={{ fontSize: T.text['4xl'], fontWeight: T.weight.extrabold, color: C.text }}>
            The Rise Plan
          </div>
        </div>

        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: T.radius['4xl'],
          padding: 'clamp(20px, 6vw, 28px)',
        }}>
          {/* Preço */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 4 }}>
              Acesso completo
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: T.text.xl, color: C.muted }}>R$</span>
              <span style={{ fontSize: 44, fontWeight: T.weight.extrabold, color: C.text, lineHeight: 1 }}>
                {price}
              </span>
              <span style={{ fontSize: T.text.md, color: C.muted }}>/mês</span>
            </div>
          </div>

          {/* Situação atual, quando ela explica alguma coisa */}
          <StatusNote view={view} unavailable={unavailable} />

          {/* Benefícios */}
          {BENEFITS.map(({ icon, title, text }) => (
            <div key={title} style={{
              display: 'flex', gap: 12, marginBottom: 10,
              background: C.card2, border: `1px solid ${C.border}`,
              borderRadius: T.radius.lg, padding: '11px 13px',
            }}>
              <span style={{ fontSize: T.text['2xl'], flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <div>
                <div style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.text, marginBottom: 2 }}>
                  {title}
                </div>
                <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.5 }}>{text}</div>
              </div>
            </div>
          ))}

          {/* Dados de cobrança — o Asaas exige documento para emitir a cobrança */}
          <div style={{ marginTop: 18 }}>
            <label style={{ fontSize: T.text.sm, color: C.muted, display: 'block', marginBottom: 6 }}>
              Nome completo
            </label>
            <input
              style={input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Como no documento"
              autoComplete="name"
            />

            <label style={{ fontSize: T.text.sm, color: C.muted, display: 'block', marginBottom: 6 }}>
              CPF ou CNPJ
            </label>
            <input
              style={input}
              value={doc}
              onChange={e => setDoc(maskDocument(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />

            <label style={{ fontSize: T.text.sm, color: C.muted, display: 'block', marginBottom: 6 }}>
              Celular <span style={{ opacity: .7 }}>(opcional)</span>
            </label>
            <input
              style={{ ...input, marginBottom: 4 }}
              value={phone}
              onChange={e => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 90000-0000"
              inputMode="tel"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.35)',
              borderRadius: T.radius.lg, padding: '10px 12px', marginTop: 12,
              fontSize: T.text.base, color: '#FCA5A5', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={busy || unavailable}
            style={{
              width: '100%', padding: 14, marginTop: 16,
              borderRadius: T.radius.lg, border: 'none',
              background: (busy || unavailable) ? C.border2 : C.orange,
              color: '#fff', fontSize: T.text.xl, fontWeight: T.weight.bold,
              cursor: (busy || unavailable) ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {busy
              ? 'Gerando cobrança...'
              : view?.hasSubscription ? 'Abrir minha fatura' : `Assinar por R$ ${price}/mês`}
          </button>

          <div style={{
            fontSize: T.text.sm, color: C.muted, textAlign: 'center',
            marginTop: 10, lineHeight: 1.6,
          }}>
            PIX, cartão de crédito ou boleto — você escolhe na próxima tela.
            <br />O pagamento é processado pelo Asaas; não guardamos dados do seu cartão.
          </div>

          {waiting && (
            <div style={{
              background: C.card2, border: `1px solid ${C.border2}`,
              borderRadius: T.radius.lg, padding: '12px 14px', marginTop: 14,
              fontSize: T.text.base, color: C.muted, lineHeight: 1.6, textAlign: 'center',
            }}>
              Estamos aguardando a confirmação do pagamento. O PIX costuma cair em
              segundos; boleto pode levar até 3 dias úteis.
            </div>
          )}

          <button
            onClick={() => refresh()}
            disabled={loading}
            style={{
              width: '100%', padding: 11, marginTop: 12,
              borderRadius: T.radius.lg, border: `1px solid ${C.border2}`,
              background: 'transparent', color: C.text,
              fontSize: T.text.md, cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Verificando...' : 'Já paguei — verificar agora'}
          </button>

          <button
            onClick={() => logout()}
            style={{
              width: '100%', padding: 11, marginTop: 8,
              borderRadius: T.radius.lg, border: 'none',
              background: 'transparent', color: C.muted,
              fontSize: T.text.md, cursor: 'pointer',
            }}
          >
            Sair da conta
          </button>
        </div>

        <div style={{
          textAlign: 'center', marginTop: 14, fontSize: T.text.sm,
          color: C.muted, lineHeight: 1.6,
        }}>
          Cobrança mensal recorrente de R$ {price},00. Cancele quando quiser.
          <br />Dúvidas: <span style={{ color: C.text }}>riseplan@gmail.com</span>
        </div>
      </div>
    </div>
  )
}

/** A faixa que explica por que a pessoa está vendo esta tela — quando há o que explicar. */
function StatusNote({ view, unavailable }: { view: ReturnType<typeof useBillingStore.getState>['view']; unavailable: boolean }) {
  if (unavailable) {
    return (
      <Note tone="warn">
        Não conseguimos falar com o sistema de cobrança agora. Tente novamente em
        alguns minutos — nenhuma cobrança foi feita.
      </Note>
    )
  }
  if (view?.status === 'overdue') {
    return (
      <Note tone="warn">
        Sua última fatura está em atraso. Assim que o pagamento for confirmado, o
        acesso volta automaticamente.
      </Note>
    )
  }
  if (view?.status === 'pending' && view.hasSubscription) {
    return (
      <Note tone="info">
        Sua cobrança já foi gerada e está aguardando pagamento.
      </Note>
    )
  }
  // Cancelada com período ainda válido não passa por aqui: o Paywall só existe
  // quando o servidor já disse que NÃO há acesso.
  if (view?.status === 'canceled' || view?.reason === 'expired') {
    return (
      <Note tone="info">
        Seu acesso expirou. Reative a assinatura para continuar de onde parou —
        seus dados continuam salvos.
      </Note>
    )
  }
  return null
}

function Note({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  const warn = tone === 'warn'
  return (
    <div style={{
      background: warn ? 'rgba(245,158,11,.12)' : C.card2,
      border: `1px solid ${warn ? 'rgba(245,158,11,.35)' : C.border}`,
      borderRadius: T.radius.lg,
      padding: '11px 13px',
      marginBottom: 14,
      fontSize: T.text.base,
      color: warn ? '#FCD34D' : C.muted,
      lineHeight: 1.55,
    }}>
      {children}
    </div>
  )
}
