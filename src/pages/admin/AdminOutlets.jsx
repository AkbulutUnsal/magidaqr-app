import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { getPlan } from '../../lib/plans'

/* ───────────────────────────────────────────────────────────
   magidaQR · Outlet'ler  (qrmenum referans · #1D9E75)
   slug + show_name şema-uyumlu (kolon varsa kalıcı).
   Plan limiti (getPlan.maxOutlets) korundu.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const slugify = s => (s || '').toString().toLowerCase()
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminOutlets() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)
  const [plan, setPlan] = useState('basic')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('outlets').select('*').eq('restaurant_id', profile.restaurant_id).order('created_at')
    setList(data || [])
    if (profile?.tenant_id) {
      const { data: tenant } = await supabase.from('tenants').select('plan').eq('id', profile.tenant_id).single()
      if (tenant?.plan) setPlan(tenant.plan)
    }
    setLoading(false)
  }

  const maxOutlets = getPlan(plan).maxOutlets
  const limitReached = list.length >= maxOutlets

  const sample = list[0] || {}
  const hasSlug = 'slug' in sample
  const hasShowName = 'show_name' in sample
  const missing = useMemo(() => list.length ? [!hasSlug && 'slug', !hasShowName && 'show_name'].filter(Boolean) : [], [list, hasSlug, hasShowName])

  async function save(form) {
    const payload = {
      restaurant_id: profile.restaurant_id,
      name: form.name, address: form.address, phone: form.phone,
      lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null,
      is_active: form.is_active,
    }
    if (hasSlug) payload.slug = form.slug || slugify(form.name)
    if (hasShowName) payload.show_name = form.show_name
    if (edit?.id) await supabase.from('outlets').update(payload).eq('id', edit.id)
    else await supabase.from('outlets').insert(payload)
    setShow(false); setEdit(null); load()
  }

  async function toggleActive(o) {
    setList(prev => prev.map(x => x.id === o.id ? { ...x, is_active: !x.is_active } : x))
    await supabase.from('outlets').update({ is_active: !o.is_active }).eq('id', o.id)
  }
  async function toggleShowName(o) {
    if (!hasShowName) return
    setList(prev => prev.map(x => x.id === o.id ? { ...x, show_name: !x.show_name } : x))
    await supabase.from('outlets').update({ show_name: !o.show_name }).eq('id', o.id)
  }
  async function del(id) {
    if (!confirm('Şube/outlet silinsin mi?')) return
    await supabase.from('outlets').delete().eq('id', id)
    setList(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Outlet'ler</h1>
          <p style={{ fontSize: 13, color: MUTED }}>Her outlet kendi QR kodu, kendi ana sayfası ve kendi içerik filtresiyle çalışır.</p>
        </div>
        <button onClick={() => { if (!limitReached) { setEdit(null); setShow(true) } }} disabled={limitReached}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: limitReached ? '#d8d8d4' : GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: limitReached ? 'not-allowed' : 'pointer', boxShadow: limitReached ? 'none' : '0 4px 12px rgba(29,158,117,.3)' }}>
          <PlusIcon /> Yeni Outlet Ekle
        </button>
      </div>

      {limitReached && (
        <div style={{ background: '#fff8e8', border: '1px solid #ffe9b8', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🔒</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#8a6d1a' }}>Outlet limitine ulaştın</p>
            <p style={{ fontSize: 12, color: '#a98a3a', marginTop: 2 }}>Temel paket tek outlet içerir. Çoklu outlet için <strong>Gelişmiş paket</strong>'e geç.</p>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏬</div>
            <p style={{ fontSize: 14 }}>Henüz outlet yok. "Yeni Outlet Ekle" ile başla.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={th}>Outlet</th>
                <th style={th}>Slug</th>
                <th style={{ ...th, textAlign: 'center' }}>Ad Göster</th>
                <th style={{ ...th, textAlign: 'center' }}>Durum</th>
                <th style={{ ...th, textAlign: 'right', width: 120 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.map(o => {
                const slug = o.slug || slugify(o.name)
                const showName = hasShowName ? o.show_name !== false : true
                return (
                  <tr key={o.id} style={{ borderTop: `1px solid ${BORDER}`, opacity: o.is_active ? 1 : 0.6 }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1-5h16l1 5" /><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M3 9h18" /></svg>
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{o.name}</p>
                          {o.address && <p style={{ fontSize: 11.5, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{o.address}</p>}
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#888', background: '#f4f4f2', padding: '4px 10px', borderRadius: 6 }}>{slug}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => toggleShowName(o)} disabled={!hasShowName}
                        style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: hasShowName ? 'pointer' : 'default', background: showName ? GREEN_BG : '#f4f4f2', color: showName ? GREEN : '#999' }}>
                        {showName ? 'Evet' : 'Hayır'}
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => toggleActive(o)}
                        style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: o.is_active ? GREEN_BG : '#fef2f2', color: o.is_active ? GREEN : '#dc2626' }}>
                        {o.is_active ? 'Aktif' : 'Pasif'}
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {o.lat && o.lng && (
                        <a href={`https://maps.google.com/?q=${o.lat},${o.lng}`} target="_blank" rel="noreferrer" title="Haritada gör" style={{ ...iconBtn, display: 'inline-flex', textDecoration: 'none' }}>
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        </a>
                      )}
                      <button onClick={() => { setEdit(o); setShow(true) }} style={iconBtn} title="Düzenle"><EditIcon /></button>
                      <button onClick={() => del(o.id)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
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
          <b>Not (reis):</b> <code>{missing.join(', ')}</code> kolonu <code>outlets</code> tablosunda yok — şu an
          {missing.includes('slug') && ' slug isimden otomatik gösteriliyor ama kaydedilmiyor;'}
          {missing.includes('show_name') && ' "Ad Göster" hep Evet.'}
          {' '}Kolonları eklersen ({hasSlug ? '' : 'slug text, '}{hasShowName ? '' : 'show_name bool'}) kalıcı olur.
        </p>
      )}

      {show && <OutletModal item={edit} hasSlug={hasSlug} hasShowName={hasShowName} onSave={save} onClose={() => { setShow(false); setEdit(null) }} />}
    </div>
  )
}

function OutletModal({ item, hasSlug, hasShowName, onSave, onClose }) {
  const [f, setF] = useState({
    name: item?.name || '', slug: item?.slug || '', address: item?.address || '', phone: item?.phone || '',
    lat: item?.lat || '', lng: item?.lng || '', is_active: item?.is_active ?? true, show_name: item?.show_name ?? true,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const slugAuto = f.slug || slugify(f.name)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '50px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item ? "Outlet'i Düzenle" : 'Yeni Outlet'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={fLabel}>Outlet Adı</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Merkez Şube" style={fInput} /></div>
          {hasSlug && (
            <div>
              <label style={fLabel}>Slug <span style={{ fontWeight: 400, color: '#bbb' }}>· /menu/{slugAuto || '...'}</span></label>
              <input value={f.slug} onChange={e => set('slug', e.target.value)} placeholder={slugify(f.name) || 'merkez-sube'} style={{ ...fInput, fontFamily: 'monospace' }} />
            </div>
          )}
          <div><label style={fLabel}>Adres</label><textarea value={f.address} onChange={e => set('address', e.target.value)} rows={2} style={{ ...fInput, resize: 'vertical', fontFamily: 'inherit' }} /></div>
          <div><label style={fLabel}>Telefon</label><input value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+995 555 000 000" style={fInput} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={fLabel}>Enlem (lat)</label><input value={f.lat} onChange={e => set('lat', e.target.value)} placeholder="41.7151" style={fInput} /></div>
            <div><label style={fLabel}>Boylam (lng)</label><input value={f.lng} onChange={e => set('lng', e.target.value)} placeholder="44.8271" style={fInput} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa', borderRadius: 12, padding: 14 }}>
            <Check label="Aktif" checked={f.is_active} onChange={v => set('is_active', v)} />
            {hasShowName && <Check label="Menüde outlet adını göster" checked={f.show_name} onChange={v => set('show_name', v)} />}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(f)} disabled={!f.name} style={{ padding: '10px 22px', background: f.name ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: f.name ? 'pointer' : 'default' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

function Check({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#333', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> {label}
    </label>
  )
}
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '12px 16px', verticalAlign: 'middle' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
