import {
  Dumbbell, Utensils, Bot, ArrowRight, Check, Trophy, Users, ShoppingCart,
} from 'lucide-react'
import { T, C, displayStyle, safeInset } from '../data'
import { useIsMobile } from '../../lib/useIsMobile'
import { getAttribution } from '../../lib/attribution'
import { ACTIVE_CHALLENGE, challengeWindow } from '../../lib/challenge'

/**
 * Porta de entrada pública — a única página que existe antes do login.
 *
 * Vende benefício, não módulo: cada bloco responde "o que muda pra mim",
 * e o app inteiro fica atrás de um único botão. Três portas, não doze —
 * a profundidade é recompensa por ficar, não pedágio para entrar.
 */

interface Props {
  onEnter: (mode: 'login' | 'register') => void
}

const PILLARS = [
  {
    icon: Dumbbell,
    color: C.running,
    title: 'Sua próxima carga não precisa ser um chute',
    body: 'O app acompanha cada série e devolve o peso da próxima sessão com base no que você levantou de verdade — progressão calculada, não achismo.',
  },
  {
    icon: Utensils,
    color: C.green,
    title: 'Você já sabe o que comer. Falta o que comprar',
    body: 'Suas refeições viram lista de compras da semana, agrupada por setor do mercado. Abre no sábado, compra certo, come certo a semana toda.',
  },
  {
    icon: Bot,
    color: C.purple,
    title: 'Um treinador que leu seu histórico inteiro',
    body: 'Sono ruim, dor no ombro, semana pesada: o coach cruza treino, dieta e humor antes de responder — e avisa quando é dia de pegar leve.',
  },
]

const PROOF = [
  { icon: Trophy,       label: 'Desafios com data pra acabar e prêmio de verdade' },
  { icon: Users,        label: 'Clube privado com os seus — sem feed, sem estranho' },
  { icon: ShoppingCart, label: 'Lista de compras gerada da sua própria dieta' },
]

