import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import i18n from '../i18n'
import { hasManualLanguage } from '../i18n/langPreference'

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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) {
      // Profil bulunamadı — hesap silinmiş olabilir. Oturumu kapat, login'e dönsün.
      // Aksi halde sayfa sonsuza kadar bomboş kalır.
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    setProfile(data)
    setLoading(false)

    // Personel restoranın diline otomatik geçsin — AMA sadece kullanıcı daha önce
    // elle bir dil seçmediyse (manuel seçim her zaman öncelikli ve kalıcı)
    if (data?.restaurant_id && !hasManualLanguage()) {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('default_language, default_lang')
        .eq('id', data.restaurant_id)
        .single()
      const restLang = rest?.default_language || rest?.default_lang
      if (restLang && ['ka', 'en', 'tr', 'ru'].includes(restLang)) {
        i18n.changeLanguage(restLang)
      }
    }
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
