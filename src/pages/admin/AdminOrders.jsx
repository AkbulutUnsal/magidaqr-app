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
const STATUS_META = {
  pending: { label: 'Bekliyor', color: AMBER },
  confirmed: { label: 'Onaylandı', color: AMBER },
  preparing: { label: 'Hazırlanıyor', color: VIOLET },
  ready: { label: 'Hazır', color: GREEN },
  served: { label: 'Servis edildi', color: '#9ca3af' },
}

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
  const [selTableId, setSelTableId] = useState(null)
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
  async function toggleItemReady(order, oi) {
    const next = !oi.is_ready
    const patch = { is_ready: next, ready_at: next ? new Date().toISOString() : null }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, order_items: (o.order_items || []).map(x => x.id === oi.id ? { ...x, ...patch } : x) } : o))
    const { error } = await supabase.from('order_items').update(patch).eq('id', oi.id)
    if (error) load()  // Not (reis): yetki/hata olursa gerçek durumu geri çek
  }

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
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>🪑 Masa Durumu <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>· canlı · masaya tıkla → detay</span></p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 8 }}>
            {floor.map(t => {
              const s = t.call === 'bill' ? { c: AMBER, t: 'Hesap' }
                : t.call === 'waiter' ? { c: RED, t: 'Çağrı' }
                  : t.ready ? { c: GREEN, t: 'Hazır' }
                    : t.active ? { c: VIOLET, t: 'Hazırlanıyor' }
                      : { c: '#d1d5db', t: 'Boş' }
              const orderCount = t.ready + t.active
              return (
                <button key={t.id} onClick={() => setSelTableId(t.id)}
                  style={{ position: 'relative', border: `1.5px solid ${s.c}`, background: s.c + '10', borderRadius: 10, padding: '9px 6px', textAlign: 'center', cursor: 'pointer', font: 'inherit' }}>
                  {orderCount > 0 && <span style={{ position: 'absolute', top: 4, right: 5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: s.c, color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{orderCount}</span>}
                  <p style={{ fontSize: 17, fontWeight: 900, color: '#111', lineHeight: 1 }}>{t.table_number}</p>
                  {t.label && <p style={{ fontSize: 9, color: '#bbb', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</p>}
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: s.c, marginTop: 4 }}>{s.t}</p>
                </button>
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

      {selTableId && (
        <TableDrawer
          table={tables.find(t => t.id === selTableId)}
          orders={orders.filter(o => o.table_id === selTableId && ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status))}
          calls={calls.filter(c => c.table_id === selTableId)}
          dispItem={dispItem}
          onAdvance={advance} onCancel={cancel} onCloseCall={closeCall} onToggleItem={toggleItemReady}
          onClose={() => setSelTableId(null)}
        />
      )}
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

/* ── Masa Detay Paneli (sağdan drawer) ──
   Seçili masanın tüm aktif siparişleri + açık çağrıları.
   Sahip buradan: kalem kalem hazır işaretler, durum ilerletir, çağrı kapatır, iptal eder. */
function TableDrawer({ table, orders, calls, dispItem, onAdvance, onCancel, onCloseCall, onToggleItem, onClose }) {
  const total = orders.reduce((s, o) => s + Number(o.total_price || 0), 0)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px,100%)', height: '100%', background: '#f6f7f6', overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>
        {/* başlık */}
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 2 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#111' }}>Masa {table?.table_number ?? '—'}
              {table?.label && <span style={{ fontSize: 12, fontWeight: 400, color: '#aaa', marginLeft: 8 }}>{table.label}</span>}</p>
            <p style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
              {orders.length} aktif sipariş{calls.length ? ` · ${calls.length} çağrı` : ''}{total ? ` · ${money(total)}` : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 17, color: '#666', cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* çağrılar */}
          {calls.map(c => {
            const bill = c.type === 'bill'; const col = bill ? AMBER : GREEN
            return (
              <div key={c.id} style={{ border: `1.5px solid ${col}`, background: col + '11', borderRadius: 12, padding: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{bill ? '🧾' : '🔔'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: col }}>{bill ? 'Hesap İsteniyor' : 'Garson Çağrısı'}</p>
                  <p style={{ fontSize: 11, color: '#aaa' }}>{ago(c.created_at)}</p>
                </div>
                <button onClick={() => onCloseCall(c)} style={{ background: col, color: bill ? '#000' : '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Kapat</button>
              </div>
            )
          })}

          {/* boş durum */}
          {orders.length === 0 && calls.length === 0 && (
            <div style={{ textAlign: 'center', padding: '52px 20px', color: '#bbb' }}>
              <p style={{ fontSize: 34, marginBottom: 8 }}>🍽️</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#999' }}>Bu masada aktif sipariş yok</p>
            </div>
          )}

          {/* siparişler */}
          {orders.map(o => {
            const meta = STATUS_META[o.status] || { label: o.status, color: MUTED }
            const t = o.order_items?.length || 0
            const r = (o.order_items || []).filter(i => i.is_ready).length
            return (
              <div key={o.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 13, padding: 14, borderTop: `3px solid ${meta.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: meta.color }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} /> {meta.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{o.order_number ? `#${o.order_number} · ` : ''}{ago(o.created_at)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                  {(o.order_items || []).map(oi => {
                    const done = oi.is_ready
                    return (
                      <button key={oi.id} onClick={() => onToggleItem(o, oi)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 9, textAlign: 'left', width: '100%', background: done ? '#f2f5f4' : '#fafafa', border: `1px solid ${done ? '#d9e5df' : '#eee'}`, borderRadius: 9, padding: '8px 10px', cursor: 'pointer' }}>
                        <span style={{ minWidth: 24, height: 24, borderRadius: 6, background: done ? GREEN : meta.color + '22', color: done ? '#fff' : meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{done ? '✓' : oi.quantity}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: done ? '#9aa6ae' : '#222', textDecoration: done ? 'line-through' : 'none' }}>{dispItem(oi.menu_item)}</span>
                          {oi.item_note && <span style={{ display: 'block', fontSize: 11.5, color: '#c2410c', marginTop: 1 }}>↳ {oi.item_note}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {t > 0 && <p style={{ fontSize: 11, color: r === t && t > 0 ? GREEN : MUTED, fontWeight: r === t && t > 0 ? 700 : 400, marginBottom: o.note ? 8 : 10 }}>{r}/{t} kalem hazır</p>}
                {o.note && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '6px 9px', marginBottom: 10 }}><p style={{ fontSize: 11.5, color: '#92620a' }}>📝 {o.note}</p></div>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>{money(o.total_price)}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button onClick={() => onCancel(o)} title="İptal" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, color: RED, cursor: 'pointer' }}>✕</button>
                    {NEXT[o.status] && <button onClick={() => onAdvance(o)} style={{ background: meta.color, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{NEXT_LABEL[o.status]}</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
