import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · PlanGate — route seviyesi plan kilidi
   Temel planda kitchen/waiter/sms özelliklerini URL'den bile kapatır.
   Kendi içinde çalışır (dış dosyaya bağımlı değil). plan restoran başına cache'li.
   plan okunamazsa fail-open (yanlış kilitleme yapmaz).
─────────────────────────────────────────────────────────── */

const PLAN_RANK = { start: 1, basic: 2, advanced: 3 }
const FEATURE_MIN = {
  orders: 'basic',
  kitchen: 'advanced', waiter: 'advanced', sms: 'advanced',
  crm: 'advanced', stock: 'advanced', outlets: 'advanced',
}
const planCache = new Map()

export default function PlanGate({ feature, children }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const rid = profile?.restaurant_id
  const [plan, setPlan] = useState(() => (rid && planCache.has(rid)) ? planCache.get(rid) : undefined)

  useEffect(() => {
    if (!rid) return
    if (planCache.has(rid)) { setPlan(planCache.get(rid)); return }
    supabase.from('restaurants').select('plan').eq('id', rid).single()
      .then(({ data }) => { const p = data?.plan ?? null; planCache.set(rid, p); setPlan(p) })
      .catch(() => { planCache.set(rid, null); setPlan(null) })
  }, [rid])

  const need = FEATURE_MIN[feature]

  // Plan henüz bilinmiyor → kısa bekleme (yanlış ekran göstermemek için)
  if (need && plan === undefined) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  )

  // plan null (okunamadı) → fail-open · yeterli plan → geç
  const allowed = !need || plan == null || (PLAN_RANK[plan] || 0) >= (PLAN_RANK[need] || 0)
  if (allowed) return children

  const needName = need === 'basic' ? 'Temel' : 'Gelişmiş'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380, background: '#fff', border: '1px solid #e8e8e4', borderRadius: 18, padding: '40px 30px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </div>
        <p style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 8 }}>Bu özellik {needName} pakete özel</p>
        <p style={{ fontSize: 13.5, color: '#888', lineHeight: 1.6, marginBottom: 22 }}>
          Bu bölüm <b>{needName}</b> paket ve üzerinde açılır. Paketini yükselterek erişebilirsin.
        </p>
        <button onClick={() => navigate('/admin/settings')}
          style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Paketi Yükselt
        </button>
        <button onClick={() => navigate('/admin')}
          style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#aaa', fontSize: 12.5, cursor: 'pointer' }}>
          ← Panele dön
        </button>
      </div>
    </div>
  )
}
