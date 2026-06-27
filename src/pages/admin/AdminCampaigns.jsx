import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Kampanyalar & Duyurular  (qrmenum referans · #1D9E75)
   show_once şema-uyumlu. AI sekmesi placeholder (AI eklentisi).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const PURPLE = '#7c3aed'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const fmtDate = d => d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export default function AdminCampaigns() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)
  const [tab, setTab] = useState('list')

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('campaigns').select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    setList(data || [])
    setLoading(false)
  }

  const sample = list[0] || {}
  const hasShowOnce = 'show_once' in sample
  const hasImages = 'images' in sample
  const dispT = c => c?.[`title_${lang}`] || c?.title_tr || c?.title_en || c?.title_ka || '(başlıksız)'
  const dispD = c => c?.[`description_${lang}`] || c?.description_tr || c?.description_en || ''
  const imgCount = c => Array.isArray(c.images) ? c.images.length : (c.image_url ? 1 : 0)
  const tarih = c => (!c.starts_at && !c.ends_at) ? 'Sürekli' : `${fmtDate(c.starts_at) || '—'} → ${fmtDate(c.ends_at) || '∞'}`

  async function save(form) {
    const payload = { ...form, restaurant_id: profile.restaurant_id, discount_percent: parseInt(form.discount_percent) || 0 }
    if (!hasShowOnce) delete payload.show_once
    if (edit?.id) await supabase.from('campaigns').update(payload).eq('id', edit.id)
    else await supabase.from('campaigns').insert(payload)
    setShow(false); setEdit(null); load()
  }
  async function toggleActive(c) {
    setList(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    await supabase.from('campaigns').update({ is_active: !c.is_active }).eq('id', c.id)
  }
  async function toggleShowOnce(c) {
    if (!hasShowOnce) return
    setList(prev => prev.map(x => x.id === c.id ? { ...x, show_once: !x.show_once } : x))
    await supabase.from('campaigns').update({ show_once: !c.show_once }).eq('id', c.id)
  }
  async function del(id) {
    if (!confirm('Kampanya silinsin mi?')) return
    await supabase.from('campaigns').delete().eq('id', id)
    setList(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Kampanyalar & Duyurular</h1>

      {/* sekmeler */}
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${BORDER}`, margin: '18px 0 22px' }}>
        <TabBtn active={tab === 'list'} onClick={() => setTab('list')}>Kampanyalar</TabBtn>
        <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')} ai>✦ AI Kampanya Üret <Beta /></TabBtn>
      </div>

      {tab === 'ai' ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 36, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}>✦</div>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>AI Kampanya Üret <Beta /></p>
          <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
            Ürünlerine ve sezona göre kampanya başlığı, açıklaması ve görseli otomatik üretilir. Bu özellik AI eklentisi (ai_addon) gerektirir — açınca buraya bağlanır reis.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 13, color: MUTED }}>{list.length} kampanya</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => alert('AI ile görsel üretimi yakında — AI eklentisi gerektirir.')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#fff', color: PURPLE, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ✦ AI ile Görsel Üret
              </button>
              <button onClick={() => { setEdit(null); setShow(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
                <PlusIcon /> Kampanya Ekle
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
            ) : list.length === 0 ? (
              <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                <p style={{ fontSize: 14 }}>Henüz kampanya yok. "Kampanya Ekle" ile başla.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={th}>Başlık</th>
                    <th style={th}>Tarih</th>
                    <th style={th}>Gösterim</th>
                    <th style={th}>Görseller</th>
                    <th style={{ ...th, textAlign: 'center', width: 80 }}>Durum</th>
                    <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(c => {
                    const once = hasShowOnce ? !!c.show_once : false
                    const n = imgCount(c)
                    return (
                      <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: c.is_active ? 1 : 0.6 }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{dispT(c)}</p>
                            {c.badge_text && <span style={{ background: RED, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{c.badge_text}</span>}
                            {c.discount_percent > 0 && <span style={{ background: GREEN_BG, color: GREEN, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>%{c.discount_percent}</span>}
                          </div>
                          {dispD(c) && <p style={{ fontSize: 11.5, color: '#aaa', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{dispD(c)}</p>}
                        </td>
                        <td style={{ ...td, fontSize: 13, color: '#666' }}>{tarih(c)}</td>
                        <td style={td}>
                          <button onClick={() => toggleShowOnce(c)} disabled={!hasShowOnce}
                            style={{ padding: '4px 11px', borderRadius: 20, border: 'none', fontSize: 11.5, fontWeight: 700, cursor: hasShowOnce ? 'pointer' : 'default', background: once ? '#fff7e8' : '#f4f4f2', color: once ? '#b45309' : '#888' }}>
                            {once ? 'Bir kez göster' : 'Her zaman'}
                          </button>
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {c.image_url
                              ? <img src={c.image_url} alt="" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                              : <div style={{ width: 30, height: 30, borderRadius: 7, background: '#f4f4f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 12 }}>🖼️</div>}
                            <span style={{ fontSize: 12.5, color: '#666' }}>{n ? `${n} görsel` : 'Görsel yok'}</span>
                          </div>
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button onClick={() => toggleActive(c)}
                            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: c.is_active ? GREEN_BG : '#fef2f2', color: c.is_active ? GREEN : '#dc2626' }}>
                            {c.is_active ? 'Aktif' : 'Pasif'}
                          </button>
                        </td>
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

          {!loading && list.length > 0 && !hasShowOnce && (
            <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 14 }}>
              <b>Not (reis):</b> "Gösterim" (bir kez göster) için <code>campaigns</code> tablosuna <code>show_once</code> (bool) kolonu eklersen toggle çalışır.
            </p>
          )}
        </>
      )}

      {show && <CampaignModal item={edit} hasShowOnce={hasShowOnce} onSave={save} onClose={() => { setShow(false); setEdit(null) }} />}
    </div>
  )
}

function CampaignModal({ item, hasShowOnce, onSave, onClose }) {
  const [f, setF] = useState({
    title_ka: item?.title_ka || '', title_en: item?.title_en || '', title_tr: item?.title_tr || '', title_ru: item?.title_ru || '',
    description_ka: item?.description_ka || '', description_en: item?.description_en || '', description_tr: item?.description_tr || '', description_ru: item?.description_ru || '',
    image_url: item?.image_url || '', discount_percent: item?.discount_percent || '', badge_text: item?.badge_text || '',
    is_active: item?.is_active ?? true, show_once: item?.show_once ?? false,
    starts_at: item?.starts_at || '', ends_at: item?.ends_at || '', sort_order: item?.sort_order || 0,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item ? 'Kampanyayı Düzenle' : 'Yeni Kampanya'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {f.image_url && <img src={f.image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 12, border: `1px solid ${BORDER}` }} onError={e => e.target.style.display = 'none'} />}
          <div>
            <label style={fLabel}>Başlık</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['tr', 'en', 'ka', 'ru'].map(l => <input key={l} value={f[`title_${l}`]} onChange={e => set(`title_${l}`, e.target.value)} placeholder={l.toUpperCase()} style={fInput} />)}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={fLabel}>Açıklama (TR)</label><textarea value={f.description_tr} onChange={e => set('description_tr', e.target.value)} rows={2} style={{ ...fInput, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            <div><label style={fLabel}>Açıklama (EN)</label><textarea value={f.description_en} onChange={e => set('description_en', e.target.value)} rows={2} style={{ ...fInput, resize: 'vertical', fontFamily: 'inherit' }} /></div>
          </div>
          <div><label style={fLabel}>Görsel URL</label><input value={f.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." style={fInput} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={fLabel}>İndirim %</label><input type="number" value={f.discount_percent} onChange={e => set('discount_percent', e.target.value)} style={fInput} /></div>
            <div><label style={fLabel}>Rozet Metni</label><input value={f.badge_text} onChange={e => set('badge_text', e.target.value)} placeholder="YENİ / FIRSAT" style={fInput} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={fLabel}>Başlangıç</label><input type="date" value={f.starts_at || ''} onChange={e => set('starts_at', e.target.value)} style={fInput} /></div>
            <div><label style={fLabel}>Bitiş</label><input type="date" value={f.ends_at || ''} onChange={e => set('ends_at', e.target.value)} style={fInput} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa', borderRadius: 12, padding: 14 }}>
            <Check label="Aktif" checked={f.is_active} onChange={v => set('is_active', v)} />
            {hasShowOnce && <Check label="Bir kez göster (müşteri başına)" checked={f.show_once} onChange={v => set('show_once', v)} />}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(f)} style={{ padding: '10px 22px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

function TabBtn({ children, active, onClick, ai }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: active ? (ai ? PURPLE : GREEN) : '#999', borderBottom: `2px solid ${active ? (ai ? PURPLE : GREEN) : 'transparent'}`, marginBottom: -1 }}>{children}</button>
  )
}
function Beta() { return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: '#f3e8ff', color: PURPLE, letterSpacing: '.04em' }}>BETA</span> }
function Check({ label, checked, onChange }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer' }}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> {label}</label>
}
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '12px 16px', verticalAlign: 'middle' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
