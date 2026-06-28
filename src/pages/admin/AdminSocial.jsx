import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Sosyal Medya Linkleri  (qrmenum referans · #1D9E75)
   social_links tablosu varsa → dinamik (her platform).
   yoksa → restaurants'taki sabit kolonlar (instagram_url vb.).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

// sabit mod kolonları
const FIXED = [
  { label: 'Instagram', column: 'instagram_url', ph: 'https://instagram.com/...' },
  { label: 'Facebook', column: 'facebook_url', ph: 'https://facebook.com/...' },
  { label: 'TikTok', column: 'tiktok_url', ph: 'https://tiktok.com/@...' },
  { label: 'Web Sitesi', column: 'website_url', ph: 'https://...' },
  { label: 'WhatsApp', column: 'whatsapp_number', ph: '+995 555 000 000' },
  { label: 'WiFi Şifresi', column: 'wifi_password', ph: 'Misafir WiFi şifresi' },
]
// dinamik modda seçilebilen platformlar
const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'X (Twitter)', 'TripAdvisor', 'Google Maps', 'Web Sitesi', 'WhatsApp', 'Telegram', 'Diğer']

function iconFor(label = '') {
  const l = label.toLowerCase()
  if (l.includes('instagram')) return '📷'
  if (l.includes('facebook')) return '👍'
  if (l.includes('tiktok')) return '🎵'
  if (l.includes('youtube')) return '▶️'
  if (l.includes('twitter') || l === 'x' || l.includes('(twitter)')) return '✖️'
  if (l.includes('tripadvisor')) return '🦉'
  if (l.includes('maps') || l.includes('harita')) return '🗺️'
  if (l.includes('web') || l.includes('site')) return '🌐'
  if (l.includes('whatsapp')) return '💬'
  if (l.includes('telegram')) return '✈️'
  if (l.includes('wifi')) return '📶'
  return '🔗'
}

