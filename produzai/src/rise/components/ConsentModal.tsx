// Shown to users who authenticated via Google (or any provider that bypasses
// the registration form) before they have a recorded consent timestamp.
// Blocks access to the app until the user explicitly accepts.

import { useState } from 'react';
import { T, C, safeInset } from '../data';
import { useDialog } from '../useDialog';
import { useAuthStore } from '../../store/useAuthStore';

export function ConsentModal() {
  const { acceptConsent, logout } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  async function handleAccept() {
    setSaving(true);
    try {
      await acceptConsent();
    } finally {
      setSaving(false);
    }
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
        paddingTop:    safeInset('top', 20),
        paddingBottom: safeInset('bottom', 20),
        paddingLeft:   safeInset('left', 16),
        paddingRight:  safeInset('right', 16),
      }}
    >
      <div style={{ width: '100%', maxWidth: 500 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: T.radius.xl,
              background: C.orange,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: T.text['6xl'],
              margin: '0 auto 12px',
            }}
          >
            <img className="rise-brand rise-brand--mark" src="/rise-mark.png" alt="" style={{ width: 46, display: "block" }} />
          </div>
          <div style={{ fontSize: T.text['4xl'], fontWeight: T.weight.extrabold, color: C.text }}>
            The Rise Plan
          </div>
        </div>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: T.radius['4xl'],
            padding: 'clamp(20px, 6vw, 28px)',
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: T.weight.extrabold,
              color: C.text,
              marginBottom: 8,
            }}
          >
            Antes de continuar
          </div>
          <div
            style={{
              fontSize: T.text.md,
              color: C.muted,
              lineHeight: 1.65,
              marginBottom: 20,
            }}
          >
            O The Rise Plan armazena dados pessoais sensíveis de saúde — peso,
            treinos, dieta, humor e fotos de progresso. A LGPD exige que você
            saiba isso e dê seu consentimento explícito antes de usar o serviço.
          </div>

          {/* Summary cards */}
          {[
            {
              icon: '📋',
              title: 'O que coletamos',
              text: 'E-mail, nome, treinos, dieta, hábitos, humor, energia, peso e fotos de progresso.',
            },
            {
              icon: '🎯',
              title: 'Por quê',
              text: 'Exclusivamente para prestar o serviço de coaching personalizado. Não vendemos seus dados.',
            },
            {
              icon: '🔒',
              title: 'Base legal (LGPD)',
              text: 'Consentimento explícito (art. 7º, I e art. 11, I) para dados de saúde e biométricos.',
            },
            {
              icon: '⚙️',
              title: 'Seus direitos',
              text: 'Acesso, correção, portabilidade (CSV), revogação do consentimento e exclusão total da conta.',
            },
          ].map(({ icon, title, text }) => (
            <div
              key={title}
              style={{
                display: 'flex',
                gap: 12,
                marginBottom: 14,
                background: C.card2,
                border: `1px solid ${C.border}`,
                borderRadius: T.radius.lg,
                padding: '12px 14px',
              }}
            >
              <span style={{ fontSize: T.text['3xl'], flexShrink: 0, marginTop: 1 }}>
                {icon}
              </span>
              <div>
                <div
                  style={{
                    fontSize: T.text.base,
                    fontWeight: T.weight.bold,
                    color: C.text,
                    marginBottom: 2,
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.55 }}>
                  {text}
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => setPolicyOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: C.orange,
              cursor: 'pointer',
              fontSize: T.text.base,
              padding: 0,
              marginBottom: 20,
              textDecoration: 'underline',
            }}
          >
            Ler a Política de Privacidade completa
          </button>

          <button
            onClick={handleAccept}
            disabled={saving}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: T.radius.lg,
              border: 'none',
              background: saving ? C.border2 : C.orange,
              color: '#fff',
              fontSize: T.text.xl,
              fontWeight: T.weight.bold,
              cursor: saving ? 'not-allowed' : 'pointer',
              marginBottom: 12,
              transition: 'background .15s',
            }}
          >
            {saving ? 'Salvando...' : 'Aceitar e entrar no app'}
          </button>

          <button
            onClick={() => logout()}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: T.radius.lg,
              border: `1px solid ${C.border2}`,
              background: 'transparent',
              color: C.muted,
              fontSize: T.text.md,
              cursor: 'pointer',
            }}
          >
            Não aceitar — sair da conta
          </button>
        </div>

        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: T.text.sm,
            color: C.muted,
            lineHeight: 1.6,
          }}
        >
          Controlador: The Rise Plan — contato:{' '}
          <span style={{ color: C.text }}>privacidade@therisepln.com.br</span>
        </div>
      </div>

      {/* Full policy overlay */}
      {policyOpen && <PolicyOverlay onClose={() => setPolicyOpen(false)} />}
    </div>
  );
}

