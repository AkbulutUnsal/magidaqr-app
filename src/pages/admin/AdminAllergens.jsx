import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Alerjenler  (qrmenum referans · #1D9E75)
   Tablo + AB-14 hızlı ekle. slug şema-uyumlu.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

// AB-14 standart alerjen listesi
const EU14 = [
  { icon: '🌾', slug: 'gluten', color: '#f59e0b', tr: 'Gluten içeren tahıllar', en: 'Cereals (gluten)', ka: 'გლუტენი', ru: 'Глютен' },
  { icon: '🥛', slug: 'sut', color: '#6366f1', tr: 'Süt/Laktoz içerir', en: 'Milk', ka: 'რძე', ru: 'Молоко' },
  { icon: '🥚', slug: 'yumurta', color: '#eab308', tr: 'Yumurta', en: 'Eggs', ka: 'კვერცხი', ru: 'Яйца' },
  { icon: '🐟', slug: 'fish', color: '#0ea5e9', tr: 'Balık ve balık ürünleri', en: 'Fish', ka: 'თევზი', ru: 'Рыба' },
  { icon: '🦐', slug: 'shellfish', color: '#ec4899', tr: 'Kabuklu deniz ürünleri', en: 'Crustaceans', ka: 'კიბოსნაირები', ru: 'Ракообразные' },
  { icon: '🌰', slug: 'sert-meyve', color: '#92400e', tr: 'Sert kabuklu meyveler', en: 'Tree nuts', ka: 'თხილეული', ru: 'Орехи' },
  { icon: '🥜', slug: 'fistik', color: '#ef4444', tr: 'Yer fıstığı ve ürünleri', en: 'Peanuts', ka: 'არაქისი', ru: 'Арахис' },
  { icon: '🫘', slug: 'soya', color: '#22c55e', tr: 'Soya ürünleri', en: 'Soybeans', ka: 'სოია', ru: 'Соя' },
  { icon: '⚪', slug: 'susam', color: '#a16207', tr: 'Susam ve ürünleri', en: 'Sesame', ka: 'სეზამი', ru: 'Кунжут' },
  { icon: '🌿', slug: 'kereviz', color: '#16a34a', tr: 'Kereviz ve ürünleri', en: 'Celery', ka: 'ნიახური', ru: 'Сельдерей' },
  { icon: '🟡', slug: 'hardal', color: '#d97706', tr: 'Hardal ve ürünleri', en: 'Mustard', ka: 'მდოგვი', ru: 'Горчица' },
  { icon: '🍷', slug: 'sulfit', color: '#9333ea', tr: 'Kükürt dioksit ve sülfitler', en: 'Sulphites', ka: 'სულფიტები', ru: 'Сульфиты' },
  { icon: '🌱', slug: 'bakla', color: '#475569', tr: 'Acı bakla ve ürünleri', en: 'Lupin', ka: 'ლუპინი', ru: 'Люпин' },
  { icon: '🐚', slug: 'yumusakca', color: '#0891b2', tr: 'Yumuşakçalar ve ürünleri', en: 'Molluscs', ka: 'მოლუსკები', ru: 'Моллюски' },
]
const PALETTE = ['#f59e0b', '#6366f1', '#0ea5e9', '#ec4899', '#22c55e', '#9333ea', '#ef4444', '#0891b2']

const slugify = s => (s || '').toString().toLowerCase()
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminAllergens() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [quickOpen, setQuickOpen] = useState(false)
  const [modal, setModal] = useState(null)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('allergens').select('*').eq('restaurant_id', profile.restaurant_id).order('created_at')
    setList(data || [])
    setLoading(false)
  }

  const hasSlug = 'slug' in (list[0] || {})
  const dispName = a => a?.[`name_${lang}`] || a?.name_tr || a?.name_en || a?.name_ka || ''
  const rowSlug = a => a.slug || slugify(a.name_en || a.name_tr)
  const existing = useMemo(() => new Set(list.map(a => rowSlug(a))), [list])

  function colorFor(a, i) {
    const s = rowSlug(a)
    const eu = EU14.find(e => e.slug === s)
    return eu?.color || PALETTE[i % PALETTE.length]
  }

  async function add(body) {
    const payload = { icon: body.icon, name_ka: body.name_ka, name_en: body.name_en, name_tr: body.name_tr, name_ru: body.name_ru, restaurant_id: profile.restaurant_id }
    if (hasSlug && body.slug) payload.slug = body.slug
    await supabase.from('allergens').insert(payload)
    load()
  }
  async function quickAdd(c) {
    await add({ icon: c.icon, name_ka: c.ka, name_en: c.en, name_tr: c.tr, name_ru: c.ru, slug: c.slug })
  }
  async function saveCustom(f) {
    const payload = { icon: f.icon, name_ka: f.name_ka, name_en: f.name_en, name_tr: f.name_tr, name_ru: f.name_ru }
    if (hasSlug) payload.slug = f.slug || slugify(f.name_tr || f.name_en)
    if (f.id) await supabase.from('allergens').update(payload).eq('id', f.id)
    else await supabase.from('allergens').insert({ ...payload, restaurant_id: profile.restaurant_id })
    setModal(null); load()
  }
  async function del(id) {
    if (!confirm('Alerjen silinsin mi?')) return
    await supabase.from('allergens').delete().eq('id', id)
    setList(prev => prev.filter(a => a.id !== id))
  }

  const remaining = EU14.filter(c => !existing.has(c.slug))

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Alerjenler</h1>
          <p style={{ fontSize: 13, color: MUTED }}>Ürünlerde gösterilecek alerjen etiketleri</p>
        </div>
        <button onClick={() => setModal({ item: null })}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
          <PlusIcon /> Alerjen Ekle
        </button>
      </div>

      {/* Hızlı ekle (AB-14) */}
      {remaining.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 16, overflow: 'hidden' }}>
          <button onClick={() => setQuickOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>⚡ Hızlı Ekle <span style={{ color: '#aaa', fontWeight: 600 }}>· AB-14 standart ({remaining.length} kaldı)</span></span>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" style={{ transform: (quickOpen || list.length === 0) ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {(quickOpen || list.length === 0) && (
            <div style={{ padding: '0 18px 18px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {remaining.map(c => (
                <button key={c.slug} onClick={() => quickAdd(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#333' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{c.icon}</span>
                  {c.tr}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tablo */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
            <p style={{ fontSize: 14 }}>Henüz alerjen yok. Yukarıdan hızlı ekle veya "Alerjen Ekle".</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ ...th, width: 70 }}>İkon</th>
                <th style={th}>Ad</th>
                <th style={th}>Slug</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={td}>
                    <span style={{ width: 38, height: 38, borderRadius: '50%', background: colorFor(a, i) + '22', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{a.icon}</span>
                  </td>
                  <td style={td}><span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{dispName(a)}</span></td>
                  <td style={td}><span style={{ fontSize: 12, fontFamily: 'monospace', color: '#888', background: '#f4f4f2', padding: '4px 10px', borderRadius: 6 }}>{rowSlug(a)}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => setModal({ item: a })} style={iconBtn} title="Düzenle"><EditIcon /></button>
                    <button onClick={() => del(a.id)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && list.length > 0 && !hasSlug && (
        <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 14 }}>
          <b>Not (reis):</b> Slug isimden otomatik gösteriliyor. Kalıcı slug için <code>allergens</code> tablosuna <code>slug</code> (text) kolonu ekleyebilirsin.
        </p>
      )}

      {modal && <AllergenModal item={modal.item} hasSlug={hasSlug} onSave={saveCustom} onClose={() => setModal(null)} />}
    </div>
  )
}

