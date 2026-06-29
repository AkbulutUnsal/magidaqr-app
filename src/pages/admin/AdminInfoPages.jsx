import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Bilgi Sayfaları  (qrmenum referans · #1D9E75)
   Tablo: Başlık · Slug · Durum · İşlem + Sırala + presetler
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const PRESETS = [
  { slug: 'hakkimizda', title_tr: 'Hakkımızda', title_en: 'About Us', title_ka: 'ჩვენ შესახებ', title_ru: 'О нас' },
  { slug: 'gizlilik', title_tr: 'Gizlilik Politikası', title_en: 'Privacy Policy', title_ka: 'კონფიდენციალურობა', title_ru: 'Конфиденциальность' },
  { slug: 'kosullar', title_tr: 'Kullanım Koşulları', title_en: 'Terms', title_ka: 'წესები', title_ru: 'Условия' },
  { slug: 'iletisim', title_tr: 'İletişim', title_en: 'Contact', title_ka: 'კონტაქტი', title_ru: 'Контакты' },
]

export default function AdminInfoPages() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)
  const [reorder, setReorder] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('info_pages').select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    setList(data || [])
    setLoading(false)
  }

  const dispTitle = p => p?.[`title_${lang}`] || p?.title_tr || p?.title_en || '(başlıksız)'
  const existing = useMemo(() => new Set(list.map(p => p.slug)), [list])
  const remaining = PRESETS.filter(p => !existing.has(p.slug))

  async function save(form) {
    const payload = { ...form, restaurant_id: profile.restaurant_id }
    if (edit?.id) await supabase.from('info_pages').update(payload).eq('id', edit.id)
    else { payload.sort_order = list.length; await supabase.from('info_pages').insert(payload) }
    setShow(false); setEdit(null); load()
  }
  async function addPreset(p) {
    await supabase.from('info_pages').insert({ restaurant_id: profile.restaurant_id, slug: p.slug, title_tr: p.title_tr, title_en: p.title_en, title_ka: p.title_ka, title_ru: p.title_ru, is_published: true, sort_order: list.length })
    load()
  }
  async function togglePublish(p) {
    setList(prev => prev.map(x => x.id === p.id ? { ...x, is_published: !x.is_published } : x))
    await supabase.from('info_pages').update({ is_published: !p.is_published }).eq('id', p.id)
  }
  async function move(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    const arr = [...list]; const a = arr[idx], b = arr[j]
    arr[idx] = b; arr[j] = a; setList(arr)
    await Promise.all([
      supabase.from('info_pages').update({ sort_order: j }).eq('id', a.id),
      supabase.from('info_pages').update({ sort_order: idx }).eq('id', b.id),
    ])
  }
  async function del(id) {
    if (!confirm('Sayfa silinsin mi?')) return
    await supabase.from('info_pages').delete().eq('id', id)
    setList(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Bilgi Sayfaları</h1>
          <p style={{ fontSize: 13, color: MUTED }}>{list.length} sayfa · Hakkımızda, gizlilik, iletişim…</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setReorder(r => !r)} style={btnGhost(reorder)}><SortIcon /> {reorder ? 'Bitir' : 'Sırala'}</button>
          <button onClick={() => { setEdit(null); setShow(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
            <PlusIcon /> Sayfa Ekle
          </button>
        </div>
      </div>

      {remaining.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {remaining.map(p => (
            <button key={p.slug} onClick={() => addPreset(p)}
              style={{ padding: '8px 14px', borderRadius: 10, border: `1px dashed ${GREEN}`, background: GREEN_BG, color: GREEN, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + {p.title_tr}
            </button>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
            <p style={{ fontSize: 14 }}>Henüz sayfa yok. Yukarıdaki hazır sayfalardan ekle veya "Sayfa Ekle".</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {reorder && <th style={{ ...th, width: 70 }}>Sıra</th>}
                <th style={th}>Başlık</th>
                <th style={th}>Slug</th>
                <th style={{ ...th, textAlign: 'center', width: 90 }}>Durum</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, idx) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: p.is_published ? 1 : 0.6 }}>
                  {reorder && (
                    <td style={td}><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} style={arrowBtn(idx === 0)}><ChevronUp /></button>
                      <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} style={arrowBtn(idx === list.length - 1)}><ChevronDown /></button>
                    </div></td>
                  )}
                  <td style={td}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{dispTitle(p)}</p>
                    {(p.content_tr || p.content_en) && <p style={{ fontSize: 11.5, color: '#aaa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{(p.content_tr || p.content_en).slice(0, 70)}</p>}
                  </td>
                  <td style={td}><span style={{ fontSize: 12, fontFamily: 'monospace', color: '#888', background: '#f4f4f2', padding: '4px 10px', borderRadius: 6 }}>{p.slug}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => togglePublish(p)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: p.is_published ? GREEN_BG : '#f4f4f2', color: p.is_published ? GREEN : '#999' }}>{p.is_published ? 'Aktif' : 'Taslak'}</button>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => { setEdit(p); setShow(true) }} style={iconBtn} title="Düzenle"><EditIcon /></button>
                    <button onClick={() => del(p.id)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {show && <InfoModal item={edit} onSave={save} onClose={() => { setShow(false); setEdit(null) }} />}
    </div>
  )
}

function InfoModal({ item, onSave, onClose }) {
  const [f, setF] = useState({
    slug: item?.slug || '', title_ka: item?.title_ka || '', title_en: item?.title_en || '', title_tr: item?.title_tr || '', title_ru: item?.title_ru || '',
    content_ka: item?.content_ka || '', content_en: item?.content_en || '', content_tr: item?.content_tr || '', content_ru: item?.content_ru || '',
    is_published: item?.is_published ?? true, sort_order: item?.sort_order || 0,
  })
  const [lang, setLang] = useState('tr')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item ? 'Sayfayı Düzenle' : 'Yeni Sayfa'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={fLabel}>Slug (URL)</label><input value={f.slug} onChange={e => set('slug', e.target.value)} placeholder="hakkimizda" style={{ ...fInput, fontFamily: 'monospace' }} /></div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['tr', 'en', 'ka', 'ru'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: lang === l ? GREEN : '#f0f0ee', color: lang === l ? '#fff' : '#888' }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <div><label style={fLabel}>Başlık ({lang.toUpperCase()})</label><input value={f[`title_${lang}`]} onChange={e => set(`title_${lang}`, e.target.value)} style={fInput} /></div>
          <div><label style={fLabel}>İçerik ({lang.toUpperCase()})</label><textarea value={f[`content_${lang}`]} onChange={e => set(`content_${lang}`, e.target.value)} rows={8} style={{ ...fInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer', background: '#fafafa', borderRadius: 12, padding: 14 }}>
            <input type="checkbox" checked={f.is_published} onChange={e => set('is_published', e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> Yayında
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(f)} disabled={!f.slug || (!f.title_tr && !f.title_en)} style={{ padding: '10px 22px', background: (f.slug && (f.title_tr || f.title_en)) ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (f.slug && (f.title_tr || f.title_en)) ? 'pointer' : 'default' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '12px 16px', verticalAlign: 'middle' }
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
