import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/* Oturum yüklenmeden asla login'e atma. Ağ hatasında çıkış yapma, tekrar dene. */

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, profile, loading, authError, retryProfile, signOut } = useAuth()

  const Center = ({ children: c }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>{c}</div>
    </div>
  )

  if (loading) return <Center><div className="spinner" /></Center>

  // Giriş yok → login
  if (!user) return <Navigate to="/login" replace />

  // Ağ hatası: oturum duruyor, profil çekilemedi → çıkış YAPMA, tekrar dene
  if (authError === 'network') return (
    <Center>
      <p style={{ fontSize: 34, marginBottom: 10 }}>📡</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>Bağlantı sorunu</p>
      <p style={{ fontSize: 13, color: '#888', marginTop: 6, lineHeight: 1.5 }}>Profil bilgilerin alınamadı. Oturumun açık, tekrar deneyebilirsin.</p>
      <button onClick={retryProfile}
        style={{ marginTop: 16, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Tekrar dene
      </button>
    </Center>
  )

  // Profil gerçekten yok (hesap silinmiş vb.) → bilgilendir + çıkış
  if (authError === 'no-profile') return (
    <Center>
      <p style={{ fontSize: 34, marginBottom: 10 }}>🚫</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>Hesap profili bulunamadı</p>
      <p style={{ fontSize: 13, color: '#888', marginTop: 6, lineHeight: 1.5 }}>Bu kullanıcıya bağlı bir işletme profili yok. Yöneticinle iletişime geç.</p>
      <button onClick={signOut}
        style={{ marginTop: 16, background: '#fff', color: '#E8192C', border: '1px solid #e8e8e4', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Çıkış yap
      </button>
    </Center>
  )

  // Profil henüz gelmedi → bekle (login'e atma!)
  if (!profile) return <Center><div className="spinner" /></Center>

  // Rol kontrolü
  if (roles.length > 0 && !roles.includes(profile.role)) {
    if (profile.role === 'kitchen') return <Navigate to="/kitchen" replace />
    if (profile.role === 'waiter')  return <Navigate to="/waiter" replace />
    return <Navigate to="/login" replace />
  }

  return children
}
