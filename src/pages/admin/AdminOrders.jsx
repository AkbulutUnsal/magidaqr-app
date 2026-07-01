import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Canlı Siparişler  (sahibin kontrol kulesi · #1D9E75)
   Realtime: orders + table_calls. Kanban + çağrılar + günlük özet.
   Sahibi izler; gerekirse durum ilerletir/iptal eder (mutfak/garson'a yansır).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const AMBER = '#f59e0b'
const VIOLET = '#8b5cf6'
const BLUE = '#3b82f6'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

// durum → kolon eşlemesi
const COLUMNS = [
  { key: 'waiting', title: 'Bekliyor', color: AMBER, statuses: ['pending', 'confirmed'] },
  { key: 'preparing', title: 'Hazırlanıyor', color: VIOLET, statuses: ['preparing'] },
  { key: 'ready', title: 'Hazır', color: GREEN, statuses: ['ready'] },
  { key: 'served', title: 'Servis Edildi · Bugün', color: '#9ca3af', statuses: ['served'] },
]
const NEXT = { pending: 'preparing', confirmed: 'preparing', preparing: 'ready', ready: 'served' }
const NEXT_LABEL = { pending: 'Hazırlamaya al', confirmed: 'Hazırlamaya al', preparing: 'Hazır işaretle', ready: 'Servis edildi' }

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
const money = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + '₾'
const ago = ts => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'az önce'
  const m = Math.floor(s / 60); if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60); return `${h} sa önce`
}

