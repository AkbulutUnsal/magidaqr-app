import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Ürünler  (qrmenum referans · yeşil tema #1D9E75)
   Not: Kategoriler artık ayrı sayfada (/admin/categories).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const AMBER = '#f59e0b'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

function slugify(s) {
  return (s || '').toString().toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function money(v) {
  const n = Number(v || 0)
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₾'
}

export default function AdminMenu() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)

  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [allergens, setAllergens] = useState([])
  const [outlets, setOutlets] = useState([])
  const [loading, setLoading] = useState(true)

  const [editItem, setEditItem] = useState(null)
  const [showForm, setShowForm] = useState(false)

  // filtre / arama
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | active | passive
  const [sortBy, setSortBy] = useState('default')
  const [sortOpen, setSortOpen] = useState(false)

  // toplu seçim
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState([])

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const rid = profile.restaurant_id
    const [{ data: its }, { data: cats }, { data: alg }, { data: out }] = await Promise.all([
      supabase.from('menu_items').select('*, category:menu_categories(name_en,name_tr,name_ka,name_ru)').eq('restaurant_id', rid).order('sort_order'),
      supabase.from('menu_categories').select('*').eq('restaurant_id', rid).order('sort_order'),
      supabase.from('allergens').select('*').eq('restaurant_id', rid).order('created_at'),
      supabase.from('outlets').select('*').eq('restaurant_id', rid).order('name').then(r => r, () => ({ data: [] })),
    ])
    setItems(its || [])
    setCategories(cats || [])
    setAllergens(alg || [])
    setOutlets(out || [])
    setLoading(false)
  }

  const dispName = (o, f = 'name') => o?.[`${f}_${lang}`] || o?.[`${f}_tr`] || o?.[`${f}_en`] || o?.[`${f}_ka`] || o?.[`${f}_ru`] || ''
  const hasOutletLink = items.some(i => 'outlet_id' in i)

  async function toggleField(item, field) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, [field]: !i[field] } : i))
    await supabase.from('menu_items').update({ [field]: !item[field] }).eq('id', item.id)
  }

  async function deleteItem(id) {
    if (!confirm('Bu ürünü silmek istediğine emin misin?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setSelected(prev => prev.filter(x => x !== id))
  }

  async function bulkDelete() {
    if (selected.length === 0) return
    if (!confirm(`${selected.length} ürünü silmek istediğine emin misin?`)) return
    await supabase.from('menu_items').delete().in('id', selected)
    setItems(prev => prev.filter(i => !selected.includes(i.id)))
    setSelected([])
  }

  async function bulkSetAvailable(val) {
    if (selected.length === 0) return
    await supabase.from('menu_items').update({ is_available: val }).in('id', selected)
    setItems(prev => prev.map(i => selected.includes(i.id) ? { ...i, is_available: val } : i))
  }

  async function saveItem(form) {
    const payload = {
      ...form,
      restaurant_id: profile.restaurant_id,
      price: form.price === '' ? null : Number(form.price),
      category_id: form.category_id || null,
    }
    if (editItem?.id) await supabase.from('menu_items').update(payload).eq('id', editItem.id)
    else await supabase.from('menu_items').insert(payload)
    setShowForm(false); setEditItem(null); load()
  }

  // filtrele + sırala
  const visible = useMemo(() => {
    let r = items.filter(it => {
      if (catFilter && it.category_id !== catFilter) return false
      if (hasOutletLink && outletFilter && it.outlet_id !== outletFilter) return false
      if (statusFilter === 'active' && !it.is_available) return false
      if (statusFilter === 'passive' && it.is_available) return false
      if (q) {
        const hay = [it.name_tr, it.name_en, it.name_ka, it.name_ru].join(' ').toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
    const nm = i => dispName(i).toLowerCase()
    if (sortBy === 'name') r = [...r].sort((a, b) => nm(a).localeCompare(nm(b)))
    else if (sortBy === 'price_asc') r = [...r].sort((a, b) => (a.price || 0) - (b.price || 0))
    else if (sortBy === 'price_desc') r = [...r].sort((a, b) => (b.price || 0) - (a.price || 0))
    else if (sortBy === 'newest') r = [...r].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, catFilter, outletFilter, statusFilter, q, sortBy, lang])

  const allVisIds = visible.map(i => i.id)
  const allChecked = allVisIds.length > 0 && allVisIds.every(id => selected.includes(id))
  const hasSoldOut = items.length > 0 && 'is_sold_out' in items[0]
  function toggleAll() { setSelected(allChecked ? [] : allVisIds) }
  function toggleOne(id) { setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }

  const SORT_OPTS = [
    { v: 'default', label: 'Varsayılan sıra' },
    { v: 'name', label: 'İsim (A → Z)' },
    { v: 'price_asc', label: 'Fiyat (artan)' },
    { v: 'price_desc', label: 'Fiyat (azalan)' },
    { v: 'newest', label: 'Yeni → Eski' },
  ]

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Ürünler</h1>
          <p style={{ fontSize: 13, color: MUTED }}>{items.length} ürün</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setSelectMode(s => !s); setSelected([]) }} style={btnGhost(selectMode)}>
            <CheckSquareIcon /> {selectMode ? 'Vazgeç' : 'Seç'}
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setSortOpen(o => !o)} style={btnGhost(false)}>
              <SortIcon /> Sırala
            </button>
            {sortOpen && (
              <>
                <div onClick={() => setSortOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div style={{ position: 'absolute', right: 0, top: 42, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,.12)', padding: 6, zIndex: 31, width: 180 }}>
                  {SORT_OPTS.map(o => (
                    <button key={o.v} onClick={() => { setSortBy(o.v); setSortOpen(false) }}
                      style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: sortBy === o.v ? GREEN_BG : 'transparent', color: sortBy === o.v ? GREEN : '#333', borderRadius: 8, fontSize: 13, fontWeight: sortBy === o.v ? 700 : 500, cursor: 'pointer' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => { setEditItem(null); setShowForm(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
            <PlusIcon /> Ürün Ekle
          </button>
        </div>
      </div>

      {/* Filtre çubuğu */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {hasOutletLink && outlets.length > 0 && (
          <select value={outletFilter} onChange={e => setOutletFilter(e.target.value)} style={selectStyle}>
            <option value="">Tüm Outletler</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name || dispName(o)}</option>)}
          </select>
        )}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ürün ara..."
            style={{ width: '100%', padding: '10px 14px 10px 36px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={selectStyle}>
          <option value="">Tüm Kategoriler</option>
          {categories.map(c => <option key={c.id} value={c.id}>{dispName(c)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
          <option value="all">Tümü</option>
          <option value="active">Mevcut</option>
          <option value="passive">Pasif</option>
        </select>
      </div>

      {/* Tablo */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
            <p style={{ fontSize: 14 }}>{items.length === 0 ? 'Henüz ürün eklenmemiş.' : 'Filtreye uyan ürün yok.'}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {selectMode && (
                  <th style={{ ...th, width: 44 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: GREEN }} /></th>
                )}
                <th style={{ ...th, width: 70 }}>Görsel</th>
                <th style={th}>Ad</th>
                <th style={th}>Kategori</th>
                <th style={{ ...th, textAlign: 'right' }}>Fiyat</th>
                <th style={{ ...th, textAlign: 'center', width: 90 }}>Öne Çıkar</th>
                <th style={{ ...th, textAlign: 'center', width: 80 }}>Durum</th>
                {hasSoldOut && <th style={{ ...th, textAlign: 'center', width: 80 }}>Tükendi</th>}
                <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(it => {
                const name = dispName(it)
                const sub = it.slug || slugify(name)
                const checked = selected.includes(it.id)
                return (
                  <tr key={it.id} style={{ borderTop: `1px solid ${BORDER}`, background: checked ? GREEN_BG : '#fff' }}>
                    {selectMode && (
                      <td style={td}><input type="checkbox" checked={checked} onChange={() => toggleOne(it.id)} style={{ cursor: 'pointer', accentColor: GREEN }} /></td>
                    )}
                    <td style={td}>
                      {it.image_url
                        ? <img src={it.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                        : <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f4f4f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 18 }}>🍽️</div>}
                    </td>
                    <td style={td}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{name}</p>
                      {sub && <p style={{ fontSize: 11, color: '#bbb', fontFamily: 'monospace' }}>{sub}</p>}
                    </td>
                    <td style={{ ...td, color: '#555', fontSize: 13 }}>{it.category ? dispName(it.category) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{money(it.price)}</td>
                    <td style={{ ...td, textAlign: 'center' }}><Toggle on={!!it.is_featured} color={AMBER} onClick={() => toggleField(it, 'is_featured')} /></td>
                    <td style={{ ...td, textAlign: 'center' }}><Toggle on={!!it.is_available} color={GREEN} onClick={() => toggleField(it, 'is_available')} /></td>
                    {hasSoldOut && <td style={{ ...td, textAlign: 'center' }}><Toggle on={!!it.is_sold_out} color={'#E8192C'} onClick={() => toggleField(it, 'is_sold_out')} /></td>}
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => { setEditItem(it); setShowForm(true) }} style={iconBtn} title="Düzenle"><EditIcon /></button>
                      <button onClick={() => deleteItem(it.id)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Toplu işlem çubuğu */}
      {selectMode && selected.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#111', color: '#fff', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 30px rgba(0,0,0,.25)', zIndex: 40 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.length} seçili</span>
          <div style={{ width: 1, height: 20, background: '#444' }} />
          <button onClick={() => bulkSetAvailable(true)} style={bulkBtn}>Aktif et</button>
          <button onClick={() => bulkSetAvailable(false)} style={bulkBtn}>Pasif et</button>
          <button onClick={bulkDelete} style={{ ...bulkBtn, color: '#ff7676' }}>Sil</button>
        </div>
      )}

      {showForm && (
        <ItemFormModal item={editItem} categories={categories} allergens={allergens} outlets={hasOutletLink ? outlets : []}
          dispName={dispName} onSave={saveItem} onClose={() => { setShowForm(false); setEditItem(null) }} />
      )}
    </div>
  )
}

/* ── Ürün formu ── */
function ItemFormModal({ item, categories, allergens, outlets, dispName, onSave, onClose }) {
  const [form, setForm] = useState({
    name_ka: item?.name_ka || '', name_en: item?.name_en || '',
    name_tr: item?.name_tr || '', name_ru: item?.name_ru || '',
    description_en: item?.description_en || '',
    price: item?.price ?? '', category_id: item?.category_id || '',
    image_url: item?.image_url || '', is_available: item?.is_available ?? true,
    is_featured: item?.is_featured ?? false, goes_to_kitchen: item?.goes_to_kitchen ?? true,
    allergen_ids: item?.allergen_ids || [],
    ...(item && 'outlet_id' in item ? { outlet_id: item.outlet_id || '' } : {}),
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleAllergen = id => setForm(p => ({ ...p, allergen_ids: p.allergen_ids.includes(id) ? p.allergen_ids.filter(x => x !== id) : [...p.allergen_ids, id] }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* görsel önizleme + url */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#f4f4f2', border: `1px solid ${BORDER}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 22 }}>
              {form.image_url ? <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍽️'}
            </div>
            <div style={{ flex: 1 }}>
              <label style={fLabel}>Görsel URL</label>
              <input value={form.image_url} onChange={e => set('image_url', e.target.value)} style={fInput} placeholder="https://..." />
            </div>
          </div>

          <div>
            <label style={fLabel}>İsim</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['tr', 'en', 'ka', 'ru'].map(l => (
                <input key={l} value={form[`name_${l}`]} onChange={e => set(`name_${l}`, e.target.value)} style={fInput} placeholder={l.toUpperCase()} />
              ))}
            </div>
          </div>

          <div>
            <label style={fLabel}>Açıklama (EN)</label>
            <textarea value={form.description_en} onChange={e => set('description_en', e.target.value)} rows={2} style={{ ...fInput, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: outlets.length ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
            <div>
              <label style={fLabel}>Fiyat (₾)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} style={fInput} />
            </div>
            <div>
              <label style={fLabel}>Kategori</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)} style={fInput}>
                <option value="">— Seç —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{dispName(c)}</option>)}
              </select>
            </div>
            {outlets.length > 0 && (
              <div>
                <label style={fLabel}>Outlet</label>
                <select value={form.outlet_id ?? ''} onChange={e => set('outlet_id', e.target.value)} style={fInput}>
                  <option value="">— Tümü —</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name || dispName(o)}</option>)}
                </select>
              </div>
            )}
          </div>

          {allergens.length > 0 ? (
            <div>
              <label style={fLabel}>Alerjenler</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {allergens.map(a => {
                  const on = form.allergen_ids.includes(a.id)
                  return (
                    <button type="button" key={a.id} onClick={() => toggleAllergen(a.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${on ? RED : BORDER}`, background: on ? '#fef2f2' : '#fff', color: on ? RED : '#888' }}>
                      <span>{a.icon}</span>{a.name_tr || a.name_en}{on && ' ✓'}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#bbb' }}>Alerjen tanımlamak için önce "Alerjenler" sayfasından ekle.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa', borderRadius: 12, padding: 14 }}>
            <Check label="Mevcut (menüde göster)" checked={form.is_available} onChange={v => set('is_available', v)} />
            <Check label="Öne çıkan ürün" checked={form.is_featured} onChange={v => set('is_featured', v)} />
            <Check label="🍳 Mutfağa gider (içecekler için kapat)" checked={form.goes_to_kitchen} onChange={v => set('goes_to_kitchen', v)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(form)} style={{ padding: '10px 22px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

/* ── küçük bileşenler & stiller ── */
function Toggle({ on, color, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: on ? color : '#d8d8d4', position: 'relative', transition: 'background .2s', padding: 0, verticalAlign: 'middle' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  )
}
function Check({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} />
      {label}
    </label>
  )
}
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '10px 16px', verticalAlign: 'middle' }
const selectStyle = { padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer', minWidth: 150 }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const bulkBtn = { background: 'none', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box', background: '#fff' }
function btnGhost(active) {
  return { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: active ? GREEN_BG : '#fff', color: active ? GREEN : '#444', border: `1px solid ${active ? GREEN : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}

// icons
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
function CheckSquareIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> }
function SortIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" /></svg> }
