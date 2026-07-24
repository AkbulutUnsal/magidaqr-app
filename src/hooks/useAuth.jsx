import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import i18n from '../i18n'
import { hasManualLanguage } from '../i18n/langPreference'

/* ───────────────────────────────────────────────────────────
   magidaQR · Auth (oturum kalıcılığı düzeltmesi)
   ÖNEMLİ: Profil sorgusu hata verince ARTIK signOut yapılmıyor.
   Geçici ağ hatası tekrar denenir; sadece profil GERÇEKTEN yoksa çıkış.
   Böylece sekme değişimi / sinyal dalgalanması oturumu düşürmez.
─────────────────────────────────────────────────────────── */

const AuthContext = createContext(null)
const sleep = ms => new Promise(r => setTimeout(r, ms))

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [authError, setAuthError] = useState(null)   // null | 'network' | 'no-profile'

  const activeRef     = useRef(true)
  const profileRef    = useRef(null)   // güncel profil (stale closure önlemi)
  const fetchedForRef = useRef(null)   // profili çekilmiş user id
  const inFlightRef   = useRef(false)  // aynı anda tek sorgu

  useEffect(() => { profileRef.current = profile }, [profile])

  const applyLang = useCallback(async (data) => {
    // Personel restoranın diline geçsin — ama kullanıcı elle dil seçtiyse dokunma
    if (!data?.restaurant_id || hasManualLanguage()) return
    try {
      const { data: rest } = await supabase
        .from('restaurants').select('default_language, default_lang')
        .eq('id', data.restaurant_id).single()
      const restLang = rest?.default_language || rest?.default_lang
      if (restLang && ['ka', 'en', 'tr', 'ru'].includes(restLang)) i18n.changeLanguage(restLang)
    } catch (e) { /* dil ayarı kritik değil — sessiz geç */ }
  }, [])

  const fetchProfile = useCallback(async (userId, { force = false } = {}) => {
    if (!userId) return
    // Zaten bu kullanıcının profili elimizde → tekrar çekme (gereksiz sorgu = gereksiz risk)
    if (!force && fetchedForRef.current === userId && profileRef.current) { setLoading(false); return }
    if (inFlightRef.current) return
    inFlightRef.current = true

    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        // maybeSingle: satır yoksa data=null & error=null → "yok" ile "hata"yı ayırt ederiz
        const { data, error } = await supabase
          .from('profiles').select('*').eq('id', userId).maybeSingle()

        if (!activeRef.current) return

        if (!error) {
          if (data) {
            fetchedForRef.current = userId
            setProfile(data); setAuthError(null); setLoading(false)
            applyLang(data)
            return
          }
          // Sorgu başarılı ama satır yok → profil gerçekten yok
          setProfile(null); setAuthError('no-profile'); setLoading(false)
          return
        }

        // Hata var → geçici olabilir, artan bekleme ile tekrar dene
        if (attempt < 3) await sleep(600 * (attempt + 1))
      }

      // Tüm denemeler başarısız → OTURUMU KAPATMA, sadece durumu bildir
      if (activeRef.current) { setAuthError('network'); setLoading(false) }
    } finally {
      inFlightRef.current = false
    }
  }, [applyLang])

  useEffect(() => {
    activeRef.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activeRef.current) return
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!activeRef.current) return
      setUser(session?.user ?? null)

      if (event === 'SIGNED_OUT') {
        fetchedForRef.current = null
        setProfile(null); setAuthError(null); setLoading(false)
        return
      }
      if (!session?.user) return   // oturum yoksa bekle, zorla çıkış yapma

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        fetchProfile(session.user.id)
      }
      // TOKEN_REFRESHED: profil zaten var, dokunma
    })

    return () => { activeRef.current = false; subscription.unsubscribe() }
  }, [fetchProfile])

  // Ağ hatasından sonra elle tekrar deneme (ProtectedRoute kullanır)
  const retryProfile = useCallback(() => {
    if (!user?.id) return
    setAuthError(null); setLoading(true)
    fetchProfile(user.id, { force: true })
  }, [user?.id, fetchProfile])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    fetchedForRef.current = null
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError, retryProfile, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
