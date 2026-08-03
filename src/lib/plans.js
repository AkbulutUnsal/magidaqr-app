// magidaQR — Paket Tanımları (3 kademe: Start / Temel / Gelişmiş)
// Tek merkezden yönetilen plan/fiyat/özellik bilgisi

export const PLANS = {
  start: {
    key: 'start',
    name: 'Start',
    name_en: 'Start',
    price: 240,          // GEL / yıl (örnek — kendine göre ayarla)
    currency: '₾',
    period: 'yıl',
    color: '#1D9E75',
    bg: '#e8f5ee',
    tagline: 'Sadece dijital menü — en kolay başlangıç',
    maxOutlets: 1,
    features: [
      'QR menü + sınırsız ürün/kategori',
      'Fotoğraf, kalori, alerjen, beslenme etiketi',
      '4 dil desteği (KA/EN/TR/RU)',
      'QR Stüdyo',
      'Kampanyalar + Hero kartları',
      'Misafir menüyü görür (siparişsiz)',
    ],
  },
  basic: {
    key: 'basic',
    name: 'Temel',
    name_en: 'Basic',
    price: 480,
    currency: '₾',
    period: 'yıl',
    color: '#2563eb',
    bg: '#eff6ff',
    tagline: 'Menü + sipariş — misafir garson çağırır, sipariş verir',
    maxOutlets: 1,
    features: [
      'Start paketin tüm özellikleri',
      'Misafir: garson çağır / hesap iste',
      'Misafir: sepet + sipariş verme',
      'Panelde sipariş görünümü',
      'Anket & geri bildirim',
      'Detaylı raporlar',
    ],
  },
  advanced: {
    key: 'advanced',
    name: 'Gelişmiş',
    name_en: 'Advanced',
    price: 900,
    currency: '₾',
    period: 'yıl',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    tagline: 'Tam operasyon — otel, zincir ve çoklu şube için',
    maxOutlets: Infinity,
    features: [
      'Temel paketin tüm özellikleri',
      'Mutfak Ekranı (KDS, kalem takibi)',
      'Garson Paneli (personel ekranı)',
      'Sadakat: puan & damga',
      'SMS bildirimleri',
      'Stok / envanter',
      'Otel modu (oda servisi)',
      'Sınırsız outlet (şube)',
    ],
  },
}

export const AI_ADDON = {
  name: 'AI Asistan',
  price: 300,
  currency: '₾',
  period: 'yıl',
  features: [
    'Satış analizi & öneriler',
    'En çok/az satan ürün tespiti',
    'Menü mühendisliği önerileri',
    'Yoğun saat analizi',
  ],
}

// ─────────────────────────────────────────────────────────
// Özellik → gerekli minimum paket (KİLİT mantığı buradan okunur)
// AdminLayout / PlanGate ile birebir aynı olmalı.
// ─────────────────────────────────────────────────────────
export const FEATURE_MIN_PLAN = {
  orders: 'basic',        // Siparişler paneli + misafir sipariş → Temel+
  kitchen: 'advanced',    // Mutfak Ekranı
  waiter: 'advanced',     // Garson Paneli
  sms: 'advanced',        // SMS bildirimleri
  crm: 'advanced',        // Müşteriler / sadakat
  stock: 'advanced',      // Stok
  outlets: 'advanced',    // Çoklu outlet
  hotelMode: 'advanced',  // Otel modu
}

const PLAN_RANK = { start: 1, basic: 2, advanced: 3 }

export function getPlan(key) {
  return PLANS[key] || PLANS.start
}

export function canAddOutlet(planKey, currentCount) {
  const plan = getPlan(planKey)
  return currentCount < plan.maxOutlets
}

export function hasAI(tenant) {
  return !!tenant?.ai_addon
}

// Bir paket, bir özelliğe erişebiliyor mu? (kilit için)
export function planAllows(planKey, feature) {
  const need = FEATURE_MIN_PLAN[feature]
  if (!need) return true
  if (!planKey) return true            // bilinmiyorsa fail-open
  return (PLAN_RANK[planKey] || 0) >= (PLAN_RANK[need] || 0)
}
