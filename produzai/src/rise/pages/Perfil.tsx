import { useState, useRef, useContext, useEffect } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../lib/firebase'
import { useAuthStore } from '../../store/useAuthStore'
import { toast } from '../../lib/toast'
import { T, C, type Page, displayStyle } from '../data'
import { User } from 'lucide-react'
import { Card } from '../primitives'
import { LayoutContext } from '../LayoutContext'
import { PolicyOverlay } from '../components/ConsentModal'
import { getStravaStatus, goToStravaConnect, disconnectStrava, type StravaStatus } from '../../lib/strava'

interface Props { setPage: (p: Page) => void }

const inp: React.CSSProperties = {
  width: '100%', background: '#1C1C1C', border: `1px solid ${C.border2}`,
  borderRadius: T.radius.md, padding: '11px 14px', color: C.text,
  fontSize: T.text.lg, outline: 'none', boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  fontSize: T.text.sm, color: C.muted, display: 'block',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
        {title}
      </div>
      {children}
    </Card>
  )
}

export function Perfil({ setPage }: Props) {
  const { isMobile } = useContext(LayoutContext)
  const { user, displayName: storedName, photoURL: storedPhoto, updateProfileData, changePassword, deleteAccount, logout } = useAuthStore()

  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName]           = useState(storedName || user?.displayName || '')
  const [savingName, setSavingName] = useState(false)

  const [photoUploading, setPhotoUploading] = useState(false)
  const [previewURL, setPreviewURL]         = useState<string | null>(null)

  const [curPass, setCurPass]   = useState('')
  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [showCur, setShowCur]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  // ── Account deletion state ─────────────────────────────────────────────────
  const [deleteStep, setDeleteStep]   = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deletePass, setDeletePass]   = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [policyOpen, setPolicyOpen]   = useState(false)

  // ── Strava ──────────────────────────────────────────────────────────────────
  const [stravaStatus, setStravaStatus]   = useState<StravaStatus>({ connected: false })
  const [stravaLoading, setStravaLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    getStravaStatus().then(s => { setStravaStatus(s); setStravaLoading(false) })
  }, [])

  async function handleDisconnectStrava() {
    setDisconnecting(true)
    const ok = await disconnectStrava()
    setDisconnecting(false)
    if (ok) {
      setStravaStatus({ connected: false })
      toast.success('Strava desconectado')
    } else {
      toast.error('Erro ao desconectar do Strava')
    }
  }

  const isEmailUser  = user?.providerData.some(p => p.providerId === 'password') ?? false
  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com') ?? false

  const avatarURL = previewURL ?? storedPhoto ?? user?.photoURL ?? null
  const initials  = (storedName || user?.displayName || user?.email || 'U')[0].toUpperCase()

  // ── Save name ──────────────────────────────────────────────────────────────
  async function handleSaveName() {
    if (!name.trim() || name.trim() === (storedName ?? '')) return
    setSavingName(true)
    try {
      await updateProfileData({ displayName: name.trim() })
      toast.success('✅ Nome atualizado!')
    } catch {
      toast.error('Erro ao salvar nome')
    } finally {
      setSavingName(false)
    }
  }

  // ── Upload photo ───────────────────────────────────────────────────────────
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Máx 5MB'); return }

    setPreviewURL(URL.createObjectURL(file))
    setPhotoUploading(true)
    e.target.value = ''

    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await updateProfileData({ photoURL: url })
      toast.success('📸 Foto atualizada!')
    } catch (err) {
      console.error('Avatar upload failed:', err)
      toast.error('Erro ao enviar foto. Verifique o Firebase Storage.')
      setPreviewURL(null)
    } finally {
      setPhotoUploading(false)
    }
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    setDeleteError('')
    setDeleteStep('deleting')
    try {
      await deleteAccount(isEmailUser ? deletePass : undefined)
      // onAuthStateChanged will sign out and reset the app
    } catch (err) {
      const code = (err as { code?: string })?.code
      let msg = 'Erro ao excluir conta. Tente novamente.'
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') msg = 'Senha incorreta.'
      else if (code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde e tente de novo.'
      else if (code === 'auth/popup-closed-by-user') msg = 'Janela fechada antes de confirmar.'
      setDeleteError(msg)
      setDeleteStep('confirm')
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confPass) { toast.error('As senhas não coincidem'); return }
    if (newPass.length < 6)   { toast.error('Nova senha precisa ter pelo menos 6 caracteres'); return }
    setSavingPass(true)
    try {
      await changePassword(curPass, newPass)
      toast.success('🔑 Senha alterada com sucesso!')
      setCurPass(''); setNewPass(''); setConfPass('')
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Senha atual incorreta')
      } else if (code === 'auth/too-many-requests') {
        toast.error('Muitas tentativas. Tente mais tarde.')
      } else {
        toast.error('Erro ao alterar senha')
      }
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setPage('dashboard')}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text.md, padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 20 : 24, fontWeight: T.weight.extrabold, ...displayStyle }}><User size={20} color={C.orange} /> Meu Perfil</div>
        <div style={{ fontSize: T.text.md, color: C.muted, marginTop: 4 }}>Gerencie suas informações pessoais</div>
      </div>

      {/* ── Avatar + nome ─────────────────────────────────────────────────── */}
      <Section title="Foto e nome">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              background: C.card2, border: `2px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarURL ? (
                <img src={avatarURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 28, fontWeight: T.weight.extrabold, color: C.orange }}>{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoUploading}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: '50%',
                background: C.orange, border: `2px solid ${C.bg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: photoUploading ? 'not-allowed' : 'pointer', fontSize: T.text.base,
              }}
              title="Alterar foto"
            >
              {photoUploading ? '⏳' : '📷'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: T.text.md, color: C.muted, marginBottom: 4 }}>
              {photoUploading ? 'Enviando foto...' : 'Clique no ícone para trocar a foto'}
            </div>
            <div style={{ fontSize: T.text.sm, color: C.muted, opacity: 0.6 }}>
              JPG, PNG ou WebP · máx 5MB
            </div>
          </div>
        </div>

        {/* Name */}
        <div>
          <label style={label}>Nome de exibição</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              placeholder="Seu nome"
              style={{ ...inp, flex: 1 }}
            />
            <button
              onClick={handleSaveName}
              disabled={savingName || !name.trim() || name.trim() === (storedName ?? '')}
              style={{
                background: savingName || !name.trim() || name.trim() === (storedName ?? '') ? C.border2 : C.orange,
                border: 'none', borderRadius: T.radius.md, padding: '0 18px',
                color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold,
                cursor: savingName || !name.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {savingName ? '...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Conta ─────────────────────────────────────────────────────────── */}
      <Section title="Conta">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>E-mail</label>
            <input value={user?.email ?? ''} readOnly style={{ ...inp, color: C.muted, cursor: 'default' }} />
          </div>

          <div>
            <label style={label}>Método de login</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isGoogleUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.sm, padding: '6px 12px' }}>
                  <svg width="14" height="14" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                  <span style={{ fontSize: T.text.base, fontWeight: T.weight.semibold, color: C.text }}>Google</span>
                </div>
              )}
              {isEmailUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.sm, padding: '6px 12px' }}>
                  <span style={{ fontSize: T.text.md }}>✉️</span>
                  <span style={{ fontSize: T.text.base, fontWeight: T.weight.semibold, color: C.text }}>E-mail / Senha</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ background: `${C.green}18`, border: `1px solid ${C.green}33`, borderRadius: T.radius.sm, padding: '6px 12px', fontSize: T.text.sm, color: C.green, fontWeight: T.weight.semibold }}>
              ● Conta ativa
            </div>
            <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.sm, padding: '6px 12px', fontSize: T.text.sm, color: C.muted }}>
              UID: {user?.uid?.slice(0, 12)}...
            </div>
          </div>
        </div>
      </Section>

      {/* ── Integrações ───────────────────────────────────────────────────── */}
      <Section title="Integrações">
        {stravaLoading ? (
          <div style={{ fontSize: T.text.md, color: C.muted }}>Verificando conexão...</div>
        ) : stravaStatus.connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              background: C.card2, border: `2px solid ${C.running}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {stravaStatus.athlete?.profile ? (
                <img src={stravaStatus.athlete.profile} alt="Strava" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 20 }}>🏃</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: T.text.md, fontWeight: T.weight.bold, color: C.text }}>
                {stravaStatus.athlete?.name || 'Conta Strava'}
              </div>
              <div style={{ fontSize: T.text.sm, color: C.running, fontWeight: T.weight.semibold }}>● Conectado</div>
            </div>
            <button
              onClick={handleDisconnectStrava}
              disabled={disconnecting}
              style={{
                background: 'transparent', border: `1px solid ${C.border2}`, borderRadius: T.radius.md,
                padding: '9px 16px', color: C.muted, fontSize: T.text.md, fontWeight: T.weight.semibold,
                cursor: disconnecting ? 'default' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {disconnecting ? '...' : 'Desconectar'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, fontSize: T.text.base, color: C.muted, lineHeight: 1.6 }}>
              Conecte sua conta Strava para importar suas atividades automaticamente e ver pace, distância e frequência cardíaca reais na página de Treino.
            </div>
            <button
              onClick={goToStravaConnect}
              style={{
                background: C.running, border: 'none', borderRadius: T.radius.md,
                padding: '10px 18px', color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold,
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              🏃 Conectar com Strava
            </button>
          </div>
        )}
      </Section>

      {/* ── Alterar senha ─────────────────────────────────────────────────── */}
      {isEmailUser && (
        <Section title="Alterar senha">
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Senha atual</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCur ? 'text' : 'password'}
                  value={curPass}
                  onChange={e => setCurPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inp, paddingRight: 42 }}
                />
                <button type="button" onClick={() => setShowCur(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text.lg }}>
                  {showCur ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div>
              <label style={label}>Nova senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  style={{ ...inp, paddingRight: 42 }}
                />
                <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: T.text.lg }}>
                  {showNew ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div>
              <label style={label}>Confirmar nova senha</label>
              <input
                type="password"
                value={confPass}
                onChange={e => setConfPass(e.target.value)}
                placeholder="••••••••"
                required
                style={{ ...inp, borderColor: confPass && confPass !== newPass ? C.red : C.border2 }}
              />
              {confPass && confPass !== newPass && (
                <div style={{ fontSize: T.text.sm, color: C.red, marginTop: 4 }}>As senhas não coincidem</div>
              )}
            </div>

            <button
              type="submit"
              disabled={savingPass || !curPass || !newPass || newPass !== confPass}
              style={{
                padding: '12px', borderRadius: T.radius.md, border: 'none',
                background: savingPass || !curPass || !newPass || newPass !== confPass ? C.border2 : C.purple,
                color: '#fff', fontSize: T.text.lg, fontWeight: T.weight.bold,
                cursor: savingPass || !curPass || !newPass || newPass !== confPass ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {savingPass ? 'Alterando...' : '🔑 Alterar senha'}
            </button>
          </form>
        </Section>
      )}

      {isGoogleUser && !isEmailUser && (
        <Card style={{ marginBottom: 16, background: `${C.blue}0D`, border: `1px solid ${C.blue}33` }}>
          <div style={{ fontSize: T.text.md, color: C.muted, lineHeight: 1.6 }}>
            <strong style={{ color: C.blue }}>Conta Google</strong> — a senha é gerenciada pelo Google.<br />
            Para alterar, acesse <strong>myaccount.google.com</strong>.
          </div>
        </Card>
      )}

      {/* ── Sessão ────────────────────────────────────────────────────────── */}
      <Section title="Sessão">
        <button
          onClick={async () => { await logout() }}
          style={{
            width: '100%', padding: '12px', borderRadius: T.radius.md, border: `1px solid ${C.border2}`,
            background: 'transparent', color: C.muted, fontSize: T.text.lg, fontWeight: T.weight.semibold,
            cursor: 'pointer', transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.muted }}
        >
          Sair da conta
        </button>
      </Section>

      {/* ── Privacidade ───────────────────────────────────────────────────── */}
      <Section title="Privacidade e LGPD">
        <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.65, marginBottom: 14 }}>
          Seus dados de saúde, treinos e dieta são tratados com base no seu{' '}
          <strong style={{ color: C.text }}>consentimento explícito</strong> (art. 7º, I e art. 11, I da LGPD).
          Você pode exportar todos os seus dados via CSV no Coach, ou excluir tudo abaixo.
        </div>
        <button
          onClick={() => setPolicyOpen(true)}
          style={{
            background: 'none', border: `1px solid ${C.border2}`, borderRadius: T.radius.sm,
            padding: '8px 14px', color: C.muted, fontSize: T.text.base, cursor: 'pointer',
          }}
        >
          📄 Ver Política de Privacidade
        </button>
      </Section>

      {/* ── Zona de risco ─────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16, border: `1px solid ${C.red}33`, background: `${C.red}08` }}>
        <div style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.red, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Zona de risco
        </div>

        {deleteStep === 'idle' && (
          <>
            <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.65, marginBottom: 14 }}>
              Excluir a conta apaga permanentemente todos os seus dados do servidor —
              treinos, dieta, hábitos, fotos de progresso, histórico mental e conversas com o Coach.
              Esta ação é irreversível.
            </div>
            <button
              onClick={() => setDeleteStep('confirm')}
              style={{
                width: '100%', padding: '11px', borderRadius: T.radius.md,
                border: `1px solid ${C.red}66`, background: 'transparent',
                color: C.red, fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${C.red}18` }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              Excluir minha conta definitivamente
            </button>
          </>
        )}

        {(deleteStep === 'confirm' || deleteStep === 'deleting') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: T.radius.md,
              padding: '12px 14px', fontSize: T.text.base, color: C.red, lineHeight: 1.6,
            }}>
              ⚠️ Esta ação é <strong>permanente e irreversível</strong>. Todos os seus dados serão deletados.
            </div>

            {isEmailUser ? (
              <div>
                <div style={{ fontSize: T.text.sm, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Confirme sua senha para continuar
                </div>
                <input
                  type="password"
                  value={deletePass}
                  onChange={e => setDeletePass(e.target.value)}
                  placeholder="••••••••"
                  disabled={deleteStep === 'deleting'}
                  style={{
                    width: '100%', background: '#1C1C1C', border: `1px solid ${C.border2}`,
                    borderRadius: T.radius.md, padding: '11px 14px', color: C.text,
                    fontSize: T.text.lg, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : (
              <div style={{ fontSize: T.text.base, color: C.muted, background: C.card2, borderRadius: T.radius.md, padding: '10px 14px' }}>
                Você será redirecionado para confirmar com o Google antes da exclusão.
              </div>
            )}

            {deleteError && (
              <div style={{ fontSize: T.text.base, color: C.red }}>{deleteError}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setDeleteStep('idle'); setDeletePass(''); setDeleteError('') }}
                disabled={deleteStep === 'deleting'}
                style={{
                  flex: 1, padding: '11px', borderRadius: T.radius.md, border: `1px solid ${C.border2}`,
                  background: 'transparent', color: C.muted, fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteStep === 'deleting' || (isEmailUser && !deletePass)}
                style={{
                  flex: 2, padding: '11px', borderRadius: T.radius.md, border: 'none',
                  background: deleteStep === 'deleting' || (isEmailUser && !deletePass) ? C.border2 : C.red,
                  color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer',
                  transition: 'background .15s',
                }}
              >
                {deleteStep === 'deleting' ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        )}
      </Card>

      {policyOpen && <PolicyOverlay onClose={() => setPolicyOpen(false)} />}
    </div>
  )
}
