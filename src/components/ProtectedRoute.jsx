import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (roles.length > 0 && profile && !roles.includes(profile.role)) {
    // Role'e göre yönlendir
    if (profile.role === 'kitchen') return <Navigate to="/kitchen" replace />
    if (profile.role === 'waiter')  return <Navigate to="/waiter" replace />
    return <Navigate to="/login" replace />
  }

  return children
}
