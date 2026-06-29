import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Kategoriler  (qrmenum referans · #1D9E75)
   Bölüm → Kategori → Ürün. Kategori, menu_sections'a section_id
   ile bağlanır (kolon varsa). image_url/is_active otomatik algılanır.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'
const GROUP_FIELDS = ['group', 'food_group', 'category_group', 'grup']

export default function AdminCategories() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const lang = (i18n.language || 'tr').slice(0, 2)

  const [cats, setCats] = useState([])
  const [sections, setSections] = useState([])
  const [counts, setCounts] = useState({})
  const [outlets, setOutlets] = useState([])
  const [loading, setLoading] = useState(true)

  const [edit, setEdit] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [reorder, setReorder] = useState(false)
  const [sectionFilter, setSectionFilter] = useState('')

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const rid = profile.restaurant_id
    const [{ data: c }, { data: items }, secRes, { data: out }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('restaurant_id', rid).order('sort_order'),
      supabase.from('menu_items').select('category_id').eq('restaurant_id', rid),
      supabase.from('menu_sections').select('*').eq('restaurant_id', rid).order('sort_order').then(r => r, () => ({ data: [] })),
      supabase.from('outlets').select('*').eq('restaurant_id', rid).order('name').then(r => r, () => ({ data: [] })),
    ])
    setCats(c || [])
    setSections(secRes?.data || [])
    setOutlets(out || [])
    const tally = {}
    ;(items || []).forEach(i => { if (i.category_id) tally[i.category_id] = (tally[i.category_id] || 0) + 1 })
    setCounts(tally)
    setLoading(false)
  }

  const dispName = (o, f = 'name') => o?.[`${f}_${lang}`] || o?.[`${f}_tr`] || o?.[`${f}_en`] || o?.[`${f}_ka`] || o?.[`${f}_ru`] || ''

  const sample = cats[0] || {}
  const hasImage = 'image_url' in sample
  const statusField = 'is_active' in sample ? 'is_active' : 'is_available' in sample ? 'is_available' : null
  const hasSection = 'section_id' in sample
  const groupField = !hasSection ? (GROUP_FIELDS.find(k => k in sample) || null) : null
  const hasOutlet = 'outlet_id' in sample

  const sectionName = id => { const s = sections.find(x => x.id === id); return s ? dispName(s) : '—' }
  const groupOptions = useMemo(() => groupField ? [...new Set(cats.map(c => c[groupField]).filter(Boolean))] : [], [cats, groupField])

  const visible = useMemo(() => {
    let r = cats
    if (hasSection && sectionFilter) r = r.filter(c => c.section_id === sectionFilter)
    return r
  }, [cats, sectionFilter, hasSection])

  async function toggleStatus(cat) {
    if (!statusField) return
    const val = !cat[statusField]
    setCats(prev => prev.map(c => c.id === cat.id ? { ...c, [statusField]: val } : c))
    await supabase.from('menu_categories').update({ [statusField]: val }).eq('id', cat.id)
  }
  async function remove(cat) {
    const n = counts[cat.id] || 0
    const msg = n > 0 ? `"${dispName(cat)}" kategorisinde ${n} ürün var. Silersen kategorisiz kalır. Devam?` : `"${dispName(cat)}" silinsin mi?`
    if (!confirm(msg)) return
    await supabase.from('menu_categories').delete().eq('id', cat.id)
    setCats(prev => prev.filter(c => c.id !== cat.id))
  }
  async function move(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= cats.length) return
    const arr = [...cats]; const a = arr[idx], b = arr[j]
    arr[idx] = b; arr[j] = a; setCats(arr)
    await Promise.all([
      supabase.from('menu_categories').update({ sort_order: j }).eq('id', a.id),
      supabase.from('menu_categories').update({ sort_order: idx }).eq('id', b.id),
    ])
  }
  async function save(form) {
    const payload = {
      restaurant_id: profile.restaurant_id,
      name_ka: form.name_ka, name_en: form.name_en, name_tr: form.name_tr, name_ru: form.name_ru,
    }
    if (hasImage) payload.image_url = form.image_url || null
    if (statusField) payload[statusField] = form.active
    if (hasSection) payload.section_id = form.section_id || null
    else if (groupField) payload[groupField] = form.group || null
    if (hasOutlet) payload.outlet_id = form.outlet_id || null

    if (edit?.id) await supabase.from('menu_categories').update(payload).eq('id', edit.id)
    else { payload.sort_order = cats.length; await supabase.from('menu_categories').insert(payload) }
    setShowForm(false); setEdit(null); load()
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Kategoriler</h1>
          <p style={{ fontSize: 13, color: MUTED }}>{cats.length} kategori{hasSection ? ' · Bölüm › Kategori › Ürün' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {hasSection && sections.length > 0 && (
            <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={selectStyle}>
              <option value="">Tüm bölümler</option>
              {sections.map(s => <option key={s.id} value={s.id}>{dispName(s)}</option>)}
            </select>
          )}
          <button onClick={() => setReorder(r => !r)} style={btnGhost(reorder)}><SortIcon /> {reorder ? 'Bitir' : 'Sırala'}</button>
          <button onClick={() => { setEdit(null); setShowForm(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
            <PlusIcon /> Kategori Ekle
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
            <p style={{ fontSize: 14 }}>Kategori yok. "Kategori Ekle" ile başla.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {reorder && <th style={{ ...th, width: 70 }}>Sıra</th>}
                {hasImage && <th style={{ ...th, width: 70 }}>Görsel</th>}
                <th style={th}>Ad</th>
                {hasSection ? <th style={th}>Bölüm</th> : groupField ? <th style={th}>Grup</th> : null}
                <th style={{ ...th, width: 110 }}>Ürünler</th>
                {statusField && <th style={{ ...th, textAlign: 'center', width: 80 }}>Durum</th>}
                <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(cat => {
                const realIdx = cats.findIndex(c => c.id === cat.id)
                const n = counts[cat.id] || 0
                return (
                  <tr key={cat.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    {reorder && (
                      <td style={td}><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => move(realIdx, -1)} disabled={realIdx === 0} style={arrowBtn(realIdx === 0)}><ChevronUp /></button>
                        <button onClick={() => move(realIdx, 1)} disabled={realIdx === cats.length - 1} style={arrowBtn(realIdx === cats.length - 1)}><ChevronDown /></button>
                      </div></td>
                    )}
                    {hasImage && (
                      <td style={td}>{cat.image_url
                        ? <img src={cat.image_url} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                        : <div style={{ width: 46, height: 46, borderRadius: 10, background: '#f4f4f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 18 }}>📁</div>}</td>
                    )}
                    <td style={td}><p style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{dispName(cat)}</p></td>
                    {hasSection ? <td style={{ ...td, fontSize: 13, color: '#666' }}>{cat.section_id ? sectionName(cat.section_id) : '—'}</td>
                      : groupField ? <td style={{ ...td, fontSize: 13, color: '#666' }}>{cat[groupField] || '—'}</td> : null}
                    <td style={td}>
                      <button onClick={() => navigate('/admin/menu')} title="Ürünleri gör"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: GREEN_BG, color: GREEN, border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {n} ürün <ChevronRight />
                      </button>
                    </td>
                    {statusField && <td style={{ ...td, textAlign: 'center' }}><Toggle on={!!cat[statusField]} onClick={() => toggleStatus(cat)} /></td>}
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => { setEdit(cat); setShowForm(true) }} style={iconBtn} title="Düzenle"><EditIcon /></button>
                      <button onClick={() => remove(cat)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <CategoryForm cat={edit} dispName={dispName}
          hasImage={hasImage} statusField={statusField} hasSection={hasSection} sections={sections}
          groupField={groupField} groupOptions={groupOptions} hasOutlet={hasOutlet} outlets={outlets}
          onSave={save} onClose={() => { setShowForm(false); setEdit(null) }} />
      )}

      {!loading && cats.length > 0 && !hasSection && (
        <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 14, lineHeight: 1.6 }}>
          <b>Not (reis):</b> Kategorileri Bölüm'e bağlamak için <code>menu_categories</code>'e <code>section_id</code> kolonu gerekli (menu_sections.sql ekliyor). Eklenince "Bölüm" sütunu ve seçici otomatik açılır.
        </p>
      )}
    </div>
  )
}

function CategoryForm({ cat, dispName, hasImage, statusField, hasSection, sections, groupField, groupOptions, hasOutlet, outlets, onSave, onClose }) {
  const [form, setForm] = useState({
    name_ka: cat?.name_ka || '', name_en: cat?.name_en || '', name_tr: cat?.name_tr || '', name_ru: cat?.name_ru || '',
    image_url: cat?.image_url || '',
    active: statusField ? (cat?.[statusField] ?? true) : true,
    section_id: cat?.section_id || '',
    group: groupField ? (cat?.[groupField] || '') : '',
    outlet_id: cat?.outlet_id || '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{cat ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasImage && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f4f4f2', border: `1px solid ${BORDER}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 20 }}>
                {form.image_url ? <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📁'}
              </div>
              <div style={{ flex: 1 }}><label style={fLabel}>Görsel URL</label><input value={form.image_url} onChange={e => set('image_url', e.target.value)} style={fInput} placeholder="https://..." /></div>
            </div>
          )}
          <div>
            <label style={fLabel}>İsim</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['tr', 'en', 'ka', 'ru'].map(l => <input key={l} value={form[`name_${l}`]} onChange={e => set(`name_${l}`, e.target.value)} style={fInput} placeholder={l.toUpperCase()} />)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: (hasSection || groupField) && hasOutlet ? '1fr 1fr' : '1fr', gap: 10 }}>
            {hasSection ? (
              <div>
                <label style={fLabel}>Bölüm</label>
                <select value={form.section_id} onChange={e => set('section_id', e.target.value)} style={fInput}>
                  <option value="">— Bölüm seç —</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{(s.icon ? s.icon + ' ' : '') + dispName(s)}</option>)}
                </select>
                {sections.length === 0 && <p style={{ fontSize: 11, color: '#c0392b', marginTop: 4 }}>Önce "Bölümler" sayfasından bölüm ekle.</p>}
              </div>
            ) : groupField ? (
              <div>
                <label style={fLabel}>Grup</label>
                <input list="cat-groups" value={form.group} onChange={e => set('group', e.target.value)} style={fInput} placeholder="Yiyecekler..." />
                <datalist id="cat-groups">{groupOptions.map(g => <option key={g} value={g} />)}</datalist>
              </div>
            ) : null}
            {hasOutlet && outlets.length > 0 && (
              <div>
                <label style={fLabel}>Outlet</label>
                <select value={form.outlet_id} onChange={e => set('outlet_id', e.target.value)} style={fInput}>
                  <option value="">— Genel (tümü) —</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name || dispName(o)}</option>)}
                </select>
              </div>
            )}
          </div>

          {statusField && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer', background: '#fafafa', borderRadius: 12, padding: 14 }}>
              <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> Aktif (menüde göster)
            </label>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(form)} disabled={!form.name_tr && !form.name_en} style={{ padding: '10px 22px', background: (form.name_tr || form.name_en) ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (form.name_tr || form.name_en) ? 'pointer' : 'default' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onClick }) {
  return <button onClick={onClick} style={{ width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: on ? GREEN : '#d8d8d4', position: 'relative', transition: 'background .2s', padding: 0, verticalAlign: 'middle' }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
  </button>
}
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '10px 16px', verticalAlign: 'middle' }
const selectStyle = { padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer', minWidth: 160 }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box', background: '#fff' }
function btnGhost(active) { return { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: active ? GREEN_BG : '#fff', color: active ? GREEN : '#444', border: `1px solid ${active ? GREEN : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' } }
function arrowBtn(disabled) { return { width: 26, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${BORDER}`, borderRadius: 5, background: disabled ? '#f4f4f2' : '#fff', cursor: disabled ? 'default' : 'pointer', color: disabled ? '#ccc' : '#666', padding: 0 } }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
function SortIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" /></svg> }
function ChevronUp() { return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg> }
function ChevronDown() { return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg> }
function ChevronRight() { return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg> }
