import { supabase } from './supabase'

// ── Session ID (tarayıcı başına kalıcı) ──
function getSessionId() {
  try {
    let sid = localStorage.getItem('mq_session')
    if (!sid) {
      sid = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem('mq_session', sid)
    }
    return sid
  } catch {
    // localStorage yoksa (gizli mod vs.) geçici id
    return 'sess_tmp_' + Math.random().toString(36).slice(2, 10)
  }
}

// ── Cihaz tespiti ──
function getDevice() {
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet'
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'mobile'
  return 'desktop'
}

// ── Kaynak: QR mı direkt mi ──
// QR ile gelen linklerde ?src=qr olur; localStorage'a yazıp oturum boyunca hatırlarız
function getSource() {
  try {
    const url = new URL(window.location.href)
    const qp = url.searchParams.get('src')
    if (qp === 'qr') {
      sessionStorage.setItem('mq_source', 'qr')
      return 'qr'
    }
    return sessionStorage.getItem('mq_source') || 'direct'
  } catch {
    return 'direct'
  }
}

// ── Olay kaydet (fire-and-forget, hata sayfayı etkilemez) ──
export async function track(restaurantId, eventType, eventData = {}, opts = {}) {
  if (!restaurantId) return
  try {
    await supabase.from('analytics_events').insert({
      restaurant_id: restaurantId,
      session_id: getSessionId(),
      event_type: eventType,
      event_data: eventData,
      table_id: opts.tableId || null,
      source: getSource(),
      device: getDevice(),
      lang: opts.lang || 'ka',
    })
  } catch (e) {
    // sessizce yut — analitik asla müşteri deneyimini bozmamalı
  }
}

// Aynı oturumda aynı olayı tekrar tekrar yazmamak için (örn. ürün detayı 10 kez açılırsa 1 kez say)
const _seen = new Set()
export async function trackOnce(restaurantId, eventType, eventData = {}, opts = {}) {
  const key = `${eventType}:${JSON.stringify(eventData)}`
  if (_seen.has(key)) return
  _seen.add(key)
  return track(restaurantId, eventType, eventData, opts)
}
