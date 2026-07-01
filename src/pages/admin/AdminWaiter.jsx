import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Garson Paneli  ·  /admin/garson
   Garson telefonu için (mobil-öncelikli). 3 sekme:
   🔔 Çağrılar  (table_calls: garson çağrısı / hesap)
   🍽️ Servis     (status='ready' siparişler → Servis Edildi = served)
   🪑 Masalar    (salon durumu: çağrı / hazır / hazırlanıyor / boş)
   Realtime: orders + table_calls. Eksik kolon toleranslı — Not (reis).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const AMBER = '#f59e0b'
const VIOLET = '#8b5cf6'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const money = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + '₾'
const ago = ts => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'az önce'
  const m = Math.floor(s / 60); if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60); return `${h} sa önce`
}
// table_calls.type → görünüm
const callView = t => t === 'bill'
  ? { label: 'Hesap İsteniyor', icon: '🧾', color: AMBER, textOnBtn: '#000' }
  : { label: 'Garson Çağrısı', icon: '🔔', color: GREEN, textOnBtn: '#fff' }

export default function AdminWaiter() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)

  const [tab, setTab] = useState('calls')
  const [calls, setCalls] = useState([])
  const [orders, setOrders] = useState([])   // aktif siparişler (pending..ready)
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(false)

  const ridRef = useRef(profile?.restaurant_id)
  const prevCallsRef = useRef(null)
  const mutedRef = useRef(false)
  useEffect(() => { ridRef.current = profile?.restaurant_id }, [profile?.restaurant_id])
  useEffect(() => { mutedRef.current = muted }, [muted])

  async function loadTables() {
    const rid = ridRef.current; if (!rid) return
    const { data } = await supabase.from('tables')
      .select('id,table_number,label,is_active').eq('restaurant_id', rid).order('table_number', { ascending: true })
    setTables((data || []).filter(t => t.is_active !== false))
  }

  async function load() {
    const rid = ridRef.current; if (!rid) return
    const [{ data: ord }, { data: cl }] = await Promise.all([
      supabase.from('orders')
        .select('*, tables(table_number,label), order_items(*, menu_item:menu_items(name_tr,name_en,name_ka,name_ru))')
        .eq('restaurant_id', rid).in('status', ['pending', 'confirmed', 'preparing', 'ready']).order('created_at', { ascending: true }),
      supabase.from('table_calls')
        .select('*, tables(table_number,label)').eq('restaurant_id', rid).eq('status', 'open').order('created_at', { ascending: false }),
    ])
    const callList = cl || []
    if (prevCallsRef.current !== null && callList.length > prevCallsRef.current) notify()
    prevCallsRef.current = callList.length
    setOrders(ord || [])
    setCalls(callList)
    setLoading(false)
  }

  useEffect(() => {
    if (!profile?.restaurant_id) return
    loadTables(); load()
    const ch = supabase.channel('waiter-' + profile.restaurant_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${profile.restaurant_id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_calls', filter: `restaurant_id=eq.${profile.restaurant_id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.restaurant_id])

  function notify() {
    if (mutedRef.current) return
    try { navigator.vibrate?.([120, 60, 120]) } catch (e) { /* Not (reis) */ }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.value = 660
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
      o.start(); o.stop(ctx.currentTime + 0.52)
    } catch (e) { /* Not (reis) */ }
  }

  const dispItem = mi => mi?.[`name_${lang}`] || mi?.name_tr || mi?.name_en || mi?.name_ka || 'Ürün'
  async function closeCall(c) { await supabase.from('table_calls').update({ status: 'closed' }).eq('id', c.id) }
  async function serve(o) { await supabase.from('orders').update({ status: 'served' }).eq('id', o.id) }

  const ready = orders.filter(o => o.status === 'ready')
  const preparing = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status))

  // masa durumu haritası
  const tableState = useMemo(() => {
    const m = {}
    tables.forEach(t => { m[t.id] = { ...t, call: null, ready: 0, active: 0 } })
    calls.forEach(c => { if (m[c.table_id]) m[c.table_id].call = c.type === 'bill' ? 'bill' : 'waiter' })
    orders.forEach(o => {
      if (!o.table_id || !m[o.table_id]) return
      if (o.status === 'ready') m[o.table_id].ready++
      else m[o.table_id].active++
    })
    return Object.values(m)
  }, [tables, calls, orders])

  const tabs = [
    { key: 'calls', label: 'Çağrılar', icon: '🔔', badge: calls.length, badgeColor: RED },
    { key: 'serve', label: 'Servis', icon: '🍽️', badge: ready.length, badgeColor: GREEN },
    { key: 'tables', label: 'Masalar', icon: '🪑', badge: 0 },
  ]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 20 }}>
      {/* başlık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Garson Paneli</h1>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: GREEN, background: GREEN_BG, padding: '4px 10px', borderRadius: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} /> Canlı
        </span>
        <button onClick={() => setMuted(v => !v)} title={muted ? 'Bildirimi aç' : 'Bildirimi kapat'}
          style={{ marginLeft: 'auto', width: 38, height: 38, borderRadius: 10, border: `1px solid ${muted ? BORDER : GREEN}`, background: muted ? '#fff' : GREEN_BG, color: muted ? MUTED : GREEN, fontSize: 16, cursor: 'pointer' }}>
          {muted ? '🔕' : '🔔'}
        </button>
      </div>

      {/* sekmeler */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, position: 'relative', padding: '11px 6px', borderRadius: 12, border: `1px solid ${tab === t.key ? GREEN : BORDER}`, background: tab === t.key ? GREEN : '#fff', color: tab === t.key ? '#fff' : '#333', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
            {t.badge > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 10, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 10, background: tab === t.key ? '#fff' : t.badgeColor, color: tab === t.key ? GREEN : '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 50, textAlign: 'center', color: '#bbb' }}>Yükleniyor…</div>
      ) : tab === 'calls' ? (
        <CallsTab calls={calls} closeCall={closeCall} />
      ) : tab === 'serve' ? (
        <ServeTab ready={ready} preparing={preparing} dispItem={dispItem} serve={serve} />
      ) : (
        <TablesTab list={tableState} />
      )}
    </div>
  )
}

