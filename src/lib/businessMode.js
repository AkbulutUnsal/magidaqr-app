import { supabase } from './supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · İşletme Modu Yardımcısı (Otel Modu · Faz 1)
   restaurants.business_type = 'restaurant' | 'hotel'
   hotel modunda "Masa" → "Oda" (4 dilde). Panellerde import edilir.
   getBusinessType: restoran başına cache'lenir (tekrar sorgu yok).
─────────────────────────────────────────────────────────── */

const cache = new Map()

export async function getBusinessType(restaurantId) {
  if (!restaurantId) return 'restaurant'
  if (cache.has(restaurantId)) return cache.get(restaurantId)
  try {
    const { data } = await supabase.from('restaurants').select('business_type').eq('id', restaurantId).single()
    const mode = data?.business_type === 'hotel' ? 'hotel' : 'restaurant'
    cache.set(restaurantId, mode)
    return mode
  } catch (e) {
    return 'restaurant'  // Not (reis): kolon yoksa/hatada güvenli varsayılan
  }
}

// cache temizleme (modu Ayarlar'dan değiştirince çağrılabilir)
export function clearBusinessTypeCache(restaurantId) {
  if (restaurantId) cache.delete(restaurantId); else cache.clear()
}

// birim terimi (masa/oda) · 4 dil · one=tekil, many=çoğul
const UNIT = {
  restaurant: {
    tr: { one: 'Masa', many: 'Masalar' },
    en: { one: 'Table', many: 'Tables' },
    ka: { one: 'მაგიდა', many: 'მაგიდები' },
    ru: { one: 'Стол', many: 'Столы' },
  },
  hotel: {
    tr: { one: 'Oda', many: 'Odalar' },
    en: { one: 'Room', many: 'Rooms' },
    ka: { one: 'ოთახი', many: 'ოთახები' },
    ru: { one: 'Номер', many: 'Номера' },
  },
}

export function unit(mode, lang = 'tr', form = 'one') {
  const m = UNIT[mode === 'hotel' ? 'hotel' : 'restaurant']
  const l = m[lang] || m.tr
  return l[form] || l.one
}

export const isHotel = mode => mode === 'hotel'
