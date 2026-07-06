import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

const GREEN = '#1D9E75'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  // Not: Supabase, e-postadaki linke tıklandığında tarayıcıda otomatik olarak
  // geçici bir "recovery" session açar. Kullanıcı sadece yeni şifresini girer.
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError(t('password_mismatch')); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }

    setSuccess(true)
    setTimeout(() => navigate('/login'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7f5', fontFamily: '"Inter",system-ui,sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.08)', overflow: 'hidden' }}>

        <div style={{ height: 6, background: `linear-gradient(90deg, ${GREEN}, ${RED})` }} />

        <div style={{ padding: '40px 36px 36px' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
              <span style={{ color: GREEN }}>magida</span><span style={{ color: RED }}>QR</span>
            </span>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginBottom: 32 }}>
            {t('reset_password_title')}
          </p>

          {success ? (
            <p style={{ fontSize: 13, color: '#0F6E56', background: '#e8f5ee', border: `1px solid ${GREEN}30`,
              borderRadius: 8, padding: '12px 14px', margin: 0, lineHeight: 1.6, textAlign: 'center' }}>
              {t('password_updated_success')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={fLabel}>{t('new_password_label')}</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  minLength={6} autoComplete="new-password"
                  style={fInput}
                  onFocus={e => (e.target.style.borderColor = GREEN)}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                />
              </div>

              <div>
                <label style={fLabel}>{t('confirm_password_label')}</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  minLength={6} autoComplete="new-password"
                  style={fInput}
                  onFocus={e => (e.target.style.borderColor = GREEN)}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                />
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
                  opacity: loading ? 0.75 : 1, boxShadow: `0 6px 18px ${GREEN}45` }}
              >
                {loading ? t('logging_in') : t('update_password_button')}
              </button>
            </form>
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
