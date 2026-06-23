// magidaQR — Paket Tanımları
// Tek merkezden yönetilen plan/fiyat/özellik bilgisi

export const PLANS = {
  basic: {
    key: 'basic',
    name: 'Temel',
    name_en: 'Basic',
    price: 480,          // GEL / yıl
    currency: '₾',
    period: 'yıl',
    color: '#1D9E75',
    bg: '#e8f5ee',
    tagline: 'Tek restoran veya kafe için ideal',
    maxOutlets: 1,
    features: [
      'Tüm QR menü altyapısı',
      'Sınırsız ürün & kategori',
      '4 dil desteği (KA/EN/TR/RU)',
      'QR Stüdyo + masa yönetimi',
      'Garson & Mutfak paneli',
      'Kampanyalar + Hero kartları',
      'Alerjen & beslenme etiketleri',
      'Anket & geri bildirim',
      'Detaylı raporlar',
      'Paket servisi',
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
    tagline: 'Otel, zincir ve çoklu şube için',
    maxOutlets: Infinity,
    features: [
      'Temel paketin tüm özellikleri',
      'Sınırsız outlet (şube)',
      'Outlet bazlı fiyatlandırma',
      'Outlet bazlı branding',
      'Outlet bazlı raporlar',
      'Öncelikli destek',
    ],
  },
}

export const AI_ADDON = {
  name: 'AI Asistan',
  price: 300,          // GEL / yıl
  currency: '₾',
  period: 'yıl',
  features: [
    'Satış analizi & öneriler',
    'En çok/az satan ürün tespiti',
    'Menü mühendisliği önerileri',
    'Yoğun saat analizi',
  ],
}

// Yardımcılar
export function getPlan(key) {
  return PLANS[key] || PLANS.basic
}

export function canAddOutlet(planKey, currentCount) {
  const plan = getPlan(planKey)
  return currentCount < plan.maxOutlets
}

export function hasAI(tenant) {
  return !!tenant?.ai_addon
}