export function Landing({ onEnter }: Props) {
  const isMobile = useIsMobile()
  const attribution = getAttribution()
  const invitedBy = attribution?.ref
  const window_ = challengeWindow(ACTIVE_CHALLENGE)

  const pad = isMobile ? 20 : 32

  return (
    <div style={{
      background: C.bg,
      color: C.text,
      minHeight: '100dvh',
      fontFamily: 'system-ui, sans-serif',
      paddingTop:    safeInset('top', 0),
      paddingBottom: safeInset('bottom', 0),
      paddingLeft:   safeInset('left', 0),
      paddingRight:  safeInset('right', 0),
    }}>
      {/* ── Barra de topo ─────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: `16px ${pad}px`, maxWidth: 1080, margin: '0 auto',
      }}>
        <img
          className="rise-brand"
          src="/rise-logo.png"
          alt="The Rise Plan"
          style={{ height: 42 }}
        />
        <button
          onClick={() => onEnter('login')}
          style={{
            background: 'transparent', border: `1px solid ${C.border2}`,
            borderRadius: T.radius.pill, padding: '8px 18px', color: C.text,
            fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: 'pointer',
          }}
        >
          Entrar
        </button>
      </header>

      {/* ── Convite de um amigo ───────────────────────────────────────────── */}
      {invitedBy && (
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: `0 ${pad}px` }}>
          <div style={{
            background: C.od, border: `1px solid ${C.orange}44`,
            borderRadius: T.radius.lg, padding: '10px 16px',
            fontSize: T.text.md, color: C.orange, textAlign: 'center',
          }}>
            🤝 Você foi convidado por um atleta (código <strong>{invitedBy}</strong>) — ao criar
            a conta vocês entram no mesmo clube.
          </div>
        </div>
      )}

      {/* ── Herói ─────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 860, margin: '0 auto', padding: `${isMobile ? 40 : 72}px ${pad}px ${isMobile ? 36 : 56}px`,
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: C.card2, border: `1px solid ${C.border2}`,
          borderRadius: T.radius.pill, padding: '6px 14px', marginBottom: 24,
          fontSize: T.text.sm, color: C.muted2,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />
          Treino, dieta e cabeça no mesmo lugar
        </div>

        <h1 style={{
          fontSize: isMobile ? 34 : 56,
          lineHeight: 1.08,
          fontWeight: T.weight.extrabold,
          margin: '0 0 20px',
          ...displayStyle,
        }}>
          Pare de treinar<br />
          <span style={{ color: C.orange }}>no escuro.</span>
        </h1>

        <p style={{
          fontSize: isMobile ? T.text['3xl'] : T.text['5xl'],
          color: C.muted2, lineHeight: 1.55, margin: '0 auto 32px', maxWidth: 620,
        }}>
          Todo mundo registra treino. Quase ninguém sabe o que fazer com o registro.
          O The Rise Plan transforma o seu histórico em decisão: qual carga puxar hoje,
          o que comprar no mercado e quando descansar.
        </p>

        <div style={{
          display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          marginBottom: 18,
        }}>
          <button
            onClick={() => onEnter('register')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: C.orange, border: 'none', borderRadius: T.radius.lg,
              padding: '15px 30px', color: '#fff',
              fontSize: T.text['3xl'], fontWeight: T.weight.bold, cursor: 'pointer',
            }}
          >
            Começar hoje — é grátis <ArrowRight size={18} />
          </button>
        </div>
        <div style={{ fontSize: T.text.md, color: C.muted }}>
          Leva 3 telas. Sem cartão, sem cobrança.
        </div>
      </section>

      {/* ── Três portas ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: `0 ${pad}px ${isMobile ? 40 : 64}px` }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {PILLARS.map(({ icon: Icon, color, title, body }) => (
            <div key={title} style={{
              background: `linear-gradient(180deg, #181818 0%, ${C.card} 58%)`,
              border: `1px solid ${C.border}`,
              borderRadius: T.radius['2xl'],
              borderTop: `2px solid ${color}`,
              padding: 24,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: T.radius.lg,
                background: `${color}1F`, display: 'flex',
                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <Icon size={20} color={color} />
              </div>
              <div style={{
                fontSize: T.text['3xl'], fontWeight: T.weight.bold,
                lineHeight: 1.3, marginBottom: 10, ...displayStyle,
              }}>
                {title}
              </div>
              <div style={{ fontSize: T.text.xl, color: C.muted2, lineHeight: 1.6 }}>
                {body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Desafio em cartaz ─────────────────────────────────────────────── */}
      {window_.state !== 'ended' && (
        <section style={{ maxWidth: 1080, margin: '0 auto', padding: `0 ${pad}px ${isMobile ? 40 : 64}px` }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.orange}22 0%, ${C.card} 65%)`,
            border: `1px solid ${C.orange}44`,
            borderRadius: T.radius['2xl'],
            padding: isMobile ? 24 : 36,
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center', gap: 24,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: T.text.sm, color: C.orange, fontWeight: T.weight.bold,
                letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
              }}>
                {window_.state === 'upcoming' ? 'Começa em breve' : 'Acontecendo agora'}
              </div>
              <div style={{
                fontSize: isMobile ? T.text['6xl'] : 30, fontWeight: T.weight.extrabold,
                marginBottom: 10, ...displayStyle,
              }}>
                {ACTIVE_CHALLENGE.name}
              </div>
              <div style={{ fontSize: T.text.xl, color: C.muted2, lineHeight: 1.6 }}>
                {ACTIVE_CHALLENGE.pitch} Placar próprio, data pra acabar e{' '}
                <strong style={{ color: C.text }}>{ACTIVE_CHALLENGE.prize}</strong> para quem
                terminar no topo.
              </div>
            </div>
            <button
              onClick={() => onEnter('register')}
              style={{
                background: C.orange, border: 'none', borderRadius: T.radius.lg,
                padding: '14px 26px', color: '#fff', whiteSpace: 'nowrap',
                fontSize: T.text['2xl'], fontWeight: T.weight.bold, cursor: 'pointer',
              }}
            >
              Entrar no desafio
            </button>
          </div>
        </section>
      )}

      {/* ── O que vem junto ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: `0 ${pad}px ${isMobile ? 40 : 64}px` }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {PROOF.map(({ icon: Icon, label }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: T.radius.lg, padding: '16px 18px',
            }}>
              <Icon size={18} color={C.orange} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: T.text.lg, color: C.muted2, lineHeight: 1.45 }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Como começa ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: `0 ${pad}px ${isMobile ? 44 : 72}px` }}>
        <div style={{
          fontSize: isMobile ? T.text['6xl'] : 30, fontWeight: T.weight.extrabold,
          textAlign: 'center', marginBottom: 28, ...displayStyle,
        }}>
          Do zero ao primeiro treino em 3 telas
        </div>
        {[
          'Diz o seu objetivo — perder peso, ganhar massa, ter energia.',
          'Confere as metas que o app calcula a partir do seu corpo.',
          'Escolhe os hábitos que quer sustentar. Pronto, já dá pra treinar.',
        ].map((step, i) => (
          <div key={i} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            padding: '14px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: C.od,
              border: `1px solid ${C.orange}55`, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: T.text.base, fontWeight: T.weight.bold, color: C.orange,
            }}>
              {i + 1}
            </div>
            <div style={{ fontSize: T.text.xl, color: C.muted2, lineHeight: 1.55 }}>{step}</div>
          </div>
        ))}
        <div style={{
          marginTop: 22, display: 'flex', alignItems: 'center', gap: 8,
          fontSize: T.text.md, color: C.muted,
        }}>
          <Check size={15} color={C.green} />
          O resto (dieta, mental, projetos, biblioteca) aparece quando você precisar.
        </div>
      </section>

      {/* ── Chamada final ─────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 720, margin: '0 auto', padding: `0 ${pad}px ${isMobile ? 48 : 80}px`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: isMobile ? 28 : 38, fontWeight: T.weight.extrabold,
          lineHeight: 1.15, marginBottom: 16, ...displayStyle,
        }}>
          O treino de amanhã já está no seu histórico.
        </div>
        <p style={{ fontSize: T.text['3xl'], color: C.muted2, lineHeight: 1.6, marginBottom: 28 }}>
          Falta alguém ler pra você.
        </p>
        <button
          onClick={() => onEnter('register')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: C.orange, border: 'none', borderRadius: T.radius.lg,
            padding: '15px 32px', color: '#fff',
            fontSize: T.text['3xl'], fontWeight: T.weight.bold, cursor: 'pointer',
          }}
        >
          Criar minha conta <ArrowRight size={18} />
        </button>
        <div style={{ marginTop: 16, fontSize: T.text.md, color: C.muted }}>
          Já tem conta?{' '}
          <button
            onClick={() => onEnter('login')}
            style={{
              background: 'none', border: 'none', color: C.orange, cursor: 'pointer',
              fontSize: T.text.md, fontWeight: T.weight.bold, padding: 0,
            }}
          >
            Entrar
          </button>
        </div>
      </section>

      {/* ── Rodapé ────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`, padding: `24px ${pad}px`,
        textAlign: 'center', fontSize: T.text.md, color: C.muted,
      }}>
        The Rise Plan · Seus dados ficam isolados por conta, conforme a LGPD.
      </footer>
    </div>
  )
}
