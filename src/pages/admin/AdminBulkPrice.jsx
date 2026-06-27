import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Toplu Fiyat Güncelleme  (qrmenum referans · #1D9E75)
   Grup sekmeleri categories.group kolonu varsa otomatik açılır.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const AMBER = '#f59e0b'
const BORDER = '#e8e8e4'
const MUTED = '#888'
const GROUP_FIELDS = ['group', 'food_group', 'category_group', 'grup']

function money(v) {
  return Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₺'
}

export default function AdminBulkPrice() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)

  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [edited, setEdited] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [activeGroup, setActiveGroup] = useState('')   // grup sekmesi
  const [q, setQ] = useState('')

  // toplu işlem paneli
  const [scope, setScope] = useState('all')            // KAPSAM: 'all' | category_id
  const [op, setOp] = useState('')                     // İŞLEM
  const [value, setValue] = useState('')               // DEĞER
  const [roundMode, setRoundMode] = useState('none')   // YUVARLAMA
  const [roundStep, setRoundStep] = useState(5)        // ARALIK

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const rid = profile.restaurant_id
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('restaurant_id', rid).order('sort_order'),
      supabase.from('menu_items').select('id,name_tr,name_en,name_ka,name_ru,price,category_id,sort_order').eq('restaurant_id', rid).order('sort_order'),
    ])
    setCats(c || [])
    setItems(i || [])
    setEdited({})
    setLoading(false)
  }

  const dispName = (o, f = 'name') => o?.[`${f}_${lang}`] || o?.[`${f}_tr`] || o?.[`${f}_en`] || o?.[`${f}_ka`] || o?.[`${f}_ru`] || ''
  const groupField = GROUP_FIELDS.find(k => k in (cats[0] || {})) || null
  const groups = useMemo(() => groupField ? [...new Set(cats.map(c => c[groupField]).filter(Boolean))] : [], [cats, groupField])

  // grup sekmesine göre görünen kategoriler
  const visibleCats = useMemo(() => {
    if (!groupField || !activeGroup) return cats
    return cats.filter(c => c[groupField] === activeGroup)
  }, [cats, groupField, activeGroup])
  const visibleCatIds = visibleCats.map(c => c.id)

  // arama + grup filtreli ürünler
  function matchSearch(it) {
    if (!q) return true
    return [it.name_tr, it.name_en, it.name_ka, it.name_ru].join(' ').toLowerCase().includes(q.toLowerCase())
  }
  const flatVisible = useMemo(() => items.filter(it => {
    const inGroup = !groupField || !activeGroup || visibleCatIds.includes(it.category_id)
    return inGroup && matchSearch(it)
  }), [items, groupField, activeGroup, visibleCatIds, q])

  // kategoriye göre grupla (görünüm)
  const grouped = useMemo(() => {
    const map = []
    visibleCats.forEach(c => {
      const list = flatVisible.filter(it => it.category_id === c.id)
      if (list.length) map.push({ cat: c, list })
    })
    const orphan = flatVisible.filter(it => !visibleCatIds.includes(it.category_id))
    if (orphan.length) map.push({ cat: null, list: orphan })
    return map
  }, [visibleCats, flatVisible, visibleCatIds])

  function setPrice(id, val) { setEdited(p => ({ ...p, [id]: val })) }

  function roundPrice(p, mode) {
    if (mode === 'none') return Math.round(p * 100) / 100
    const s = roundStep
    if (mode === 'up') return Math.ceil(p / s) * s
    if (mode === 'down') return Math.floor(p / s) * s
    return Math.round(p / s) * s // nearest
  }

  function applyBulk() {
    const v = parseFloat(value)
    const isRoundOnly = op === 'round'
    if (!op) return
    if (!isRoundOnly && (isNaN(v))) return
    const effRound = isRoundOnly ? (roundMode === 'none' ? 'nearest' : roundMode) : roundMode

    const target = (scope === 'all' ? flatVisible : flatVisible.filter(i => i.category_id === scope))
    const next = { ...edited }
    target.forEach(it => {
      const cur = parseFloat(edited[it.id] ?? it.price) || 0
      let np = cur
      if (op === 'percent') np = cur * (1 + v / 100)
      else if (op === 'amount') np = cur + v
      else if (op === 'fixed') np = v
      np = roundPrice(np, effRound)
      next[it.id] = Math.max(0, Math.round(np * 100) / 100)
    })
    setEdited(next)
  }

  const changedIds = useMemo(() => Object.keys(edited).filter(id => {
    const o = items.find(i => i.id === id)
    return o && parseFloat(edited[id]) !== parseFloat(o.price)
  }), [edited, items])
  const changeCount = changedIds.length

  async function saveAll() {
    if (changeCount === 0) return
    setSaving(true)
    for (const id of changedIds) {
      await supabase.from('menu_items').update({ price: parseFloat(edited[id]) }).eq('id', id)
    }
    setSaving(false)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    load()
  }

  const valueDisabled = op === 'round' || op === ''
  const applyDisabled = !op || (op !== 'round' && (value === '' || isNaN(parseFloat(value))))

  const OP_OPTS = [
    { v: '', label: 'Seçin...' },
    { v: 'percent', label: 'Yüzde değiştir (%)' },
    { v: 'amount', label: 'Tutar değiştir (₾)' },
    { v: 'fixed', label: 'Sabit fiyat yap (₾)' },
    { v: 'round', label: 'Sadece yuvarla' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 70 }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Toplu Fiyat Güncelleme</h1>
        <button onClick={saveAll} disabled={changeCount === 0 || saving}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: changeCount === 0 ? '#d8d8d4' : GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: changeCount === 0 ? 'default' : 'pointer', boxShadow: changeCount === 0 ? 'none' : '0 4px 12px rgba(29,158,117,.3)' }}>
          {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : `Kaydet${changeCount ? ` (${changeCount})` : ''}`}
        </button>
      </div>

      {/* Grup sekmeleri */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <GroupTab active={activeGroup === ''} onClick={() => { setActiveGroup(''); setScope('all') }}>Tümü</GroupTab>
          {groups.map(g => <GroupTab key={g} active={activeGroup === g} onClick={() => { setActiveGroup(g); setScope('all') }}>{g}</GroupTab>)}
        </div>
      )}

      {/* Arama */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ürün ara..."
          style={{ width: '100%', padding: '12px 40px 12px 38px', border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
        {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 16 }}>✕</button>}
      </div>

      {/* Toplu işlem paneli */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Kapsam">
            <select value={scope} onChange={e => setScope(e.target.value)} style={ctrl}>
              <option value="all">Tümü (görünen)</option>
              {visibleCats.map(c => <option key={c.id} value={c.id}>{dispName(c)}</option>)}
            </select>
          </Field>
          <Field label="İşlem">
            <select value={op} onChange={e => setOp(e.target.value)} style={ctrl}>
              {OP_OPTS.map(o => <option key={o.v} value={o.v} disabled={o.v === ''}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Değer">
            <input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} disabled={valueDisabled}
              placeholder={op === 'percent' ? '+10 / -5' : op === 'fixed' ? '99' : '+2 / -1'}
              style={{ ...ctrl, width: 100, background: valueDisabled ? '#f4f4f2' : '#fff', color: valueDisabled ? '#bbb' : '#333' }} />
          </Field>

          {/* yuvarlama grubu */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', border: `1px solid ${AMBER}40`, background: '#fffdf5', borderRadius: 12, padding: '10px 12px' }}>
            <Field label="Yuvarlama">
              <select value={roundMode} onChange={e => setRoundMode(e.target.value)} style={ctrl}>
                <option value="none">Yok</option>
                <option value="nearest">En yakına</option>
                <option value="up">Yukarı</option>
                <option value="down">Aşağı</option>
              </select>
            </Field>
            <Field label="Aralık">
              <select value={roundStep} onChange={e => setRoundStep(Number(e.target.value))} style={ctrl}>
                <option value={0.5}>0,50 ₺</option>
                <option value={1}>1 ₺</option>
                <option value={5}>5 ₺</option>
                <option value={10}>10 ₺</option>
              </select>
            </Field>
          </div>

          <button onClick={applyBulk} disabled={applyDisabled}
            style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${applyDisabled ? BORDER : GREEN}`, background: applyDisabled ? '#f4f4f2' : GREEN_BG, color: applyDisabled ? '#bbb' : GREEN, fontWeight: 700, fontSize: 13, cursor: applyDisabled ? 'default' : 'pointer' }}>
            Uygula
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
          <b>İpucu:</b> Önce kapsamı seç (tümü veya tek kategori), sonra işlemi ve değeri gir. Yuvarlama: yüzde/tutar işleminden sonra fiyatları seçtiğin aralığa çeker. <i>"Sadece yuvarla"</i> seçilirse değer alanı yok sayılır, mevcut fiyatlar olduğu gibi yuvarlanır.
        </p>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
      ) : grouped.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
          <p style={{ fontSize: 14 }}>{items.length === 0 ? 'Henüz ürün yok.' : 'Aramaya uyan ürün yok.'}</p>
        </div>
      ) : grouped.map(({ cat, list }) => (
        <div key={cat?.id || 'orphan'} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', background: '#fafafa', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{cat ? dispName(cat) : 'Kategorisiz'}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{list.length} ürün</span>
          </div>
          {list.map(it => {
            const newP = edited[it.id]
            const changed = newP !== undefined && parseFloat(newP) !== parseFloat(it.price)
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 18px', borderTop: `1px solid #f4f4f2`, background: changed ? '#fffbe8' : '#fff' }}>
                <input type="number" step="0.01" value={newP ?? it.price} onChange={e => setPrice(it.id, e.target.value)}
                  style={{ width: 110, padding: '9px 12px', border: `1.5px solid ${changed ? GREEN : BORDER}`, borderRadius: 9, fontSize: 14, fontWeight: changed ? 700 : 500, color: changed ? GREEN : '#222', textAlign: 'center' }} />
                <span style={{ width: 76, fontSize: 12, color: '#bbb', fontFamily: 'monospace', textAlign: 'right' }}>{money(it.price)}</span>
                <span style={{ flex: 1, fontSize: 14, color: '#333' }}>{dispName(it)}</span>
                {changed && (
                  <button onClick={() => setEdited(p => { const n = { ...p }; delete n[it.id]; return n })}
                    title="Geri al" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 13 }}>↺</button>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Alt yüzen çubuk */}
      <div style={{ position: 'fixed', bottom: 20, right: 24, display: 'flex', alignItems: 'center', gap: 14, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 30, padding: '8px 16px', boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: changeCount ? AMBER : '#e8e8e4', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{changeCount}</span>
          <span style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>değişiklik</span>
        </div>
        <button onClick={saveAll} disabled={changeCount === 0 || saving}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', background: changeCount === 0 ? '#d8d8d4' : GREEN, color: '#fff', border: 'none', borderRadius: 30, fontSize: 14, fontWeight: 700, cursor: changeCount === 0 ? 'default' : 'pointer', boxShadow: changeCount === 0 ? 'none' : '0 6px 20px rgba(29,158,117,.4)' }}>
          {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}

/* ── küçük bileşenler & stiller ── */
function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}
function GroupTab({ children, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${active ? GREEN : BORDER}`, background: active ? GREEN : '#fff', color: active ? '#fff' : '#444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
      {children}
    </button>
  )
}
const ctrl = { padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, background: '#fff', cursor: 'pointer', minWidth: 120 }
