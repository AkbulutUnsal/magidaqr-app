import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { setManualLanguage } from '../../i18n/langPreference'

const GREEN = '#1D9E75'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const { signIn, profile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Şifremi unuttum akışı
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await signIn(email, password)
    if (err) { setError(err.message); setLoading(false); return }

    setTimeout(() => {
      const role = profile?.role
      if (role === 'kitchen') navigate('/kitchen')
      else if (role === 'waiter') navigate('/waiter')
      else navigate('/admin')
    }, 300)
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetLoading(false)
    if (error) { setResetError(error.message); return }
    setResetSent(true)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7f5', fontFamily: '"Inter",system-ui,sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.08)', overflow: 'hidden', position: 'relative' }}>

        <div style={{ height: 6, background: `linear-gradient(90deg, ${GREEN}, ${RED})` }} />

        <div style={{ position: 'absolute', top: 18, right: 18 }}>
          <LoginLangSwitcher i18n={i18n} />
        </div>

        <div style={{ padding: '40px 36px 36px' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
              <span style={{ color: GREEN }}>magida</span><span style={{ color: RED }}>QR</span>
            </span>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginBottom: 32 }}>
            {mode === 'login' ? t('login_subtitle') : t('reset_password_subtitle')}
          </p>

          {mode === 'login' ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={fLabel}>{t('email_label')}</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="ornek@firma.com" autoComplete="email"
                  style={fInput}
                  onFocus={e => (e.target.style.borderColor = GREEN)}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <label style={{ ...fLabel, marginBottom: 0 }}>{t('password_label')}</label>
                  <button type="button" onClick={() => { setMode('forgot'); setResetEmail(email); setResetSent(false); setResetError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN, fontSize: 11.5, fontWeight: 600, padding: 0 }}>
                    {t('forgot_password')}
                  </button>
                </div>
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
                    aria-label={showPassword ? t('hide_password') : t('show_password')}
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
                {loading ? t('logging_in') : t('login_button')}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {resetSent ? (
                <p style={{ fontSize: 13, color: '#0F6E56', background: '#e8f5ee', border: `1px solid ${GREEN}30`,
                  borderRadius: 8, padding: '12px 14px', margin: 0, lineHeight: 1.6 }}>
                  {t('reset_link_sent')}
                </p>
              ) : (
                <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={fLabel}>{t('email_label')}</label>
                    <input
                      type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required
                      placeholder="ornek@firma.com" autoComplete="email"
                      style={fInput}
                      onFocus={e => (e.target.style.borderColor = GREEN)}
                      onBlur={e => (e.target.style.borderColor = BORDER)}
                    />
                  </div>

                  {resetError && (
                    <p style={{ fontSize: 12.5, color: RED, background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: 8, padding: '9px 12px', margin: 0 }}>
                      {resetError}
                    </p>
                  )}

                  <button
                    type="submit" disabled={resetLoading}
                    style={{ padding: '13px', background: GREEN, color: '#fff', border: 'none',
                      borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: resetLoading ? 'wait' : 'pointer',
                      opacity: resetLoading ? 0.75 : 1, boxShadow: `0 6px 18px ${GREEN}45` }}
                  >
                    {resetLoading ? t('logging_in') : t('send_reset_link')}
                  </button>
                </form>
              )}

              <button type="button" onClick={() => { setMode('login'); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 12.5,
                  fontWeight: 600, padding: 0, textAlign: 'center' }}>
                ← {t('back_to_login')}
              </button>
            </div>
          )}
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

// ── Login dil switcher ──
function LoginLangSwitcher({ i18n }) {
  const [open, setOpen] = useState(false)
  const LANGS = [
    { code: 'tr', img: 'https://flagcdn.com/w40/tr.png', label: 'Türkçe' },
    { code: 'en', img: 'https://flagcdn.com/w40/gb.png', label: 'English' },
    { code: 'ka', img: 'https://flagcdn.com/w40/ge.png', label: 'ქართული' },
    { code: 'ru', img: 'https://flagcdn.com/w40/ru.png', label: 'Русский' },
  ]
  const cur = LANGS.find(l => l.code === i18n.language) || LANGS[0]

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', background: '#f5f5f3',
          border: `1px solid ${BORDER}`, borderRadius: 20, cursor: 'pointer' }}>
        <img src={cur.img} alt={cur.code} style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#444' }}>{cur.code.toUpperCase()}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{ position: 'absolute', right: 0, top: 34, background: '#fff', border: `1px solid ${BORDER}`,
            borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.12)', overflow: 'hidden', zIndex: 91, minWidth: 140 }}>
            {LANGS.map(({ code, img, label }) => (
              <button key={code} onClick={() => { setManualLanguage(i18n, code); setOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                  border: 'none', cursor: 'pointer', background: i18n.language === code ? '#e8f5ee' : '#fff' }}>
                <img src={img} alt={code} style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2 }} />
                <span style={{ fontSize: 12.5, fontWeight: i18n.language === code ? 700 : 500,
                  color: i18n.language === code ? GREEN : '#333' }}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
