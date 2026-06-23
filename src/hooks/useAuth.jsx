import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      setUser(session?.user ?? null)

      if (event === 'SIGNED_OUT' || !session?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        fetchProfile(session.user.id)
      }
      // TOKEN_REFRESHED / USER_UPDATED: profile zaten var, tekrar çekme
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
