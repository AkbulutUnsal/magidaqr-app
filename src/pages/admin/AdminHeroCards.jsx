import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Ana Sayfa Kartları  (qrmenum referans · #1D9E75)
   Tablo: İkon · Başlık · Yönlendirme(Bölüm/Kategori) · Durum · İşlem
   link_type/link_target şema-uyumlu; yoksa link_url'e düşer.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BLUE = '#2563eb'
const BORDER = '#e8e8e4'
const MUTED = '#888'

export default function AdminHeroCards() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)
  const [list, setList] = useState([])
  const [sections, setSections] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)
  const [reorder, setReorder] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const rid = profile.restaurant_id
    const [{ data: cards }, secRes, { data: cats }] = await Promise.all([
      supabase.from('hero_cards').select('*').eq('restaurant_id', rid).order('sort_order'),
      supabase.from('menu_sections').select('*').eq('restaurant_id', rid).order('sort_order').then(r => r, () => ({ data: [] })),
      supabase.from('menu_categories').select('*').eq('restaurant_id', rid).order('sort_order'),
    ])
    setList(cards || [])
    setSections(secRes?.data || [])
    setCategories(cats || [])
    setLoading(false)
  }

  const dispName = (o, f = 'name') => o?.[`${f}_${lang}`] || o?.[`${f}_tr`] || o?.[`${f}_en`] || o?.[`${f}_ka`] || ''
  const dispTitle = c => c?.[`title_${lang}`] || c?.title_tr || c?.title_en || '(başlıksız)'

  const sample = list[0] || {}
  const hasIcon = 'icon' in sample
  const hasImage = 'image_url' in sample
  const hasLinkType = 'link_type' in sample
  const hasLinkTarget = 'link_target' in sample
  const missing = useMemo(() => list.length ? [!hasLinkType && 'link_type', !hasLinkTarget && 'link_target', !hasIcon && 'icon'].filter(Boolean) : [], [list, hasLinkType, hasLinkTarget, hasIcon])

  function routing(c) {
    if (hasLinkType && c.link_type) {
      if (c.link_type === 'section') { const s = sections.find(x => x.id === c.link_target); return { label: 'Bölüm', color: GREEN, name: s ? dispName(s) : '' } }
      if (c.link_type === 'category') { const k = categories.find(x => x.id === c.link_target); return { label: 'Kategori', color: BLUE, name: k ? dispName(k) : '' } }
      if (c.link_type === 'url') return { label: 'URL', color: '#888', name: c.link_target || c.link_url || '' }
    }
    if (c.link_url) return { label: 'URL', color: '#888', name: c.link_url }
    return null
  }

  async function save(form) {
    const payload = {
      restaurant_id: profile.restaurant_id,
      title_ka: form.title_ka, title_en: form.title_en, title_tr: form.title_tr, title_ru: form.title_ru,
      subtitle_ka: form.subtitle_ka, subtitle_en: form.subtitle_en, subtitle_tr: form.subtitle_tr, subtitle_ru: form.subtitle_ru,
      is_active: form.is_active,
    }
    if (hasImage) payload.image_url = form.image_url || null
    if (hasIcon) payload.icon = form.icon || null
    if (hasLinkType) payload.link_type = form.link_type
    if (hasLinkTarget) payload.link_target = form.link_target || null
    // link_url'i her zaman tut (geri uyum): URL ise url, değilse boş
    payload.link_url = form.link_type === 'url' ? form.link_target : (form.link_url || null)

    if (edit?.id) await supabase.from('hero_cards').update(payload).eq('id', edit.id)
    else { payload.sort_order = list.length; await supabase.from('hero_cards').insert(payload) }
    setShow(false); setEdit(null); load()
  }
  async function toggle(c) {
    setList(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    await supabase.from('hero_cards').update({ is_active: !c.is_active }).eq('id', c.id)
  }
  async function move(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    const arr = [...list]; const a = arr[idx], b = arr[j]
    arr[idx] = b; arr[j] = a; setList(arr)
    await Promise.all([
      supabase.from('hero_cards').update({ sort_order: j }).eq('id', a.id),
      supabase.from('hero_cards').update({ sort_order: idx }).eq('id', b.id),
    ])
  }
  async function del(id) {
    if (!confirm('Kart silinsin mi?')) return
    await supabase.from('hero_cards').delete().eq('id', id)
    setList(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Ana Sayfa Kartları</h1>
          <p style={{ fontSize: 13, color: MUTED }}>{list.length} kart · menü girişinde gösterilen yönlendirme kartları</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setReorder(r => !r)} style={btnGhost(reorder)}><SortIcon /> {reorder ? 'Bitir' : 'Sırala'}</button>
          <button onClick={() => { setEdit(null); setShow(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
            <PlusIcon /> Kart Ekle
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🃏</div>
            <p style={{ fontSize: 14 }}>Henüz kart yok. "Kart Ekle" ile başla (Yiyecekler, İçecekler, Alkoller…).</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {reorder && <th style={{ ...th, width: 70 }}>Sıra</th>}
                <th style={{ ...th, width: 70 }}>İkon</th>
                <th style={th}>Başlık</th>
                <th style={th}>Yönlendirme</th>
                <th style={{ ...th, textAlign: 'center', width: 80 }}>Durum</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, idx) => {
                const r = routing(c)
                return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: c.is_active ? 1 : 0.6 }}>
                    {reorder && (
                      <td style={td}><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => move(idx, -1)} disabled={idx === 0} style={arrowBtn(idx === 0)}><ChevronUp /></button>
                        <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={arrowBtn(idx === list.length - 1)}><ChevronDown /></button>
                      </div></td>
                    )}
                    <td style={td}>
                      {c.image_url
                        ? <img src={c.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                        : <span style={{ width: 40, height: 40, borderRadius: 10, background: GREEN_BG, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{c.icon || '🃏'}</span>}
                    </td>
                    <td style={td}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{dispTitle(c)}</p>
                      {(c.subtitle_tr || c.subtitle_en) && <p style={{ fontSize: 11.5, color: '#aaa', marginTop: 2 }}>{c.subtitle_tr || c.subtitle_en}</p>}
                    </td>
                    <td style={td}>
                      {r ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: r.color + '18', color: r.color }}>{r.label}</span>
                          {r.name && <span style={{ fontSize: 12.5, color: '#777' }}>{r.name}</span>}
                        </span>
                      ) : <span style={{ fontSize: 12, color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}><Toggle on={!!c.is_active} onClick={() => toggle(c)} /></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => { setEdit(c); setShow(true) }} style={iconBtn} title="Düzenle"><EditIcon /></button>
                      <button onClick={() => del(c.id)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {missing.length > 0 && (
        <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 14, lineHeight: 1.6 }}>
          <b>Not (reis):</b> <code>{missing.join(', ')}</code> kolonu <code>hero_cards</code>'ta yok. Bölüm/Kategori'ye temiz yönlendirme için <code>link_type</code> (text: section/category/url) + <code>link_target</code> (uuid/text) + <code>icon</code> (text) ekle. Eksikken URL alanı (link_url) kullanılır.
        </p>
      )}

      {show && <HeroModal item={edit} dispName={dispName} hasIcon={hasIcon} hasImage={hasImage} hasLinkType={hasLinkType} hasLinkTarget={hasLinkTarget} sections={sections} categories={categories} onSave={save} onClose={() => { setShow(false); setEdit(null) }} />}
    </div>
  )
}

