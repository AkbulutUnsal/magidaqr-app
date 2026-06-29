import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Bölümler  (qrmenum referans · #1D9E75)
   Menünün en üst katmanı: Bölüm → Kategori → Ürün
   Tablo: menu_sections (SQL'i çalıştırdıktan sonra).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const slugify = s => (s || '').toString().toLowerCase()
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminSections() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [edit, setEdit] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [reorder, setReorder] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const res = await supabase.from('menu_sections').select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    if (res.error) { setTableMissing(true); setLoading(false); return }
    setTableMissing(false)
    setList(res.data || [])
    setLoading(false)
  }

  const dispName = o => o?.[`name_${lang}`] || o?.name_tr || o?.name_en || o?.name_ka || ''
  const rowSlug = s => s.slug || slugify(s.name_en || s.name_tr)

  async function toggleStatus(s) {
    const val = !s.is_active
    setList(prev => prev.map(x => x.id === s.id ? { ...x, is_active: val } : x))
    await supabase.from('menu_sections').update({ is_active: val }).eq('id', s.id)
  }
  async function remove(s) {
    if (!confirm(`"${dispName(s)}" bölümü silinsin mi? Bu bölüme bağlı kategoriler bölümsüz kalır.`)) return
    await supabase.from('menu_sections').delete().eq('id', s.id)
    setList(prev => prev.filter(x => x.id !== s.id))
  }
  async function move(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    const arr = [...list]; const a = arr[idx], b = arr[j]
    arr[idx] = b; arr[j] = a; setList(arr)
    await Promise.all([
      supabase.from('menu_sections').update({ sort_order: j }).eq('id', a.id),
      supabase.from('menu_sections').update({ sort_order: idx }).eq('id', b.id),
    ])
  }
  async function save(form) {
    const payload = {
      restaurant_id: profile.restaurant_id,
      name_ka: form.name_ka, name_en: form.name_en, name_tr: form.name_tr, name_ru: form.name_ru,
      slug: form.slug || slugify(form.name_tr || form.name_en),
      icon: form.icon || null, image_url: form.image_url || null, is_active: form.is_active,
    }
    if (edit?.id) await supabase.from('menu_sections').update(payload).eq('id', edit.id)
    else { payload.sort_order = list.length; await supabase.from('menu_sections').insert(payload) }
    setShowForm(false); setEdit(null); load()
  }

  if (tableMissing) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', background: '#fff8e8', border: '1px solid #ffe9b8', borderRadius: 14, padding: 28 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#8a6d1a', marginBottom: 8 }}>⚠️ menu_sections tablosu bulunamadı</p>
        <p style={{ fontSize: 13, color: '#a98a3a', lineHeight: 1.6 }}>
          Bu sayfa için önce <code>menu_sections.sql</code>'i Supabase'de çalıştır reis. Tabloyu kurunca burası otomatik açılır.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Bölümler</h1>
          <p style={{ fontSize: 13, color: MUTED }}>Menünün en üst katmanı — örnek: Yiyecekler, İçecekler, Alkoller</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setReorder(r => !r)} style={btnGhost(reorder)}><SortIcon /> {reorder ? 'Bitir' : 'Sırala'}</button>
          <button onClick={() => { setEdit(null); setShowForm(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
            <PlusIcon /> Yeni Bölüm Ekle
          </button>
        </div>
      </div>

      {/* hiyerarşi ipucu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, flexWrap: 'wrap' }}>
        <Crumb active>🔲 Bölüm</Crumb><Arrow /><Crumb>📁 Kategori</Crumb><Arrow /><Crumb>🍽️ Ürün</Crumb>
        <span style={{ fontSize: 12.5, color: '#aaa', marginLeft: 6 }}>Örnek: <b style={{ color: '#666' }}>Yiyecekler</b> › Kahvaltı › Menemen</span>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔲</div>
            <p style={{ fontSize: 14 }}>Henüz bölüm yok. "Yeni Bölüm Ekle" ile başla (Yiyecekler, İçecekler, Alkoller).</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {reorder && <th style={{ ...th, width: 70 }}>Sıra</th>}
                <th style={{ ...th, width: 70 }}>Görsel</th>
                <th style={th}>Ad</th>
                <th style={th}>Slug</th>
                <th style={{ ...th, textAlign: 'center', width: 80 }}>Durum</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, idx) => (
                <tr key={s.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: s.is_active ? 1 : 0.6 }}>
                  {reorder && (
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => move(idx, -1)} disabled={idx === 0} style={arrowBtn(idx === 0)}><ChevronUp /></button>
                        <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={arrowBtn(idx === list.length - 1)}><ChevronDown /></button>
                      </div>
                    </td>
                  )}
                  <td style={td}>
                    {s.image_url
                      ? <img src={s.image_url} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                      : <span style={{ width: 42, height: 42, borderRadius: 10, background: GREEN_BG, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon || '🔲'}</span>}
                  </td>
                  <td style={td}><span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{dispName(s)}</span></td>
                  <td style={td}><span style={{ fontSize: 12, fontFamily: 'monospace', color: '#888', background: '#f4f4f2', padding: '4px 10px', borderRadius: 6 }}>{rowSlug(s)}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => toggleStatus(s)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: s.is_active ? GREEN_BG : '#fef2f2', color: s.is_active ? GREEN : '#dc2626' }}>{s.is_active ? 'Aktif' : 'Pasif'}</button>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => { setEdit(s); setShowForm(true) }} style={iconBtn} title="Düzenle"><EditIcon /></button>
                    <button onClick={() => remove(s)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <SectionForm sec={edit} onSave={save} onClose={() => { setShowForm(false); setEdit(null) }} />}
    </div>
  )
}

function SectionForm({ sec, onSave, onClose }) {
  const [f, setF] = useState({
    name_ka: sec?.name_ka || '', name_en: sec?.name_en || '', name_tr: sec?.name_tr || '', name_ru: sec?.name_ru || '',
    slug: sec?.slug || '', icon: sec?.icon || '', image_url: sec?.image_url || '', is_active: sec?.is_active ?? true,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '50px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{sec ? 'Bölümü Düzenle' : 'Yeni Bölüm'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <div style={{ width: 70 }}>
              <label style={fLabel}>İkon</label>
              <input value={f.icon} onChange={e => set('icon', e.target.value)} placeholder="🍽️" style={{ ...fInput, textAlign: 'center', fontSize: 20 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={fLabel}>Slug <span style={{ fontWeight: 400, color: '#bbb' }}>(otomatik)</span></label>
              <input value={f.slug} onChange={e => set('slug', e.target.value)} placeholder={slugify(f.name_tr || f.name_en) || 'yiyecekler'} style={{ ...fInput, fontFamily: 'monospace' }} />
            </div>
          </div>
          <div>
            <label style={fLabel}>İsim</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['tr', 'en', 'ka', 'ru'].map(l => <input key={l} value={f[`name_${l}`]} onChange={e => set(`name_${l}`, e.target.value)} placeholder={l.toUpperCase()} style={fInput} />)}
            </div>
          </div>
          <div><label style={fLabel}>Görsel URL <span style={{ fontWeight: 400, color: '#bbb' }}>(opsiyonel — varsa ikon yerine kullanılır)</span></label>
            <input value={f.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." style={fInput} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer', background: '#fafafa', borderRadius: 12, padding: 14 }}>
            <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> Aktif (menüde göster)
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(f)} disabled={!f.name_tr && !f.name_en} style={{ padding: '10px 22px', background: (f.name_tr || f.name_en) ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (f.name_tr || f.name_en) ? 'pointer' : 'default' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

function Crumb({ children, active }) { return <span style={{ fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 8, background: active ? GREEN_BG : '#f4f4f2', color: active ? GREEN : '#777' }}>{children}</span> }
function Arrow() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg> }
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '11px 16px', verticalAlign: 'middle' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }
function btnGhost(active) { return { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: active ? GREEN_BG : '#fff', color: active ? GREEN : '#444', border: `1px solid ${active ? GREEN : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' } }
function arrowBtn(disabled) { return { width: 26, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${BORDER}`, borderRadius: 5, background: disabled ? '#f4f4f2' : '#fff', cursor: disabled ? 'default' : 'pointer', color: disabled ? '#ccc' : '#666', padding: 0 } }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
function SortIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" /></svg> }
function ChevronUp() { return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg> }
function ChevronDown() { return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg> }
