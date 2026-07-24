import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env değişkenleri eksik! .env dosyasını kontrol et.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Oturum tarayıcıda saklansın ve token otomatik yenilensin
    // (storageKey'i DEĞİŞTİRME — değişirse mevcut oturumlar düşer)
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: { params: { eventsPerSecond: 20 } }
})
