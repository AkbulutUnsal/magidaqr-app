import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, profile, loading } = useAuth()

  // Session veya profil yükleniyorsa bekle — erken redirect yapma
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  )

  // Giriş yok → login
  if (!user) return <Navigate to="/login" replace />

  // Kullanıcı var ama profil henüz gelmedi → bekle (login'e atma!)
  if (user && !profile) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  )

  // Rol kontrolü
  if (roles.length > 0 && profile && !roles.includes(profile.role)) {
    if (profile.role === 'kitchen') return <Navigate to="/kitchen" replace />
    if (profile.role === 'waiter')  return <Navigate to="/waiter" replace />
    return <Navigate to="/login" replace />
  }

  return children
}