export default function AdminSocial() {
  const { profile } = useAuth()
  const [mode, setMode] = useState(null)      // 'dynamic' | 'fixed'
  const [links, setLinks] = useState([])      // dinamik
  const [data, setData] = useState({})        // sabit
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)    // { item }

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const rid = profile.restaurant_id
    const probe = await supabase.from('social_links').select('*').eq('restaurant_id', rid).order('sort_order')
    if (!probe.error) {
      setMode('dynamic'); setLinks(probe.data || [])
    } else {
      setMode('fixed')
      const { data: r } = await supabase.from('restaurants')
        .select('instagram_url,facebook_url,tiktok_url,website_url,whatsapp_number,wifi_password')
        .eq('id', rid).single()
      setData(r || {})
    }
    setLoading(false)
  }

  // görüntü satırları
  const rows = useMemo(() => {
    if (mode === 'dynamic') return links.map(l => ({ id: l.id, platform: l.platform, url: l.url, active: l.is_active !== false, raw: l }))
    return FIXED.filter(f => data[f.column]).map(f => ({ id: f.column, platform: f.label, url: data[f.column], active: true, column: f.column }))
  }, [mode, links, data])

  // ── dinamik işlemler ──
  async function saveDynamic(form) {
    const payload = { restaurant_id: profile.restaurant_id, platform: form.platform, url: form.url, is_active: form.active }
    if (form.id) await supabase.from('social_links').update(payload).eq('id', form.id)
    else { payload.sort_order = links.length; await supabase.from('social_links').insert(payload) }
    setModal(null); load()
  }
  async function toggleDynamic(l) {
    setLinks(prev => prev.map(x => x.id === l.id ? { ...x, is_active: !x.is_active } : x))
    await supabase.from('social_links').update({ is_active: !l.is_active }).eq('id', l.id)
  }
  async function delDynamic(id) {
    if (!confirm('Link silinsin mi?')) return
    await supabase.from('social_links').delete().eq('id', id)
    setLinks(prev => prev.filter(x => x.id !== id))
  }

  // ── sabit işlemler ──
  async function saveFixed(form) {
    const col = FIXED.find(f => f.label === form.platform)?.column
    if (!col) return
    setData(p => ({ ...p, [col]: form.url }))
    await supabase.from('restaurants').update({ [col]: form.url }).eq('id', profile.restaurant_id)
    setModal(null)
  }
  async function delFixed(col) {
    if (!confirm('Link silinsin mi?')) return
    setData(p => ({ ...p, [col]: null }))
    await supabase.from('restaurants').update({ [col]: null }).eq('id', profile.restaurant_id)
  }

  const fixedAvailable = FIXED.filter(f => !data[f.column])
  const canAdd = mode === 'dynamic' || fixedAvailable.length > 0

  function openAdd() {
    if (mode === 'dynamic') setModal({ item: null })
    else setModal({ item: null, fixedAvailable })
  }
  function openEdit(row) {
    if (mode === 'dynamic') setModal({ item: row.raw })
    else setModal({ item: { platform: row.platform, url: row.url, column: row.column }, fixed: true })
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Sosyal Medya Linkleri</h1>
          <p style={{ fontSize: 13, color: MUTED }}>Müşteri menüsünde gösterilecek bağlantılar.</p>
        </div>
        <button onClick={openAdd} disabled={!canAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: canAdd ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: canAdd ? 'pointer' : 'default', boxShadow: canAdd ? '0 4px 12px rgba(29,158,117,.3)' : 'none' }}>
          <PlusIcon /> Link Ekle
        </button>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔗</div>
            <p style={{ fontSize: 14 }}>Henüz link yok. "Link Ekle" ile başla.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={th}>Platform</th>
                <th style={th}>URL</th>
                <th style={{ ...th, textAlign: 'center', width: 90 }}>Durum</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: r.active ? 1 : 0.6 }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{iconFor(r.platform)}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{r.platform}</span>
                    </div>
                  </td>
                  <td style={{ ...td, maxWidth: 380 }}>
                    <a href={r.url?.startsWith('http') ? r.url : undefined} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: '#777', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.url}</a>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {mode === 'dynamic' ? (
                      <button onClick={() => toggleDynamic(r.raw)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: r.active ? GREEN_BG : '#fef2f2', color: r.active ? GREEN : '#dc2626' }}>{r.active ? 'Aktif' : 'Pasif'}</button>
                    ) : (
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: GREEN_BG, color: GREEN }}>Aktif</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => openEdit(r)} style={iconBtn} title="Düzenle"><EditIcon /></button>
                    <button onClick={() => mode === 'dynamic' ? delDynamic(r.id) : delFixed(r.column)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mode === 'fixed' && (
        <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 14, lineHeight: 1.6 }}>
          <b>Not (reis):</b> Şu an sabit kolonlarla çalışıyor (Instagram/Facebook/TikTok/Web/WhatsApp/WiFi). TripAdvisor, Google Maps gibi <i>istediğin platformu</i> ekleyebilmek için <code>social_links</code> (restaurant_id, platform, url, is_active, sort_order) tablosu açarsan sayfa otomatik dinamik moda geçer.
        </p>
      )}

      {modal && (
        <LinkModal mode={mode} ctx={modal}
          onSave={f => mode === 'dynamic' ? saveDynamic(f) : saveFixed(f)}
          onClose={() => setModal(null)} />
      )}
    </div>
  )
}

function LinkModal({ mode, ctx, onSave, onClose }) {
  const item = ctx.item
  const isFixedEdit = ctx.fixed
  const fixedAvail = ctx.fixedAvailable || []
  const [f, setF] = useState({
    id: item?.id || null,
    platform: item?.platform || (mode === 'dynamic' ? PLATFORMS[0] : (fixedAvail[0]?.label || '')),
    url: item?.url || '',
    active: item?.is_active ?? true,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item ? 'Linki Düzenle' : 'Yeni Link'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={fLabel}>Platform</label>
            {isFixedEdit ? (
              <input value={f.platform} disabled style={{ ...fInput, background: '#f4f4f2', color: '#888' }} />
            ) : (
              <select value={f.platform} onChange={e => set('platform', e.target.value)} style={fInput}>
                {(mode === 'dynamic' ? PLATFORMS : fixedAvail.map(x => x.label)).map(p => <option key={p} value={p}>{iconFor(p)} {p}</option>)}
              </select>
            )}
          </div>
          <div>
            <label style={fLabel}>URL / Değer</label>
            <input value={f.url} onChange={e => set('url', e.target.value)} placeholder="https://..." style={fInput} autoFocus />
          </div>
          {mode === 'dynamic' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> Aktif
            </label>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(f)} disabled={!f.url} style={{ padding: '10px 22px', background: f.url ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: f.url ? 'pointer' : 'default' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '13px 16px', verticalAlign: 'middle' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box', background: '#fff' }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
