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

export function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [showPass, setShowPass] = useState(false)

  const { login, register, loading, error, clearError } = useAuthStore()

  function switchMode(m: Mode) {
    setMode(m)
    clearError()
    setName('')
    setEmail('')
    setPass('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'login') {
      login(email, password)
    } else {
      register(name, email, password)
    }
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
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: 32,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, color: C.text }}>
            {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: `${C.red}18`,
              border: `1px solid ${C.red}40`,
              borderRadius: 10,
              padding: '11px 14px',
              marginBottom: 18,
              fontSize: 13,
              color: C.red,
            }}>
              {error}
            </div>
          )}

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
                marginTop: 4,
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                background: loading ? C.border2 : C.orange,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
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
                <button
                  onClick={() => switchMode('register')}
                  style={{ background: 'none', border: 'none', color: C.orange, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                >Criar conta</button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: C.orange, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                >Entrar</button>
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