function AllergenModal({ item, hasSlug, onSave, onClose }) {
  const [f, setF] = useState({
    id: item?.id || null, icon: item?.icon || '⚠️',
    name_ka: item?.name_ka || '', name_en: item?.name_en || '', name_tr: item?.name_tr || '', name_ru: item?.name_ru || '',
    slug: item?.slug || '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '50px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item ? 'Alerjeni Düzenle' : 'Yeni Alerjen'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <div style={{ width: 70 }}>
              <label style={fLabel}>İkon</label>
              <input value={f.icon} onChange={e => set('icon', e.target.value)} style={{ ...fInput, textAlign: 'center', fontSize: 20 }} />
            </div>
            {hasSlug && (
              <div style={{ flex: 1 }}>
                <label style={fLabel}>Slug</label>
                <input value={f.slug} onChange={e => set('slug', e.target.value)} placeholder={slugify(f.name_tr || f.name_en) || 'gluten'} style={{ ...fInput, fontFamily: 'monospace' }} />
              </div>
            )}
          </div>
          <div>
            <label style={fLabel}>İsim</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['tr', 'en', 'ka', 'ru'].map(l => <input key={l} value={f[`name_${l}`]} onChange={e => set(`name_${l}`, e.target.value)} placeholder={l.toUpperCase()} style={fInput} />)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={() => onSave(f)} disabled={!f.name_tr && !f.name_en} style={{ padding: '10px 22px', background: (f.name_tr || f.name_en) ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (f.name_tr || f.name_en) ? 'pointer' : 'default' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td = { padding: '11px 16px', verticalAlign: 'middle' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 6, borderRadius: 8 }
const fLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }
const fInput = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
