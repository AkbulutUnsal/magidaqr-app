import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Paket Servisi  (qrmenum referans · #1D9E75)
   Paket siparişleri şema-uyumlu algılanır:
   is_delivery / order_type='delivery' varsa onunla, yoksa
   table_id boş siparişler paket sayılır.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const money = v => Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₺'
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const hhmm = d => new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
const pick = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; return '' }

export default function AdminDelivery() {
  const { profile } = useAuth()
  const [settings, setSettings] = useState({})
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [range, setRange] = useState(30)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all') // all | today | week

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const rid = profile.restaurant_id
    const [{ data: rest }, { data: ords }] = await Promise.all([
      supabase.from('restaurants').select('delivery_enabled,delivery_min_amount,delivery_fee,delivery_radius_km,delivery_note').eq('id', rid).single(),
      supabase.from('orders').select('*, order_items(quantity,unit_price)').eq('restaurant_id', rid).order('created_at', { ascending: false }),
    ])
    setSettings(rest || {})
    setOrders(ords || [])
    setLoading(false)
  }

  // paket siparişlerini ayıkla (şema-uyumlu)
  const deliveryOrders = useMemo(() => {
    const list = orders || []
    const s = list[0] || {}
    if ('is_delivery' in s) return list.filter(o => o.is_delivery)
    if ('order_type' in s) return list.filter(o => ['delivery', 'paket', 'takeaway'].includes(String(o.order_type || '').toLowerCase()))
    if ('type' in s) return list.filter(o => ['delivery', 'paket', 'takeaway'].includes(String(o.type || '').toLowerCase()))
    return list.filter(o => o.table_id == null)
  }, [orders])

  const deliveredField = 'delivered' in (deliveryOrders[0] || {}) ? 'delivered' : 'is_delivered' in (deliveryOrders[0] || {}) ? 'is_delivered' : null
  const isDelivered = o => deliveredField ? !!o[deliveredField] : o.status === 'served'

  const oTotal = o => Number(o.total_price ?? o.total ?? (o.order_items || []).reduce((s, x) => s + (x.unit_price || 0) * (x.quantity || 0), 0))
  const oCount = o => (o.order_items || []).reduce((s, x) => s + (x.quantity || 0), 0) || (o.order_items?.length || 0)
  const cName = o => pick(o, ['customer_name', 'name', 'full_name', 'contact_name']) || 'Müşteri'
  const cAddr = o => pick(o, ['delivery_address', 'customer_address', 'address'])
  const cNote = o => pick(o, ['note', 'customer_note', 'order_note', 'notes'])

  // KPI
  const kpi = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 864e5)
    const prevStart = new Date(now.getTime() - 14 * 864e5)
    const todays = deliveryOrders.filter(o => sameDay(o.created_at, now))
    const last7 = deliveryOrders.filter(o => new Date(o.created_at) >= weekAgo)
    const prev7 = deliveryOrders.filter(o => { const d = new Date(o.created_at); return d >= prevStart && d < weekAgo })
    const rev7 = last7.reduce((s, o) => s + oTotal(o), 0)
    const trend = prev7.length ? Math.round(((last7.length - prev7.length) / prev7.length) * 100) : (last7.length ? 100 : 0)
    return {
      todayCount: todays.length, todayRev: todays.reduce((s, o) => s + oTotal(o), 0),
      week: last7.length, trend, rev7, avg: last7.length ? rev7 / last7.length : 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryOrders])

  // grafik verisi
  const chart = useMemo(() => {
    const days = []
    const now = startOfDay(new Date())
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 864e5)
      const dayOrders = deliveryOrders.filter(o => sameDay(o.created_at, d))
      days.push({ d, orders: dayOrders.length, revenue: dayOrders.reduce((s, o) => s + oTotal(o), 0) })
    }
    return days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryOrders, range])

  // liste filtre
  const filtered = useMemo(() => {
    const now = new Date(), weekAgo = new Date(now.getTime() - 7 * 864e5)
    let r = deliveryOrders
    if (tab === 'today') r = r.filter(o => sameDay(o.created_at, now))
    else if (tab === 'week') r = r.filter(o => new Date(o.created_at) >= weekAgo)
    if (q) {
      const t = q.toLowerCase()
      r = r.filter(o => [cName(o), cAddr(o), pick(o, ['customer_phone', 'phone'])].join(' ').toLowerCase().includes(t))
    }
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryOrders, tab, q])

  const counts = useMemo(() => {
    const now = new Date(), weekAgo = new Date(now.getTime() - 7 * 864e5)
    return {
      all: deliveryOrders.length,
      today: deliveryOrders.filter(o => sameDay(o.created_at, now)).length,
      week: deliveryOrders.filter(o => new Date(o.created_at) >= weekAgo).length,
    }
  }, [deliveryOrders])

  // listeyi zaman grubuna böl
  const sections = useMemo(() => {
    const now = new Date(), weekAgo = new Date(now.getTime() - 7 * 864e5)
    const today = [], week = [], older = []
    filtered.forEach(o => {
      if (sameDay(o.created_at, now)) today.push(o)
      else if (new Date(o.created_at) >= weekAgo) week.push(o)
      else older.push(o)
    })
    return [
      { title: 'Bugün', list: today }, { title: 'Bu Hafta', list: week }, { title: 'Daha Önce', list: older },
    ].filter(s => s.list.length)
  }, [filtered])

  async function toggleDelivered(o) {
    const val = !isDelivered(o)
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...(deliveredField ? { [deliveredField]: val } : { status: val ? 'served' : 'ready' }) } : x))
    const patch = deliveredField ? { [deliveredField]: val } : { status: val ? 'served' : 'ready' }
    await supabase.from('orders').update(patch).eq('id', o.id)
  }
  async function deleteOrder(id) {
    if (!confirm('Bu paket siparişini silmek istediğine emin misin?')) return
    await supabase.from('orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  async function saveSettings(s) {
    await supabase.from('restaurants').update({
      delivery_enabled: s.delivery_enabled ?? false,
      delivery_min_amount: parseFloat(s.delivery_min_amount) || 0,
      delivery_fee: parseFloat(s.delivery_fee) || 0,
      delivery_radius_km: parseFloat(s.delivery_radius_km) || 0,
      delivery_note: s.delivery_note || '',
    }).eq('id', profile.restaurant_id)
    setSettings(s); setShowSettings(false)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const active = !!settings.delivery_enabled

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Paket Servisi</h1>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: active ? GREEN_BG : '#f4f4f2', color: active ? GREEN : '#aaa', letterSpacing: '.04em' }}>
            {active ? 'AKTİF' : 'PASİF'}
          </span>
          {saved && <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>✓ Kaydedildi</span>}
        </div>
        <button onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#fff', color: '#333', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <CogIcon /> Ayarlar
        </button>
      </div>

      {/* KPI kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 20 }}>
        <Kpi label="Bugün" big={kpi.todayCount} sub={`sipariş · ${money(kpi.todayRev)}`} />
        <Kpi label="Son 7 Gün" big={kpi.week} sub="sipariş" trend={kpi.trend} />
        <Kpi label="Hasılat (7g)" big={money(kpi.rev7)} sub="son 7 gün" />
        <Kpi label="Ortalama Sepet" big={money(kpi.avg)} sub="son 7 gün" />
      </div>

      {/* Grafik */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Günlük sipariş + ciro</h3>
          <div style={{ display: 'flex', gap: 4, background: '#f4f4f2', borderRadius: 9, padding: 3 }}>
            {[7, 30, 90].map(r => (
              <button key={r} onClick={() => setRange(r)} style={{ padding: '5px 12px', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: range === r ? '#fff' : 'transparent', color: range === r ? GREEN : '#999', boxShadow: range === r ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{r}g</button>
            ))}
          </div>
        </div>
        <DeliveryChart data={chart} />
      </div>

      {/* Sipariş listesi */}
      <div style={{ position: 'relative', marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ad veya adres / telefon ara..."
            style={{ width: '100%', padding: '11px 14px 11px 38px', border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f4f4f2', borderRadius: 10, padding: 3 }}>
          {[['all', 'Tümü', counts.all], ['today', 'Bugün', counts.today], ['week', 'Bu Hafta', counts.week]].map(([k, lbl, n]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab === k ? '#fff' : 'transparent', color: tab === k ? GREEN : '#999', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{lbl} ({n})</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
      ) : sections.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
          <p style={{ fontSize: 14 }}>{deliveryOrders.length === 0 ? 'Henüz paket siparişi yok.' : 'Aramaya uyan sipariş yok.'}</p>
        </div>
      ) : sections.map(sec => (
        <div key={sec.title} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{sec.title}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{sec.list.length} sipariş</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sec.list.map(o => {
              const done = isDelivered(o)
              return (
                <div key={o.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14 }}>
                      <span style={{ color: '#aaa', fontWeight: 600 }}>{hhmm(o.created_at)}</span>
                      <span style={{ color: '#ddd', margin: '0 8px' }}>·</span>
                      <span style={{ fontWeight: 700, color: '#111' }}>{cName(o)}</span>
                    </p>
                    {cAddr(o) && <p style={{ fontSize: 12, color: '#999', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cAddr(o)}</p>}
                    <p style={{ fontSize: 12, color: '#bbb', marginTop: 3 }}>
                      {oCount(o)} ürün <span style={{ color: '#ddd' }}>·</span> <b style={{ color: '#555' }}>{money(oTotal(o))}</b>
                      {cNote(o) && <span> <span style={{ color: '#ddd' }}>·</span> 📝 {cNote(o)}</span>}
                    </p>
                  </div>
                  <button onClick={() => toggleDelivered(o)} title={done ? 'Teslim edildi' : 'Teslim edildi olarak işaretle'}
                    style={{ width: 40, height: 23, borderRadius: 12, border: 'none', cursor: 'pointer', background: done ? GREEN : '#d8d8d4', position: 'relative', flexShrink: 0, transition: 'background .2s', padding: 0 }}>
                    <span style={{ position: 'absolute', top: 2.5, left: done ? 19 : 2.5, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                  </button>
                  <button onClick={() => deleteOrder(o.id)} title="Sil" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, flexShrink: 0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {showSettings && <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />}
    </div>
  )
}

/* ── KPI kartı ── */
function Kpi({ label, big, sub, trend }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</p>
        {trend !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: trend >= 0 ? GREEN_BG : '#fef2f2', color: trend >= 0 ? GREEN : '#dc2626' }}>
            {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, margin: '8px 0 2px', color: '#111' }}>{big}</p>
      <p style={{ fontSize: 12, color: '#aaa' }}>{sub}</p>
    </div>
  )
}

/* ── SVG kombo grafik (bar = sipariş, çizgi = ciro) ── */
function DeliveryChart({ data }) {
  const W = 760, H = 240, padL = 30, padR = 44, padT = 14, padB = 26
  const cw = W - padL - padR, ch = H - padT - padB
  const maxO = Math.max(1, ...data.map(d => d.orders))
  const maxR = Math.max(1, ...data.map(d => d.revenue))
  const n = data.length || 1
  const bw = Math.max(2, (cw / n) * 0.55)
  const x = i => padL + (cw / n) * i + (cw / n) / 2
  const yO = v => padT + ch - (v / maxO) * ch
  const yR = v => padT + ch - (v / maxR) * ch
  const labelEvery = Math.ceil(n / 8)
  const linePts = data.map((d, i) => `${x(i)},${yR(d.revenue)}`).join(' ')

  if (!data.length) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13 }}>Veri yok</div>

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* yatay ızgara */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line key={i} x1={padL} y1={padT + ch * t} x2={W - padR} y2={padT + ch * t} stroke="#f0f0ee" strokeWidth="1" />
      ))}
      {/* barlar (sipariş) */}
      {data.map((d, i) => d.orders > 0 && (
        <rect key={i} x={x(i) - bw / 2} y={yO(d.orders)} width={bw} height={padT + ch - yO(d.orders)} rx={2} fill="#d9e8df" />
      ))}
      {/* ciro çizgisi */}
      <polyline points={linePts} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={yR(d.revenue)} r={d.revenue > 0 ? 2.5 : 0} fill={GREEN} />)}
      {/* x etiketleri */}
      {data.map((d, i) => i % labelEvery === 0 && (
        <text key={i} x={x(i)} y={H - 8} fontSize="9" fill="#bbb" textAnchor="middle">
          {new Date(d.d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
        </text>
      ))}
    </svg>
  )
}

/* ── Ayarlar modalı ── */
function SettingsModal({ settings, onSave, onClose }) {
  const [d, setD] = useState({ ...settings })
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const on = d.delivery_enabled

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '50px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>Paket Servisi Ayarları</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottom: `1px solid #f4f4f2`, marginBottom: 18 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>Paket Servisi Aktif</p>
              <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Müşteriler eve sipariş verebilir</p>
            </div>
            <button onClick={() => set('delivery_enabled', !on)} style={{ width: 50, height: 28, borderRadius: 20, border: 'none', cursor: 'pointer', position: 'relative', background: on ? GREEN : '#ddd', transition: 'background .2s' }}>
              <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </button>
          </div>
          <div style={{ opacity: on ? 1 : 0.4, pointerEvents: on ? 'auto' : 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FieldI label="Minimum Sipariş Tutarı (₾)" type="number" value={d.delivery_min_amount || ''} onChange={v => set('delivery_min_amount', v)} />
            <FieldI label="Teslimat Ücreti (₾)" type="number" value={d.delivery_fee || ''} onChange={v => set('delivery_fee', v)} />
            <FieldI label="Teslimat Yarıçapı (km)" type="number" step="0.5" value={d.delivery_radius_km || ''} onChange={v => set('delivery_radius_km', v)} />
            <div>
              <label style={fLabel}>Teslimat Notu</label>
              <textarea value={d.delivery_note || ''} onChange={e => set('delivery_note', e.target.value)} rows={3}
                placeholder="Teslimat süresi ~45 dk, sadece nakit..."
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(d)} style={{ padding: '10px 22px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

function FieldI({ label, value, onChange, type = 'text', step }) {
  return (
    <div>
      <label style={fLabel}>{label}</label>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }} />
    </div>
  )
}
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
function CogIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> }
