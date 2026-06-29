import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage() {
  const { signIn, profile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-qr"><span style={{color:'#1D9E75'}}>magida</span><span style={{color:'#E8192C'}}>QR</span></span>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>E-posta</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Şifre</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
