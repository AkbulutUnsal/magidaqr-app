import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Stok / Envanter (Faz 3)  ·  /admin/stok
   Ürün bazlı stok: takip aç/kapa, miktar, kritik seviye.
   Sipariş düşünce otomatik azalır (DB trigger). 0'da otomatik tükendi.
   Şema: menu_items(track_stock,stock_qty,stock_low_at,is_sold_out), stock_movements.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const AMBER = '#f59e0b'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const fmtDate = ts => ts ? new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const REASON_TR = { order: 'Sipariş', restock: 'Stok girişi', adjust: 'Düzeltme', waste: 'Fire/Zayi' }

export default function AdminStock() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)

  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tracked') // all | tracked | low | out
  const [restock, setRestock] = useState(null)     // {item}
  const [histId, setHistId] = useState(null)       // menu_item_id
  const ridRef = useRef(profile?.restaurant_id)
  useEffect(() => { ridRef.current = profile?.restaurant_id }, [profile?.restaurant_id])

  async function load() {
    const rid = ridRef.current; if (!rid) return
    const [{ data: it }, { data: c }] = await Promise.all([
      supabase.from('menu_items').select('id,name_tr,name_en,name_ka,name_ru,category_id,price,track_stock,stock_qty,stock_low_at,is_sold_out,sort_order').eq('restaurant_id', rid).order('sort_order', { ascending: true }),
      supabase.from('menu_categories').select('id,name_tr,name_en,name_ka,name_ru').eq('restaurant_id', rid),
    ])
    setItems(it || [])
    setCats(c || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!profile?.restaurant_id) return
    load()
    const ch = supabase.channel('stock-' + profile.restaurant_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${profile.restaurant_id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements', filter: `restaurant_id=eq.${profile.restaurant_id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.restaurant_id])

  const dispItem = i => i?.[`name_${lang}`] || i?.name_tr || i?.name_en || i?.name_ka || 'Ürün'
  const dispCat = c => c?.[`name_${lang}`] || c?.name_tr || c?.name_en || c?.name_ka || ''
  const catName = id => dispCat(cats.find(c => c.id === id))

  const lowOf = i => i.track_stock && i.stock_qty > 0 && i.stock_qty <= (i.stock_low_at ?? 5)
  const outOf = i => i.track_stock && i.stock_qty <= 0

  const stats = useMemo(() => ({
    tracked: items.filter(i => i.track_stock).length,
    low: items.filter(lowOf).length,
    out: items.filter(outOf).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items])

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return items.filter(i => {
      if (filter === 'tracked' && !i.track_stock) return false
      if (filter === 'low' && !lowOf(i)) return false
      if (filter === 'out' && !outOf(i)) return false
      if (q && !dispItem(i).toLocaleLowerCase('tr').includes(q)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, search, lang])

  async function toggleTrack(it) {
    await supabase.from('menu_items').update({ track_stock: !it.track_stock }).eq('id', it.id)
    load()
  }
  async function setLow(it, val) {
    await supabase.from('menu_items').update({ stock_low_at: Math.max(0, val) }).eq('id', it.id)
    load()
  }
  async function applyMovement(it, delta, reason) {
    const rid = ridRef.current
    const next = Math.max(0, Number(it.stock_qty || 0) + delta)
    const patch = { stock_qty: next }
    if (next > 0 && it.is_sold_out) patch.is_sold_out = false  // stok girince tükendi kalksın
    await supabase.from('menu_items').update(patch).eq('id', it.id)
    await supabase.from('stock_movements').insert({ restaurant_id: rid, menu_item_id: it.id, delta, reason })
    setRestock(null); load()
  }

  const FILTERS = [
    { key: 'tracked', label: 'Takipli' },
    { key: 'low', label: `Kritik${stats.low ? ' · ' + stats.low : ''}` },
    { key: 'out', label: `Tükenen${stats.out ? ' · ' + stats.out : ''}` },
    { key: 'all', label: 'Tümü' },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>Stok / Envanter</h1>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi big={stats.tracked} label="Takipli Ürün" color={GREEN} />
        <Kpi big={stats.low} label="Kritik Seviye" color={stats.low ? AMBER : '#111'} />
        <Kpi big={stats.out} label="Tükenen" color={stats.out ? RED : '#111'} />
      </div>

      {/* arama + filtre */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün ara…"
          style={{ flex: 1, minWidth: 180, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 14, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '8px 13px', borderRadius: 10, border: `1px solid ${filter === f.key ? GREEN : BORDER}`, background: filter === f.key ? GREEN : '#fff', color: filter === f.key ? '#fff' : '#555', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* liste */}
      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor…</div>
      ) : visible.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 10 }}>📦</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{filter === 'tracked' ? 'Stok takipli ürün yok' : 'Ürün bulunamadı'}</p>
          <p style={{ fontSize: 12.5, color: MUTED, marginTop: 5 }}>Bir ürünün "Stok takibi"ni açarak başla.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          {visible.map((it, idx) => {
            const out = outOf(it); const low = lowOf(it)
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderTop: idx ? '1px solid #f2f2f0' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dispItem(it)}
                    {out && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: RED, borderRadius: 6, padding: '2px 6px', marginLeft: 8 }}>TÜKENDİ</span>}
                    {low && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: AMBER, borderRadius: 6, padding: '2px 6px', marginLeft: 8 }}>KRİTİK</span>}
                  </p>
                  <p style={{ fontSize: 11.5, color: '#aaa' }}>{catName(it.category_id) || '—'}</p>
                </div>

                {it.track_stock ? (
                  <>
                    <div style={{ textAlign: 'center', minWidth: 62 }}>
                      <p style={{ fontSize: 20, fontWeight: 900, color: out ? RED : low ? AMBER : '#111', lineHeight: 1 }}>{it.stock_qty}</p>
                      <p style={{ fontSize: 9.5, color: '#bbb', marginTop: 2 }}>adet · kritik {it.stock_low_at ?? 5}</p>
                    </div>
                    <button onClick={() => setRestock(it)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Stok</button>
                    <button onClick={() => setHistId(it.id)} title="Hareketler" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 11px', fontSize: 13, color: '#888', cursor: 'pointer' }}>🕘</button>
                    <button onClick={() => toggleTrack(it)} title="Takibi kapat" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 11px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}>✕</button>
                  </>
                ) : (
                  <button onClick={() => toggleTrack(it)} style={{ background: GREEN_BG, color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 9, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Stok takibini aç</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {restock && <RestockModal it={restock} dispItem={dispItem} onCancel={() => setRestock(null)} onApply={applyMovement} onSetLow={setLow} />}
      {histId && <HistoryDrawer itemId={histId} name={dispItem(items.find(i => i.id === histId) || {})} onClose={() => setHistId(null)} />}
    </div>
  )
}

/* ── Stok girişi / düzeltme ── */
function RestockModal({ it, dispItem, onCancel, onApply, onSetLow }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('restock')
  const [low, setLow] = useState(String(it.stock_low_at ?? 5))
  const inp = { width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none' }
  const n = parseInt(amount || 0, 10)
  const isWaste = reason === 'waste'
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px,100%)', background: '#fff', borderRadius: 16, padding: 20 }}>
        <p style={{ fontSize: 17, fontWeight: 900 }}>{dispItem(it)}</p>
        <p style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>Mevcut: <b style={{ color: '#111' }}>{it.stock_qty}</b> adet</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['restock', '📥 Stok girişi'], ['waste', '🗑️ Fire'], ['adjust', '✏️ Düzeltme']].map(([k, l]) => (
            <button key={k} onClick={() => setReason(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: `1px solid ${reason === k ? GREEN : BORDER}`, background: reason === k ? GREEN_BG : '#fff', color: reason === k ? GREEN : '#666', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>{isWaste ? 'Düşülecek adet' : 'Eklenecek adet'}</label>
        <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={{ ...inp, marginTop: 4, marginBottom: 12 }} placeholder="0" autoFocus />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Kritik seviye eşiği</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 16 }}>
          <input value={low} onChange={e => setLow(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={{ ...inp, flex: 1 }} />
          <button onClick={() => onSetLow(it, parseInt(low || 0, 10))} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0 14px', fontSize: 12.5, fontWeight: 700, color: '#555', cursor: 'pointer' }}>Kaydet</button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#666', cursor: 'pointer' }}>Kapat</button>
          <button onClick={() => n && onApply(it, isWaste ? -n : n, reason)} disabled={!n}
            style={{ flex: 1, background: !n ? '#cbd5d0' : (isWaste ? RED : GREEN), color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: !n ? 'not-allowed' : 'pointer' }}>
            {isWaste ? `− ${n || 0} düş` : `+ ${n || 0} ekle`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Hareket geçmişi ── */
function HistoryDrawer({ itemId, name, onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let alive = true
    supabase.from('stock_movements').select('*').eq('menu_item_id', itemId).order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => { if (alive) setRows(data || []) })
    return () => { alive = false }
  }, [itemId])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px,100%)', height: '100%', background: '#f6f7f6', overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,.25)' }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
            <p style={{ fontSize: 11.5, color: MUTED }}>Stok hareketleri</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 17, color: '#666', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows === null ? (
            <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '30px 0' }}>Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '30px 0' }}>Henüz hareket yok.</p>
          ) : rows.map(r => {
            const pos = r.delta > 0
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ fontSize: 15 }}>{r.reason === 'order' ? '🧾' : r.reason === 'waste' ? '🗑️' : pos ? '📥' : '✏️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{REASON_TR[r.reason] || r.reason}</p>
                  <p style={{ fontSize: 10.5, color: '#bbb' }}>{fmtDate(r.created_at)}</p>
                </div>
                <span style={{ fontSize: 15, fontWeight: 900, color: pos ? GREEN : RED }}>{pos ? '+' : ''}{r.delta}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Kpi({ big, label, color = '#111' }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
      <p style={{ fontSize: 30, fontWeight: 900, color }}>{big}</p>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, marginTop: 2 }}>{label}</p>
    </div>
  )
}
