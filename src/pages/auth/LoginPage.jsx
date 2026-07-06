import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const GREEN = '#1D9E75'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

export default function LoginPage() {
  const { signIn, profile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await signIn(email, password)
    if (err) { setError(err.message); setLoading(false); return }

    // Role'e göre yönlendir (profile biraz geç gelebilir, kısa bekle)
    setTimeout(() => {
      const role = profile?.role
      if (role === 'kitchen') navigate('/kitchen')
      else if (role === 'waiter') navigate('/waiter')
      else navigate('/admin')
    }, 300)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7f5', fontFamily: '"Inter",system-ui,sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.08)', overflow: 'hidden' }}>

        {/* Üst marka şeridi */}
        <div style={{ height: 6, background: `linear-gradient(90deg, ${GREEN}, ${RED})` }} />

        <div style={{ padding: '40px 36px 36px' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
              <span style={{ color: GREEN }}>magida</span><span style={{ color: RED }}>QR</span>
            </span>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginBottom: 32 }}>
            Yönetim paneline giriş yap
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={fLabel}>E-posta</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="ornek@firma.com" autoComplete="email"
                style={fInput}
                onFocus={e => (e.target.style.borderColor = GREEN)}
                onBlur={e => (e.target.style.borderColor = BORDER)}
              />
            </div>

            <div>
              <label style={fLabel}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" autoComplete="current-password"
                  style={{ ...fInput, paddingRight: 44 }}
                  onFocus={e => (e.target.style.borderColor = GREEN)}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                />
                <button
                  type="button" onClick={() => setShowPassword(s => !s)} tabIndex={-1}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: MUTED,
                    display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 12.5, color: RED, background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '9px 12px', margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit" disabled={loading}
              style={{ marginTop: 6, padding: '13px', background: GREEN, color: '#fff', border: 'none',
                borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.75 : 1, boxShadow: `0 6px 18px ${GREEN}45`, transition: 'transform .12s' }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = {
  width: '100%', padding: '11px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10,
  fontSize: 14, boxSizing: 'border-box', outline: 'none', transition: 'border-color .15s',
  fontFamily: 'inherit',
}

function EyeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.7 19.7 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a19.7 19.7 0 0 1-3.22 4.44" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