// ── Full privacy policy overlay ───────────────────────────────────────────────

export function PolicyOverlay({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog(true, onClose);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.85)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop:    safeInset('top', 16),
        paddingBottom: safeInset('bottom', 16),
        paddingLeft:   safeInset('left', 16),
        paddingRight:  safeInset('right', 16),
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Política de privacidade"
        tabIndex={-1}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: T.radius['3xl'],
          width: '100%',
          maxWidth: 600,
          maxHeight: 'calc(100dvh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: T.weight.extrabold, fontSize: T.text.xl }}>
            Política de Privacidade
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.muted,
              fontSize: T.text['4xl'],
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            overflowY: 'auto',
            padding: '20px',
            fontSize: T.text.base,
            color: C.muted,
            lineHeight: 1.75,
          }}
        >
          <PrivacyPolicyText />
        </div>
      </div>
    </div>
  );
}

// ── Policy text ───────────────────────────────────────────────────────────────
// Customize: replace placeholders marked with [COLCHETES] before publishing.

export function PrivacyPolicyText() {
  const h2: React.CSSProperties = {
    fontSize: T.text.md,
    fontWeight: T.weight.bold,
    color: C.text,
    marginTop: 20,
    marginBottom: 6,
  };
  const p: React.CSSProperties = { marginBottom: 10 };

  return (
    <div>
      <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 16 }}>
        Última atualização: junho de 2026 · Versão 1.0
      </div>

      <p style={p}>
        <strong style={{ color: C.text }}>Controlador de dados:</strong> The
        Rise Plan, CNPJ 59.254.122/0001-37, com sede em São Paulo - SP.
        Encarregado de Dados (DPO):{' '}
        <span style={{ color: C.orange }}>riseplan@gmail.com</span>
      </p>

      <h2 style={h2}>1. Dados coletados</h2>
      <p style={p}>
        Coletamos os seguintes dados pessoais, incluindo dados sensíveis de
        saúde (art. 5º, II da LGPD):
      </p>
      <ul style={{ paddingLeft: 18, marginBottom: 10 }}>
        <li>
          <strong style={{ color: C.text }}>Cadastrais:</strong> nome, e-mail,
          foto de perfil
        </li>
        <li>
          <strong style={{ color: C.text }}>Saúde e biometria:</strong> peso,
          fotos de progresso físico, treinos realizados (distância, calorias,
          tempo), observações e dor relatada nos treinos, plano alimentar,
          macronutrientes consumidos
        </li>
        <li>
          <strong style={{ color: C.text }}>Ciclo menstrual (opcional):</strong>{' '}
          datas de início da menstruação e duração do ciclo — coletadas apenas se
          você ligar o acompanhamento no Perfil, e apagadas ao desligá-lo
        </li>
        <li>
          <strong style={{ color: C.text }}>Comportamentais:</strong> hábitos
          diários, metas de foco, humor e energia (escala 1-5), anotações de
          gratidão e reflexão
        </li>
        <li>
          <strong style={{ color: C.text }}>Uso da plataforma:</strong>{' '}
          projetos, livros, hidratação, histórico de conversas com o Coach
        </li>
      </ul>

      <h2 style={h2}>2. Finalidade e base legal</h2>
      <p style={p}>
        Os dados são tratados{' '}
        <strong style={{ color: C.text }}>exclusivamente</strong> para prestação
        do serviço de coaching personalizado de saúde, performance e
        desenvolvimento pessoal.
      </p>
      <p style={p}>
        Base legal: <strong style={{ color: C.text }}>consentimento</strong> do
        titular (art. 7º, I e art. 11, I da Lei 13.709/2018 — LGPD), obtido de
        forma livre, específica, informada e inequívoca no momento do cadastro.
      </p>
      <p style={p}>
        Não tratamos seus dados para publicidade, perfilamento externo ou tomada
        de decisão automatizada com efeitos jurídicos.
      </p>

      <h2 style={h2}>3. Compartilhamento</h2>
      <p style={p}>
        Seus dados <strong style={{ color: C.text }}>não são vendidos</strong>.
        São compartilhados apenas com:
      </p>
      <ul style={{ paddingLeft: 18, marginBottom: 10 }}>
        <li>
          <strong style={{ color: C.text }}>Anthropic Inc.</strong> —
          processamento de IA (respostas do Coach). Sujeito à política de
          privacidade da Anthropic.
        </li>
        <li>
          <strong style={{ color: C.text }}>Google LLC (Firebase)</strong> —
          armazenamento de dados e autenticação. Sujeito à política do Google
          Cloud.
        </li>
      </ul>
      <p style={p}>
        Todos os operadores estão contratualmente obrigados a proteger seus
        dados.
      </p>
      <p style={p}>
        Se você gerar um{' '}
        <strong style={{ color: C.text }}>link para o treinador</strong> no
        Perfil, um resumo dos seus últimos 14 dias (treinos, observações e dor,
        prontidão, hidratação e adesão à dieta) fica acessível a qualquer pessoa
        que tenha o endereço, sem senha. O compartilhamento parte só de você e
        pode ser revogado a qualquer momento — dados do ciclo menstrual nunca
        entram nesse resumo.
      </p>

      <h2 style={h2}>4. Retenção</h2>
      <p style={p}>
        Os dados ficam armazenados enquanto a conta estiver ativa. Após a
        exclusão da conta, todos os dados são eliminados permanentemente dos
        servidores. Backups do Firebase podem reter cópias por até 30 dias
        adicionais.
      </p>

      <h2 style={h2}>5. Seus direitos (art. 18 da LGPD)</h2>
      <ul style={{ paddingLeft: 18, marginBottom: 10 }}>
        <li>
          <strong style={{ color: C.text }}>Acesso:</strong> solicite um resumo
          dos dados que guardamos
        </li>
        <li>
          <strong style={{ color: C.text }}>Correção:</strong> edite seu perfil
          diretamente no app
        </li>
        <li>
          <strong style={{ color: C.text }}>Portabilidade:</strong> exporte
          todos os seus dados via "Exportar CSV" no Coach
        </li>
        <li>
          <strong style={{ color: C.text }}>Eliminação:</strong> exclua sua
          conta e todos os dados em Perfil → "Excluir minha conta"
        </li>
        <li>
          <strong style={{ color: C.text }}>Revogação do consentimento:</strong>{' '}
          exclua sua conta a qualquer momento, sem prejuízo
        </li>
        <li>
          <strong style={{ color: C.text }}>Reclamação:</strong> você pode
          reclamar à ANPD (gov.br/anpd)
        </li>
      </ul>

      <h2 style={h2}>6. Segurança</h2>
      <p style={p}>
        Dados em trânsito são protegidos por TLS/HTTPS. No repouso, utilizamos a
        infraestrutura de segurança do Firebase (Google). Chaves de API e
        credenciais são mantidas no servidor, nunca expostas ao navegador.
      </p>

      <h2 style={h2}>7. Contato</h2>
      <p style={p}>
        Para exercer seus direitos ou esclarecer dúvidas, entre em contato com
        nosso DPO:
        <span style={{ color: C.orange }}> privacidade@therisepln.com.br</span>
      </p>
    </div>
  );
}