export default function AdminOrders() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)
  const [orders, setOrders] = useState([])
  const [calls, setCalls] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [pulse, setPulse] = useState(false)
  const ridRef = useRef(profile?.restaurant_id)
  useEffect(() => { ridRef.current = profile?.restaurant_id }, [profile?.restaurant_id])

  async function load() {
    const rid = ridRef.current
    if (!rid) return
    const [{ data: active }, { data: servedToday }, { data: callData }, { data: tableData }] = await Promise.all([
      supabase.from('orders').select('*, tables(table_number,label), order_items(*, menu_item:menu_items(name_tr,name_en,name_ka,name_ru))')
        .eq('restaurant_id', rid).in('status', ['pending', 'confirmed', 'preparing', 'ready']).order('created_at', { ascending: true }),
      supabase.from('orders').select('*, tables(table_number,label), order_items(*, menu_item:menu_items(name_tr,name_en,name_ka,name_ru))')
        .eq('restaurant_id', rid).eq('status', 'served').gte('created_at', startOfToday()).order('created_at', { ascending: false }),
      supabase.from('table_calls').select('*, tables(table_number,label)').eq('restaurant_id', rid).eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('tables').select('id,table_number,label,is_active').eq('restaurant_id', rid).order('table_number', { ascending: true }),
    ])
    setOrders([...(active || []), ...(servedToday || [])])
    setCalls(callData || [])
    setTables((tableData || []).filter(t => t.is_active !== false))
    setLoading(false)
  }

  useEffect(() => {
    if (!profile?.restaurant_id) return
    load()
    const ch = supabase.channel('admin-orders-' + profile.restaurant_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${profile.restaurant_id}` }, () => { flash(); load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_calls', filter: `restaurant_id=eq.${profile.restaurant_id}` }, () => { flash(); load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => { load() })
      .subscribe()
    return () => supabase.removeChannel(ch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.restaurant_id])

  function flash() { setPulse(true); setTimeout(() => setPulse(false), 600) }

  const dispItem = mi => mi?.[`name_${lang}`] || mi?.name_tr || mi?.name_en || mi?.name_ka || 'Ürün'
  async function advance(o) { const n = NEXT[o.status]; if (n) await supabase.from('orders').update({ status: n }).eq('id', o.id) }
  async function cancel(o) { if (confirm(`Masa ${o.tables?.table_number} siparişi iptal edilsin mi?`)) await supabase.from('orders').update({ status: 'cancelled' }).eq('id', o.id) }
  async function closeCall(c) { await supabase.from('table_calls').update({ status: 'closed' }).eq('id', c.id) }

  // özet
  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todays = orders.filter(o => new Date(o.created_at) >= todayStart && o.status !== 'cancelled')
    return {
      active: orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length,
      calls: calls.length,
      todayCount: todays.length,
      todayRevenue: todays.reduce((s, o) => s + Number(o.total_price || 0), 0),
    }
  }, [orders, calls])

  const floor = useMemo(() => {
    const m = {}
    tables.forEach(t => { m[t.id] = { ...t, call: null, ready: 0, active: 0 } })
    calls.forEach(c => { if (m[c.table_id]) m[c.table_id].call = c.type === 'bill' ? 'bill' : 'waiter' })
    orders.forEach(o => {
      if (!o.table_id || !m[o.table_id]) return
      if (o.status === 'ready') m[o.table_id].ready++
      else if (['pending', 'confirmed', 'preparing'].includes(o.status)) m[o.table_id].active++
    })
    return Object.values(m)
  }, [tables, orders, calls])

  const byCol = key => orders.filter(o => COLUMNS.find(c => c.key === key).statuses.includes(o.status))

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Canlı Siparişler</h1>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: GREEN, background: GREEN_BG, padding: '4px 11px', borderRadius: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: pulse ? `0 0 0 6px ${GREEN}33` : 'none', transition: 'box-shadow .3s' }} /> Canlı
        </span>
      </div>

      {/* özet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi big={stats.active} label="Aktif Sipariş" color={GREEN} />
        <Kpi big={stats.calls} label="Açık Çağrı" color={stats.calls ? RED : '#111'} />
        <Kpi big={stats.todayCount} label="Bugün Sipariş" />
        <Kpi big={money(stats.todayRevenue)} label="Bugün Ciro" color={GREEN} small />
      </div>

      {/* çağrılar */}
      {calls.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>🔔 Masa Çağrıları <span style={{ fontSize: 11, color: '#fff', background: RED, borderRadius: 20, padding: '1px 8px' }}>{calls.length}</span></p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
            {calls.map(c => {
              const bill = c.type === 'bill'
              const col = bill ? AMBER : GREEN
              return (
                <div key={c.id} style={{ border: `1px solid ${col}`, background: col + '11', borderRadius: 12, padding: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 2 }}>{bill ? '🧾 Hesap İsteniyor' : '🔔 Garson Çağrısı'}</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#111' }}>Masa {c.tables?.table_number}{c.tables?.label && <span style={{ fontSize: 11, fontWeight: 400, color: '#aaa', marginLeft: 6 }}>{c.tables.label}</span>}</p>
                  <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 10px' }}>{ago(c.created_at)}</p>
                  <button onClick={() => closeCall(c)} style={{ width: '100%', background: col, color: bill ? '#000' : '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Kapat</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* masa durumu · salon planı */}
      {tables.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>🪑 Masa Durumu <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>· canlı</span></p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 8 }}>
            {floor.map(t => {
              const s = t.call === 'bill' ? { c: AMBER, t: 'Hesap' }
                : t.call === 'waiter' ? { c: RED, t: 'Çağrı' }
                  : t.ready ? { c: GREEN, t: 'Hazır' }
                    : t.active ? { c: VIOLET, t: 'Hazırlanıyor' }
                      : { c: '#d1d5db', t: 'Boş' }
              return (
                <div key={t.id} style={{ border: `1.5px solid ${s.c}`, background: s.c + '10', borderRadius: 10, padding: '9px 6px', textAlign: 'center' }}>
                  <p style={{ fontSize: 17, fontWeight: 900, color: '#111', lineHeight: 1 }}>{t.table_number}</p>
                  {t.label && <p style={{ fontSize: 9, color: '#bbb', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</p>}
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: s.c, marginTop: 4 }}>{s.t}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* kanban */}
      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, alignItems: 'start' }}>
          {COLUMNS.map(col => {
            const list = byCol(col.key)
            return (
              <div key={col.key} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, background: col.color + '10' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: col.color }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} /> {col.title}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: col.color, borderRadius: 20, padding: '1px 9px' }}>{list.length}</span>
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto', minHeight: 80 }}>
                  {list.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>—</p>
                  ) : list.map(o => (
                    <div key={o.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 11, padding: 12, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>Masa {o.tables?.table_number || '—'}</p>
                          <p style={{ fontSize: 10.5, color: '#aaa' }}>{ago(o.created_at)} · {(() => { const t = o.order_items?.length || 0; const r = o.order_items?.filter(i => i.is_ready).length || 0; return r > 0 ? `${r}/${t} hazır` : `${t} kalem` })()}</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>{money(o.total_price)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: o.note ? 8 : 10 }}>
                        {o.order_items?.slice(0, 6).map(oi => (
                          <div key={oi.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: oi.is_ready ? '#9ca3af' : '#555' }}>
                            <span style={{ minWidth: 20, height: 20, borderRadius: 5, background: oi.is_ready ? GREEN : col.color + '22', color: oi.is_ready ? '#fff' : col.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{oi.is_ready ? '✓' : oi.quantity}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: oi.is_ready ? 'line-through' : 'none' }}>{dispItem(oi.menu_item)}</span>
                          </div>
                        ))}
                        {o.order_items?.length > 6 && <span style={{ fontSize: 11, color: '#bbb' }}>+{o.order_items.length - 6} kalem…</span>}
                      </div>
                      {o.note && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '6px 9px', marginBottom: 10 }}><p style={{ fontSize: 11, color: '#92620a' }}>📝 {o.note}</p></div>}
                      {col.key !== 'served' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => advance(o)} style={{ flex: 1, background: col.color, color: col.key === 'ready' ? '#fff' : '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{NEXT_LABEL[o.status] || 'İlerlet'}</button>
                          <button onClick={() => cancel(o)} title="İptal" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: RED, cursor: 'pointer' }}>✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 16, lineHeight: 1.6 }}>
        Bu ekran anlıktır — yeni sipariş/çağrı geldiğinde otomatik güncellenir. Durum ilerletirsen mutfak, garson ve müşterinin takip ekranına da yansır.
      </p>
    </div>
  )
}

function Kpi({ big, label, color = '#111', small }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
      <p style={{ fontSize: small ? 24 : 30, fontWeight: 900, color }}>{big}</p>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, marginTop: 2 }}>{label}</p>
    </div>
  )
}
