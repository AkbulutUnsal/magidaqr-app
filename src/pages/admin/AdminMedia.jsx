import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Medya  (qrmenum referans · #1D9E75)
   Görsel + video, Aktif durumu (is_active varsa), hazır galeri.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const isVideo = (m) => (m?.type === 'video') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(m?.url || '')

// hazır stok görseller (reis: dilediğin gibi değiştir)
const GALLERY = [
  ['1504674900247-0877df9cc836', 'Yemek Sofrası'], ['1546069901-ba9599a7e63c', 'Salata Kasesi'],
  ['1567620905732-2d1ec7ab7445', 'Kahvaltı'], ['1565299624946-b28f40a0ae38', 'Pizza'],
  ['1551782450-a2132b4ba21d', 'Burger'], ['1565958011703-44f9829ba187', 'Tatlı & Kahve'],
  ['1414235077428-338989a2e8c0', 'Restoran İç'], ['1517248135467-4c7edcad34c4', 'Masa Düzeni'],
  ['1533777324565-a040eb52facd', 'Kokteyl'], ['1551024601-bec78aea704b', 'Donut'],
  ['1559339352-11d035aa65de', 'Kafe'], ['1482049016688-2d3e1b311543', 'Akşam Yemeği'],
].map(([id, name]) => ({ url: `https://images.unsplash.com/photo-${id}?w=500&q=70&auto=format&fit=crop`, name }))

export default function AdminMedia() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [copied, setCopied] = useState(null)
  const [galleryOpen, setGalleryOpen] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('media_library').select('*').eq('restaurant_id', profile.restaurant_id).order('created_at', { ascending: false })
    setList(data || [])
    setLoading(false)
  }

  const statusField = 'is_active' in (list[0] || {}) ? 'is_active' : 'active' in (list[0] || {}) ? 'active' : null
  const usedUrls = useMemo(() => new Set(list.map(m => m.url)), [list])

  async function addMedia({ url, name, type, active }) {
    if (!url) return
    const payload = { restaurant_id: profile.restaurant_id, url, name: name || (type === 'video' ? 'Video' : 'Görsel'), type }
    if (statusField) payload[statusField] = active ?? true
    await supabase.from('media_library').insert(payload)
    load()
  }

  async function del(id) {
    if (!confirm('Görsel silinsin mi?')) return
    await supabase.from('media_library').delete().eq('id', id)
    setList(prev => prev.filter(m => m.id !== id))
  }

  async function toggleActive(m) {
    if (!statusField) return
    const val = !m[statusField]
    setList(prev => prev.map(x => x.id === m.id ? { ...x, [statusField]: val } : x))
    await supabase.from('media_library').update({ [statusField]: val }).eq('id', m.id)
  }

  async function saveRename(id) {
    await supabase.from('media_library').update({ name: editName || 'Görsel' }).eq('id', id)
    setList(prev => prev.map(m => m.id === id ? { ...m, name: editName || 'Görsel' } : m))
    setEditingId(null)
  }

  function copy(u) { navigator.clipboard.writeText(u); setCopied(u); setTimeout(() => setCopied(null), 1500) }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Medya</h1>
          <p style={{ fontSize: 13, color: MUTED }}>{list.length} medya · görselleri ürün/kampanyada kopyalayıp kullan</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
          <PlusIcon /> Medya Ekle
        </button>
      </div>

      {/* Izgara */}
      {loading ? (
        <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
      ) : list.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb', marginTop: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️</div>
          <p style={{ fontSize: 14 }}>Henüz medya yok. "Medya Ekle" ile başla veya aşağıdaki hazır galeriyi kullan.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 16, marginTop: 16 }}>
          {list.map(m => {
            const vid = isVideo(m)
            const active = statusField ? !!m[statusField] : true
            return (
              <div key={m.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ position: 'relative', height: 180, background: '#111' }}>
                  {vid
                    ? <video src={m.url} preload="metadata" controls style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                    : <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={ePlaceholder} />}
                  <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,.6)', color: '#fff' }}>{vid ? '▷ Video' : 'Görsel'}</span>
                  <button onClick={() => toggleActive(m)} disabled={!statusField}
                    style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: 'none', cursor: statusField ? 'pointer' : 'default', background: active ? GREEN : '#9ca3af', color: '#fff' }}>
                    {active ? 'Aktif' : 'Pasif'}
                  </button>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {editingId === m.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                        style={{ flex: 1, padding: '5px 8px', border: `1px solid ${GREEN}`, borderRadius: 6, fontSize: 12 }} />
                      <button onClick={() => saveRename(m.id)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '0 8px', cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => copy(m.url)} style={{ flex: 1, padding: '6px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: copied === m.url ? GREEN_BG : '#fff', color: copied === m.url ? GREEN : '#666', cursor: 'pointer' }}>
                      {copied === m.url ? '✓ Kopyalandı' : '📋 Kopyala'}
                    </button>
                    <button onClick={() => { setEditingId(m.id); setEditName(m.name || '') }} title="Yeniden adlandır" style={iconBtn}><EditIcon /></button>
                    <button onClick={() => del(m.id)} title="Sil" style={{ ...iconBtn, color: RED }}><TrashIcon /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hazır Medya Galerisi */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, marginTop: 22, overflow: 'hidden' }}>
        <button onClick={() => setGalleryOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖼️</span>
            Hazır Medya Galerisi
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: MUTED }}>
            {GALLERY.length} hazır medya
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: galleryOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </button>
        {galleryOpen && (
          <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            {GALLERY.map((g, i) => {
              const added = usedUrls.has(g.url)
              return (
                <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ height: 110, background: '#f5f5f3' }}>
                    <img src={g.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={ePlaceholder} />
                  </div>
                  <button onClick={() => !added && addMedia({ url: g.url, name: g.name, type: 'image', active: true })} disabled={added}
                    style={{ width: '100%', padding: '8px', border: 'none', borderTop: `1px solid ${BORDER}`, background: added ? '#f4f4f2' : '#fff', color: added ? '#aaa' : GREEN, fontSize: 12, fontWeight: 700, cursor: added ? 'default' : 'pointer' }}>
                    {added ? '✓ Eklendi' : '+ Kütüphaneye Ekle'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && <AddModal statusField={statusField} onSave={addMedia} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

/* ── Ekle modalı ── */
function AddModal({ statusField, onSave, onClose }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const vid = isVideo({ url })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>Medya Ekle</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={fLabel}>Görsel / Video URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={fInput} autoFocus />
          </div>
          {url && (
            <div style={{ height: 150, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#111' }}>
              {vid
                ? <video src={url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={ePlaceholder} />}
            </div>
          )}
          <div>
            <label style={fLabel}>İsim (opsiyonel) <span style={{ fontWeight: 400, color: '#bbb' }}>· tip: {vid ? 'Video' : 'Görsel'} (otomatik)</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Kapak, Tanıtım videosu..." style={fInput} />
          </div>
          {statusField && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer' }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> Aktif
            </label>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => { onSave({ url, name, type: vid ? 'video' : 'image', active }); onClose() }} disabled={!url}
            style={{ padding: '10px 22px', background: url ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: url ? 'pointer' : 'default' }}>Ekle</button>
        </div>
      </div>
    </div>
  )
}

/* ── yardımcılar ── */
function ePlaceholder(e) { e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23eee%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2256%22 text-anchor=%22middle%22 fill=%22%23aaa%22 font-size=%2228%22%3E?%3C/text%3E%3C/svg%3E' }
const iconBtn = { background: '#fff', border: `1px solid ${BORDER}`, cursor: 'pointer', color: '#999', padding: '6px 9px', borderRadius: 7 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
