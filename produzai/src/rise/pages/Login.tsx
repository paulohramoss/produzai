import { useState } from 'react'
import { C } from '../data'
import { useAuthStore } from '../../store/useAuthStore'

type Mode = 'login' | 'register'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1C1C1C',
  border: `1px solid ${C.border2}`,
  borderRadius: 10,
  padding: '12px 14px',
  color: C.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.muted,
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export function Login() {
  const [mode, setMode]         = useState<Mode>('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPass]     = useState('')
  const [showPass, setShowPass] = useState(false)

  const { login, loginWithGoogle, register, loading, error, clearError } = useAuthStore()

  function switchMode(m: Mode) {
    setMode(m)
    clearError()
    setName('')
    setEmail('')
    setPass('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'login') login(email, password)
    else register(name, email, password)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: C.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
          }}>⚡</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>The Rise Plan</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Performance Total</div>
        </div>

        {/* Card */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, color: C.text }}>
            {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: `${C.red}18`, border: `1px solid ${C.red}40`,
              borderRadius: 10, padding: '11px 14px', marginBottom: 18,
              fontSize: 13, color: C.red,
            }}>
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px 14px',
              background: '#fff',
              border: '1px solid #dadce0',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              color: '#3c4043',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: 20,
              transition: 'box-shadow 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,.3)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            <GoogleIcon />
            Continuar com Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 12, color: C.muted }}>ou use e-mail</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <div>
                <label style={labelStyle}>Nome</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  autoFocus
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label style={labelStyle}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus={mode === 'login'}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                  required
                  style={{ ...inputStyle, paddingRight: 46 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 15,
                  }}
                >{showPass ? '🙈' : '👁'}</button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4, padding: '13px', borderRadius: 12, border: 'none',
                background: loading ? C.border2 : C.orange,
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {/* Toggle */}
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: C.muted }}>
            {mode === 'login' ? (
              <>Não tem conta?{' '}
                <button onClick={() => switchMode('register')} style={{ background: 'none', border: 'none', color: C.orange, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  Criar conta
                </button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: C.orange, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: C.muted }}>
          Seus dados ficam seguros e isolados por conta
        </div>
      </div>
    </div>
  )
}