/* ── Çağrılar ── */
function CallsTab({ calls, closeCall }) {
  if (calls.length === 0) return <Empty icon="🔔" title="Açık çağrı yok" sub="Masalardan çağrı geldiğinde burada belirir." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {calls.map(c => {
        const v = callView(c.type)
        return (
          <div key={c.id} style={{ background: '#fff', border: `1.5px solid ${v.color}`, borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 30 }}>{v.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: v.color }}>{v.label}</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#111' }}>Masa {c.tables?.table_number ?? '—'}
                {c.tables?.label && <span style={{ fontSize: 12, fontWeight: 400, color: '#aaa', marginLeft: 7 }}>{c.tables.label}</span>}
              </p>
              <p style={{ fontSize: 11.5, color: '#aaa', marginTop: 1 }}>{ago(c.created_at)}</p>
            </div>
            <button onClick={() => closeCall(c)}
              style={{ background: v.color, color: v.textOnBtn, border: 'none', borderRadius: 11, padding: '13px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ İlgilendim</button>
          </div>
        )
      })}
    </div>
  )
}

/* ── Servis ── */
function ServeTab({ ready, preparing, dispItem, serve }) {
  return (
    <div>
      {ready.length === 0 ? (
        <Empty icon="🍽️" title="Servise hazır sipariş yok" sub="Mutfak bir siparişi 'Hazır' işaretleyince burada görünür." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ready.map(o => (
            <div key={o.id} style={{ background: '#fff', border: `1.5px solid ${GREEN}`, borderRadius: 14, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: GREEN }}>✓ HAZIR · SERVİSE GÖTÜR</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#111' }}>Masa {o.tables?.table_number ?? '—'}
                    {o.tables?.label && <span style={{ fontSize: 12, fontWeight: 400, color: '#aaa', marginLeft: 7 }}>{o.tables.label}</span>}
                  </p>
                  <p style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{o.order_number ? `#${o.order_number} · ` : ''}{ago(o.created_at)}</p>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: GREEN }}>{money(o.total_price)}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {(o.order_items || []).map(oi => (
                  <span key={oi.id} style={{ fontSize: 12.5, background: GREEN_BG, color: '#0f5c40', borderRadius: 8, padding: '5px 9px', fontWeight: 600 }}>
                    {oi.quantity}× {dispItem(oi.menu_item)}
                  </span>
                ))}
              </div>
              {o.note && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', marginBottom: 12 }}><p style={{ fontSize: 12, color: '#92620a' }}>📝 {o.note}</p></div>}
              <button onClick={() => serve(o)}
                style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 11, padding: '13px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>🍽️ Servis Edildi</button>
            </div>
          ))}
        </div>
      )}

      {/* hazırlananlar - bilgi */}
      {preparing.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 10 }}>Mutfakta hazırlanıyor · {preparing.length}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {preparing.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa', border: `1px solid ${BORDER}`, borderRadius: 11, padding: '10px 13px' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.status === 'preparing' ? VIOLET : AMBER, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>Masa {o.tables?.table_number ?? '—'}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>{o.order_items?.length || 0} kalem</span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: o.status === 'preparing' ? VIOLET : AMBER, fontWeight: 700 }}>
                  {o.status === 'preparing' ? 'Hazırlanıyor' : 'Bekliyor'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Masalar ── */
function TablesTab({ list }) {
  if (list.length === 0) return <Empty icon="🪑" title="Masa bulunamadı" sub="Masalar sayfasından masa eklediğinde burada görünür." />
  const stateOf = t => {
    if (t.call === 'bill') return { c: AMBER, t: '🧾 Hesap', bg: '#fffbeb' }
    if (t.call === 'waiter') return { c: RED, t: '🔔 Çağrı', bg: '#fef2f2' }
    if (t.ready) return { c: GREEN, t: '✓ Hazır', bg: GREEN_BG }
    if (t.active) return { c: VIOLET, t: 'Hazırlanıyor', bg: '#f5f3ff' }
    return { c: '#cbd5d0', t: 'Boş', bg: '#fff' }
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 10 }}>
      {list.map(t => {
        const s = stateOf(t)
        return (
          <div key={t.id} style={{ background: s.bg, border: `1.5px solid ${s.c}`, borderRadius: 13, padding: '13px 8px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#111', lineHeight: 1 }}>{t.table_number}</p>
            {t.label && <p style={{ fontSize: 10, color: '#aaa', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</p>}
            <p style={{ fontSize: 11, fontWeight: 800, color: s.c, marginTop: 6 }}>{s.t}</p>
          </div>
        )
      })}
    </div>
  )
}

/* ── boş durum ── */
function Empty({ icon, title, sub }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 40, marginBottom: 10 }}>{icon}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{title}</p>
      <p style={{ fontSize: 12.5, color: MUTED, marginTop: 5 }}>{sub}</p>
    </div>
  )
}
