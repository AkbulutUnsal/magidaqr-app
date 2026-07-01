import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Mutfak Ekranı (KDS)  ·  /admin/mutfak
   Mutfak tableti için. Gelen siparişler canlı düşer.
   3 adım: Yeni → Hazırlanıyor → Hazır. İstasyon = ürün kategorisi.
   Sipariş durumu buradan ilerletilince Canlı Siparişler + garson + müşteri yansır.
   Şema: orders(status enum), order_items(goes_to_kitchen, item_note),
         menu_items(category_id, is_spicy, prep_time_min), menu_categories, tables.
   Eksik kolon toleranslı — Not (reis).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const AMBER = '#f59e0b'
const VIOLET = '#8b5cf6'
const RED = '#E8192C'

// KDS karanlık zemin
const BG = '#0e1418'
const PANEL = '#161d23'
const PANEL_2 = '#1d262d'
const LINE = '#2a343c'
const CARD = '#ffffff'
const INK = '#10171c'
const SUB = '#7c8892'

// Zaman eşikleri (dk) → renk
const WARN_MIN = 6
const LATE_MIN = 12

// durum → lane
const LANES = [
  { key: 'new', title: 'Yeni', color: AMBER, statuses: ['pending', 'confirmed'] },
  { key: 'preparing', title: 'Hazırlanıyor', color: VIOLET, statuses: ['preparing'] },
  { key: 'ready', title: 'Hazır', color: GREEN, statuses: ['ready'] },
]
const NEXT = { pending: 'preparing', confirmed: 'preparing', preparing: 'ready', ready: 'served' }
const PREV = { preparing: 'pending', ready: 'preparing' }
const NEXT_LABEL = { pending: '▶ Hazırlamaya Başla', confirmed: '▶ Hazırlamaya Başla', preparing: '✓ Hazır', ready: '✓ Teslim Edildi' }

const ACTIVE = ['pending', 'confirmed', 'preparing', 'ready']