function HeroModal({ item, dispName, hasIcon, hasImage, hasLinkType, hasLinkTarget, sections, categories, onSave, onClose }) {
  const initType = item?.link_type || (item?.link_url ? 'url' : 'section')
  const [f, setF] = useState({
    title_ka: item?.title_ka || '', title_en: item?.title_en || '', title_tr: item?.title_tr || '', title_ru: item?.title_ru || '',
    subtitle_ka: item?.subtitle_ka || '', subtitle_en: item?.subtitle_en || '', subtitle_tr: item?.subtitle_tr || '', subtitle_ru: item?.subtitle_ru || '',
    icon: item?.icon || '', image_url: item?.image_url || '',
    link_type: initType, link_target: item?.link_target || (initType === 'url' ? (item?.link_url || '') : ''),
    link_url: item?.link_url || '', is_active: item?.is_active ?? true,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const useRouting = hasLinkType || hasLinkTarget

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item ? 'Kartı Düzenle' : 'Yeni Kart'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            {hasIcon && <div style={{ width: 70 }}><label style={fLabel}>İkon</label><input value={f.icon} onChange={e => set('icon', e.target.value)} placeholder="🍽️" style={{ ...fInput, textAlign: 'center', fontSize: 20 }} /></div>}
            {hasImage && <div style={{ flex: 1 }}><label style={fLabel}>Görsel URL <span style={{ fontWeight: 400, color: '#bbb' }}>(opsiyonel)</span></label><input value={f.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." style={fInput} /></div>}
          </div>
          <div>
            <label style={fLabel}>Başlık</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['tr', 'en', 'ka', 'ru'].map(l => <input key={l} value={f[`title_${l}`]} onChange={e => set(`title_${l}`, e.target.value)} placeholder={l.toUpperCase()} style={fInput} />)}
            </div>
          </div>
          <div>
            <label style={fLabel}>Alt Başlık <span style={{ fontWeight: 400, color: '#bbb' }}>(opsiyonel)</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['tr', 'en'].map(l => <input key={l} value={f[`subtitle_${l}`]} onChange={e => set(`subtitle_${l}`, e.target.value)} placeholder={l.toUpperCase()} style={fInput} />)}
            </div>
          </div>

          {useRouting ? (
            <div>
              <label style={fLabel}>Yönlendirme</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[['section', 'Bölüm'], ['category', 'Kategori'], ['url', 'URL']].map(([v, lbl]) => (
                  <button key={v} onClick={() => { set('link_type', v); set('link_target', '') }}
                    style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1.5px solid ${f.link_type === v ? GREEN : BORDER}`, background: f.link_type === v ? GREEN_BG : '#fff', color: f.link_type === v ? GREEN : '#666', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
              {f.link_type === 'section' && (
                <select value={f.link_target} onChange={e => set('link_target', e.target.value)} style={fInput}>
                  <option value="">— Bölüm seç —</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{(s.icon ? s.icon + ' ' : '') + dispName(s)}</option>)}
                </select>
              )}
              {f.link_type === 'category' && (
                <select value={f.link_target} onChange={e => set('link_target', e.target.value)} style={fInput}>
                  <option value="">— Kategori seç —</option>
                  {categories.map(k => <option key={k.id} value={k.id}>{dispName(k)}</option>)}
                </select>
              )}
              {f.link_type === 'url' && <input value={f.link_target} onChange={e => set('link_target', e.target.value)} placeholder="https://... veya #kategori" style={fInput} />}
              {f.link_type === 'section' && sections.length === 0 && <p style={{ fontSize: 11, color: '#c0392b', marginTop: 4 }}>Önce "Bölümler" sayfasından bölüm ekle.</p>}
            </div>
          ) : (
            <div><label style={fLabel}>Bağlantı URL <span style={{ fontWeight: 400, color: '#bbb' }}>(opsiyonel)</span></label><input value={f.link_url} onChange={e => set('link_url', e.target.value)} placeholder="#kategori veya https://..." style={fInput} /></div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer', background: '#fafafa', borderRadius: 12, padding: 14 }}>
            <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> Aktif
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(f)} disabled={!f.title_tr && !f.title_en} style={{ padding: '10px 22px', background: (f.title_tr || f.title_en) ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (f.title_tr || f.title_en) ? 'pointer' : 'default' }}>Kaydet</button>
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
const td = { padding: '11px 16px', verticalAlign: 'middle' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box', background: '#fff' }
function btnGhost(active) { return { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: active ? GREEN_BG : '#fff', color: active ? GREEN : '#444', border: `1px solid ${active ? GREEN : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' } }
function arrowBtn(disabled) { return { width: 26, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${BORDER}`, borderRadius: 5, background: disabled ? '#f4f4f2' : '#fff', cursor: disabled ? 'default' : 'pointer', color: disabled ? '#ccc' : '#666', padding: 0 } }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
function SortIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" /></svg> }
function ChevronUp() { return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg> }
function ChevronDown() { return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg> }
