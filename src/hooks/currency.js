// Hangi arayüz dili hangi para birimini göstersin
export const LANG_CURRENCY = { tr: 'TRY', ru: 'RUB', en: 'USD', ka: 'GEL' }

export const CURRENCY_SYMBOLS = { TRY: '₺', RUB: '₽', USD: '$', GEL: '₾' }
export const CURRENCY_LOCALES = { TRY: 'tr-TR', RUB: 'ru-RU', USD: 'en-US', GEL: 'ka-GE' }

// amountGEL: veritabanındaki ham fiyat (her zaman ₾ olarak saklanıyor)
// lang: aktif arayüz dili ('tr' | 'en' | 'ka' | 'ru')
// rates: { TRY: 17.2, USD: 0.38, RUB: 29.5, ... } — exchange_rates tablosundan gelir
export function formatPrice(amountGEL, lang, rates) {
  const code = LANG_CURRENCY[lang] || 'GEL'
  const symbol = CURRENCY_SYMBOLS[code] || '₾'
  const locale = CURRENCY_LOCALES[code] || 'ka-GE'
  const rate = code === 'GEL' ? 1 : (rates?.[code] ?? 1)
  const amount = (Number(amountGEL) || 0) * rate
  const formatted = amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  // GEL sonda (100.00 ₾), diğerleri önde (₺100.00 / $100.00 / ₽100.00)
  return code === 'GEL' ? `${formatted} ${symbol}` : `${symbol}${formatted}`
}