export default function AdminKitchen() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)

  const [orders, setOrders] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [station, setStation] = useState('all')      // 'all' | category_id
  const [onlyKitchen, setOnlyKitchen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [fs, setFs] = useState(false)
  const [clock, setClock] = useState(Date.now())     // saniyelik tik → süre sayaçları
  const [checked, setChecked] = useState(() => new Set())  // görsel ilerleme (order_item.id)

  const ridRef = useRef(profile?.restaurant_id)
  const prevNewRef = useRef(null)
  const mutedRef = useRef(false)
  useEffect(() => { ridRef.current = profile?.restaurant_id }, [profile?.restaurant_id])
  useEffect(() => { mutedRef.current = muted }, [muted])

  // saniyelik tik
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(t) }, [])

  // fullscreen durumu takip
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  async function loadCats() {
    const rid = ridRef.current; if (!rid) return
    const { data } = await supabase.from('menu_categories')
      .select('id,name_tr,name_en,name_ka,name_ru,icon,sort_order,is_active')
      .eq('restaurant_id', rid).order('sort_order', { ascending: true })
    setCats((data || []).filter(c => c.is_active !== false))
  }

  async function load() {
    const rid = ridRef.current; if (!rid) return
    const { data } = await supabase.from('orders')
      .select('*, tables(table_number,label), order_items(*, menu_item:menu_items(name_tr,name_en,name_ka,name_ru,category_id,goes_to_kitchen,is_spicy,prep_time_min,prep_time))')
      .eq('restaurant_id', rid).in('status', ACTIVE).order('created_at', { ascending: true })
    const list = data || []
    // sesli uyarı: yeni sipariş sayısı arttıysa
    const newCount = list.filter(o => o.status === 'pending' || o.status === 'confirmed').length
    if (prevNewRef.current !== null && newCount > prevNewRef.current) beep()
    prevNewRef.current = newCount
    setOrders(list)
    setLoading(false)
  }

  useEffect(() => {
    if (!profile?.restaurant_id) return
    loadCats(); load()
    const ch = supabase.channel('kds-' + profile.restaurant_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${profile.restaurant_id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.restaurant_id])

  function beep() {
    if (mutedRef.current) return
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
      o.start(); o.stop(ctx.currentTime + 0.42)
    } catch (e) { /* Not (reis): tarayıcı sesi engellemiş olabilir */ }
  }

  const dispItem = mi => mi?.[`name_${lang}`] || mi?.name_tr || mi?.name_en || mi?.name_ka || 'Ürün'
  const dispCat = c => c?.[`name_${lang}`] || c?.name_tr || c?.name_en || c?.name_ka || 'Kategori'

  async function advance(o) { const n = NEXT[o.status]; if (n) await supabase.from('orders').update({ status: n }).eq('id', o.id) }
  async function back(o) { const p = PREV[o.status]; if (p) await supabase.from('orders').update({ status: p }).eq('id', o.id) }

  function toggleItem(id) {
    setChecked(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }

  // bir siparişin, seçili istasyon + mutfak filtresine göre görünen kalemleri
  function visItems(o) {
    let items = o.order_items || []
    if (onlyKitchen) items = items.filter(oi => (oi.goes_to_kitchen ?? oi.menu_item?.goes_to_kitchen) !== false)
    if (station !== 'all') items = items.filter(oi => oi.menu_item?.category_id === station)
    return items
  }

  const laneOrders = key => {
    const st = LANES.find(l => l.key === key).statuses
    return orders.filter(o => st.includes(o.status)).filter(o => visItems(o).length > 0)
  }

  // sadece siparişlerde geçen kategoriler → istasyon sekmeleri
  const activeCatIds = useMemo(() => {
    const set = new Set()
    orders.forEach(o => (o.order_items || []).forEach(oi => oi.menu_item?.category_id && set.add(oi.menu_item.category_id)))
    return set
  }, [orders])
  const stationTabs = useMemo(() => cats.filter(c => activeCatIds.has(c.id)), [cats, activeCatIds])

  const counts = useMemo(() => ({
    new: laneOrders('new').length, preparing: laneOrders('preparing').length, ready: laneOrders('ready').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [orders, station, onlyKitchen, clock])

  const timeStr = () => new Date(clock).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ background: BG, minHeight: '100vh', margin: '-24px', padding: '16px 18px 26px', color: '#e9eef2', fontFamily: 'inherit' }}>
      {/* ÜST BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>🍳</span>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1 }}>Mutfak Ekranı</h1>
            <p style={{ fontSize: 11.5, color: SUB, marginTop: 3 }}>Canlı sipariş akışı · {timeStr()}</p>
          </div>
        </div>

        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: GREEN, background: '#0d2b20', border: `1px solid ${GREEN}55`, padding: '5px 11px', borderRadius: 20 }}>
          <Dot color={GREEN} /> Canlı
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Stat n={counts.new} label="Yeni" color={AMBER} />
          <Stat n={counts.preparing} label="Hazırlanıyor" color={VIOLET} />
          <Stat n={counts.ready} label="Hazır" color={GREEN} />
          <IconBtn on={onlyKitchen} onClick={() => setOnlyKitchen(v => !v)} title="Sadece mutfağa gidenler">🍳</IconBtn>
          <IconBtn on={!muted} onClick={() => setMuted(v => !v)} title={muted ? 'Sesi aç' : 'Sesi kapat'}>{muted ? '🔇' : '🔔'}</IconBtn>
          <IconBtn on={fs} onClick={toggleFs} title="Tam ekran">{fs ? '🡼' : '⛶'}</IconBtn>
        </div>
      </div>

      {/* İSTASYON SEKMELERİ */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tab active={station === 'all'} onClick={() => setStation('all')} color="#fff">Tümü</Tab>
        {stationTabs.map(c => (
          <Tab key={c.id} active={station === c.id} onClick={() => setStation(c.id)} color={GREEN}>
            {c.icon ? c.icon + ' ' : ''}{dispCat(c)}
          </Tab>
        ))}
      </div>

      {/* LANE'LER */}
      {loading ? (
        <div style={{ background: PANEL, borderRadius: 16, padding: 70, textAlign: 'center', color: SUB, fontSize: 14 }}>Yükleniyor…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, alignItems: 'start' }}>
          {LANES.map(lane => {
            const list = laneOrders(lane.key)
            return (
              <div key={lane.key} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', borderBottom: `1px solid ${LINE}`, background: PANEL_2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 800, color: lane.color }}>
                    <Dot color={lane.color} /> {lane.title}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: BG, background: lane.color, borderRadius: 20, padding: '2px 11px' }}>{list.length}</span>
                </div>

                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 90, maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                  {list.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: '#41505a', textAlign: 'center', padding: '28px 0' }}>Bekleyen yok</p>
                  ) : list.map(o => (
                    <Ticket
                      key={o.id} o={o} lane={lane} now={clock} items={visItems(o)}
                      dispItem={dispItem} checked={checked} toggleItem={toggleItem}
                      onAdvance={() => advance(o)} onBack={PREV[o.status] ? () => back(o) : null}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: '#3f4d57', marginTop: 18, lineHeight: 1.6 }}>
        Durumu ilerlettiğinde Canlı Siparişler, garson paneli ve müşterinin takip ekranı anında güncellenir · İstasyon = ürün kategorisi.
      </p>
    </div>
  )
}

/* ── Sipariş fişi ── */
function Ticket({ o, lane, now, items, dispItem, checked, toggleItem, onAdvance, onBack }) {
  const mins = Math.floor((now - new Date(o.created_at).getTime()) / 60000)
  const secs = Math.floor((now - new Date(o.created_at).getTime()) / 1000)
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const timeColor = mins >= LATE_MIN ? RED : mins >= WARN_MIN ? AMBER : GREEN
  const allDone = items.length > 0 && items.every(oi => checked.has(oi.id))
  const table = o.tables?.table_number ?? '—'

  return (
    <div style={{ background: CARD, borderRadius: 13, padding: 13, color: INK, boxShadow: '0 1px 3px rgba(0,0,0,.35)', borderTop: `3px solid ${lane.color}` }}>
      {/* başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 19, fontWeight: 900, lineHeight: 1 }}>Masa {table}</p>
          <p style={{ fontSize: 11, color: '#8a97a1', marginTop: 3 }}>
            {o.order_number ? `#${o.order_number} · ` : ''}{o.tables?.label || ''}{o.tables?.label ? ' · ' : ''}{items.length} kalem
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 900, color: timeColor, background: timeColor + '18', border: `1px solid ${timeColor}44`, padding: '4px 9px', borderRadius: 9, fontVariantNumeric: 'tabular-nums' }}>
          ⏱ {mmss}
        </span>
      </div>

      {/* kalemler */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: o.note ? 10 : 12 }}>
        {items.map(oi => {
          const done = checked.has(oi.id)
          const spicy = oi.menu_item?.is_spicy
          return (
            <button key={oi.id} onClick={() => toggleItem(oi.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 9, textAlign: 'left', background: done ? '#f2f5f4' : '#f7f9f8', border: `1px solid ${done ? '#d9e5df' : '#eef1f0'}`, borderRadius: 9, padding: '8px 9px', cursor: 'pointer', width: '100%' }}>
              <span style={{ minWidth: 26, height: 26, borderRadius: 7, background: done ? GREEN : lane.color + '1f', color: done ? '#fff' : lane.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
                {done ? '✓' : oi.quantity}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: done ? '#9aa6ae' : INK, textDecoration: done ? 'line-through' : 'none' }}>
                  {dispItem(oi.menu_item)}{spicy ? ' 🌶️' : ''}
                </span>
                {oi.item_note && <span style={{ display: 'block', fontSize: 12, color: '#c2410c', marginTop: 2 }}>↳ {oi.item_note}</span>}
              </span>
            </button>
          )
        })}
      </div>

      {/* sipariş notu */}
      {o.note && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '7px 10px', marginBottom: 12 }}>
          <p style={{ fontSize: 12.5, color: '#9a3412', fontWeight: 600 }}>📝 {o.note}</p>
        </div>
      )}

      {/* aksiyon */}
      <div style={{ display: 'flex', gap: 7 }}>
        {onBack && (
          <button onClick={onBack} title="Geri al" style={{ background: '#fff', border: '1px solid #e3e8e6', borderRadius: 10, padding: '11px 13px', fontSize: 15, color: '#8a97a1', cursor: 'pointer', fontWeight: 700 }}>↩</button>
        )}
        <button onClick={onAdvance}
          style={{ flex: 1, background: allDone ? GREEN : lane.color, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: allDone ? `0 0 0 3px ${GREEN}33` : 'none', transition: 'box-shadow .2s' }}>
          {NEXT_LABEL[o.status] || 'İlerlet'}
        </button>
      </div>
    </div>
  )
}

/* ── küçük parçalar ── */
function Dot({ color }) {
  return <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
}
function Stat({ n, label, color }) {
  return (
    <div title={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 46, padding: '3px 8px', background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <span style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 9.5, color: SUB, marginTop: 2 }}>{label}</span>
    </div>
  )
}
function IconBtn({ children, onClick, title, on }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${on ? GREEN : LINE}`, background: on ? '#0d2b20' : PANEL, color: on ? GREEN : '#c6cfd6', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  )
}
function Tab({ children, active, onClick, color }) {
  return (
    <button onClick={onClick}
      style={{ padding: '8px 15px', borderRadius: 22, border: `1px solid ${active ? color : LINE}`, background: active ? (color === '#fff' ? '#fff' : '#0d2b20') : PANEL, color: active ? (color === '#fff' ? INK : color) : '#c6cfd6', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}
