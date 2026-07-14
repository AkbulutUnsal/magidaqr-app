import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Müşteriler & Sadakat (CRM · Faz 2a)  ·  /admin/crm
   Müşteri kartları + puan (harcamaya göre) + damga (X sipariş = ödül).
   Manuel puan/damga ekle-kullan, geçmiş defteri, WhatsApp/ara kısayolu, ayarlar.
   Şema: customers, loyalty_transactions, restaurants(loyalty_*).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const AMBER = '#f59e0b'
const VIOLET = '#8b5cf6'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const money = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + '₾'
const waDigits = p => (p || '').replace(/[^\d]/g, '')
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const ago = ts => {
  if (!ts) return 'hiç'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'az önce'
  const m = Math.floor(s / 60); if (m < 60) return `${m} dk`
  const h = Math.floor(m / 60); if (h < 24) return `${h} sa`
  const d = Math.floor(h / 24); return `${d} gün önce`
}
const DEFAULT_SETTINGS = { loyalty_enabled: true, loyalty_points_per_gel: 1, loyalty_stamps_needed: 10, loyalty_reward: 'Bir sonraki siparişte ikram' }

export default function AdminCRM() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selId, setSelId] = useState(null)
  const [formCust, setFormCust] = useState(null)   // {} yeni · {..} düzenle
  const [settingsOpen, setSettingsOpen] = useState(false)
  const ridRef = useRef(profile?.restaurant_id)
  useEffect(() => { ridRef.current = profile?.restaurant_id }, [profile?.restaurant_id])

  async function load() {
    const rid = ridRef.current; if (!rid) return
    const [{ data: cust }, { data: rest }] = await Promise.all([
      supabase.from('customers').select('*').eq('restaurant_id', rid).order('last_visit', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('restaurants').select('*').eq('id', rid).single(),
    ])
    setCustomers(cust || [])
    if (rest) setSettings({
      loyalty_enabled: rest.loyalty_enabled ?? true,
      loyalty_points_per_gel: rest.loyalty_points_per_gel ?? 1,
      loyalty_stamps_needed: rest.loyalty_stamps_needed ?? 10,
      loyalty_reward: rest.loyalty_reward ?? DEFAULT_SETTINGS.loyalty_reward,
    })
    setLoading(false)
  }

  useEffect(() => {
    if (!profile?.restaurant_id) return
    load()
    const ch = supabase.channel('crm-' + profile.restaurant_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `restaurant_id=eq.${profile.restaurant_id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_transactions', filter: `restaurant_id=eq.${profile.restaurant_id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.restaurant_id])

  const needed = Number(settings.loyalty_stamps_needed || 10)

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    if (!q) return customers
    return customers.filter(c =>
      (c.name || '').toLocaleLowerCase('tr').includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLocaleLowerCase('tr').includes(q))
  }, [customers, search])

  const stats = useMemo(() => ({
    total: customers.length,
    points: customers.reduce((s, c) => s + Number(c.points || 0), 0),
    spent: customers.reduce((s, c) => s + Number(c.total_spent || 0), 0),
    rewardReady: customers.filter(c => Number(c.stamps || 0) >= needed).length,
  }), [customers, needed])

  async function saveCustomer(data) {
    const rid = ridRef.current
    if (data.id) {
      await supabase.from('customers').update({ name: data.name, phone: data.phone, email: data.email, note: data.note }).eq('id', data.id)
    } else {
      await supabase.from('customers').insert({ restaurant_id: rid, name: data.name, phone: data.phone, email: data.email, note: data.note })
    }
    setFormCust(null); load()
  }
  async function deleteCustomer(c) {
    if (!confirm(`${c.name || 'Müşteri'} silinsin mi? Sadakat geçmişi de silinir.`)) return
    await supabase.from('customers').delete().eq('id', c.id)
    setSelId(null); load()
  }
  async function adjustPoints(c, delta, note) {
    const rid = ridRef.current
    const next = Math.max(0, Number(c.points || 0) + delta)
    await supabase.from('customers').update({ points: next }).eq('id', c.id)
    await supabase.from('loyalty_transactions').insert({ restaurant_id: rid, customer_id: c.id, type: delta >= 0 ? 'earn' : 'redeem', points: delta, note: note || (delta >= 0 ? 'Manuel puan' : 'Puan kullanımı') })
    load()
  }
  async function adjustStamps(c, delta, note) {
    const rid = ridRef.current
    const next = Math.max(0, Number(c.stamps || 0) + delta)
    await supabase.from('customers').update({ stamps: next }).eq('id', c.id)
    await supabase.from('loyalty_transactions').insert({ restaurant_id: rid, customer_id: c.id, type: delta >= 0 ? 'stamp' : 'stamp_redeem', stamps: delta, note: note || (delta >= 0 ? 'Damga' : 'Damga kullanımı') })
    load()
  }
  async function redeemReward(c) {
    if (Number(c.stamps || 0) < needed) return
    if (!confirm(`Ödül kullanılsın mı? (${needed} damga düşülecek)\n"${settings.loyalty_reward}"`)) return
    await adjustStamps(c, -needed, `🎁 Ödül: ${settings.loyalty_reward}`)
  }
  async function saveSettings(s) {
    const rid = ridRef.current
    await supabase.from('restaurants').update({
      loyalty_enabled: s.loyalty_enabled,
      loyalty_points_per_gel: Number(s.loyalty_points_per_gel) || 0,
      loyalty_stamps_needed: Number(s.loyalty_stamps_needed) || 1,
      loyalty_reward: s.loyalty_reward,
    }).eq('id', rid)
    setSettings(s); setSettingsOpen(false)
  }

  const selected = customers.find(c => c.id === selId)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* başlık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Müşteriler & Sadakat</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setSettingsOpen(true)} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer' }}>⚙️ Sadakat Ayarları</button>
          <button onClick={() => setFormCust({})} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>➕ Yeni Müşteri</button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi big={stats.total} label="Toplam Müşteri" />
        <Kpi big={stats.points.toLocaleString('tr-TR')} label="Dağıtılan Puan (bakiye)" color={GREEN} />
        <Kpi big={money(stats.spent)} label="Toplam Ciro (kayıtlı)" small />
        <Kpi big={stats.rewardReady} label="Ödüle Hazır" color={stats.rewardReady ? AMBER : '#111'} />
      </div>

      {/* arama */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İsim, telefon veya e-posta ara…"
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', marginBottom: 16 }} />

      {/* liste */}
      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '52px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 10 }}>👤</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{search ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok'}</p>
          <p style={{ fontSize: 12.5, color: MUTED, marginTop: 5 }}>{search ? 'Aramayı değiştir.' : '➕ Yeni Müşteri ile başla.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {filtered.map(c => {
            const st = Number(c.stamps || 0); const ready = st >= needed
            return (
              <button key={c.id} onClick={() => setSelId(c.id)}
                style={{ textAlign: 'left', background: '#fff', border: `1px solid ${ready ? AMBER : BORDER}`, borderRadius: 14, padding: 15, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: GREEN_BG, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                    {(c.name || '?')[0].toLocaleUpperCase('tr')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'İsimsiz'}</p>
                    <p style={{ fontSize: 12, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone || 'telefon yok'}</p>
                  </div>
                  {ready && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: AMBER, borderRadius: 20, padding: '3px 9px', flexShrink: 0 }}>🎁 ÖDÜL</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Mini label="Puan" value={Number(c.points || 0).toLocaleString('tr-TR')} color={GREEN} />
                  <Mini label="Damga" value={`${st}/${needed}`} color={ready ? AMBER : VIOLET} />
                  <Mini label="Ziyaret" value={c.visit_count || 0} />
                </div>
                <p style={{ fontSize: 11, color: '#bbb', marginTop: 10 }}>Son ziyaret: {ago(c.last_visit)}{Number(c.total_spent) > 0 ? ` · ${money(c.total_spent)}` : ''}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* drawer */}
      {selected && (
        <CustomerDrawer
          c={selected} needed={needed} reward={settings.loyalty_reward}
          onClose={() => setSelId(null)}
          onEdit={() => setFormCust(selected)}
          onDelete={() => deleteCustomer(selected)}
          onPoints={(d, n) => adjustPoints(selected, d, n)}
          onStamps={(d, n) => adjustStamps(selected, d, n)}
          onRedeem={() => redeemReward(selected)}
        />
      )}

      {/* yeni/düzenle */}
      {formCust && <CustomerFormModal init={formCust} onCancel={() => setFormCust(null)} onSave={saveCustomer} />}

      {/* ayarlar */}
      {settingsOpen && <SettingsModal init={settings} onCancel={() => setSettingsOpen(false)} onSave={saveSettings} />}
    </div>
  )
}

/* ── Müşteri detay drawer ── */
function CustomerDrawer({ c, needed, reward, onClose, onEdit, onDelete, onPoints, onStamps, onRedeem }) {
  const [tx, setTx] = useState([])
  const [pt, setPt] = useState('')
  useEffect(() => {
    let alive = true
    supabase.from('loyalty_transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (alive) setTx(data || []) })
    return () => { alive = false }
  }, [c.id, c.points, c.stamps])

  const st = Number(c.stamps || 0); const ready = st >= needed
  const wa = waDigits(c.phone)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px,100%)', height: '100%', background: '#f6f7f6', overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,.25)' }}>
        {/* başlık */}
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 2 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: GREEN_BG, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{(c.name || '?')[0].toLocaleUpperCase('tr')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'İsimsiz'}</p>
            <p style={{ fontSize: 12, color: '#aaa' }}>{c.phone || 'telefon yok'}</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 17, color: '#666', cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* hızlı iletişim */}
          <div style={{ display: 'flex', gap: 8 }}>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', background: '#25D366', color: '#fff', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>💬 WhatsApp</a>}
            {c.phone && <a href={`tel:${c.phone}`} style={{ flex: 1, textAlign: 'center', background: '#fff', border: `1px solid ${BORDER}`, color: '#333', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>📞 Ara</a>}
            <button onClick={onEdit} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', fontSize: 13, cursor: 'pointer' }}>✏️</button>
          </div>

          {/* puan + damga kartları */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>PUAN BAKİYESİ</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: GREEN }}>{Number(c.points || 0).toLocaleString('tr-TR')}</p>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${ready ? AMBER : BORDER}`, borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>DAMGA</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: ready ? AMBER : VIOLET }}>{st}<span style={{ fontSize: 14, color: '#bbb' }}>/{needed}</span></p>
              <div style={{ height: 6, borderRadius: 4, background: '#eee', marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (st / needed) * 100)}%`, background: ready ? AMBER : VIOLET }} />
              </div>
            </div>
          </div>

          {ready && (
            <button onClick={onRedeem} style={{ background: AMBER, color: '#000', border: 'none', borderRadius: 11, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>🎁 Ödülü Kullan · {reward}</button>
          )}

          {/* manuel işlemler */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Manuel İşlem</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input value={pt} onChange={e => setPt(e.target.value.replace(/[^\d]/g, ''))} placeholder="Puan" inputMode="numeric"
                style={{ width: 80, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
              <button onClick={() => { const n = parseInt(pt || 0, 10); if (n) onPoints(n); setPt('') }} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ Puan Ekle</button>
              <button onClick={() => { const n = parseInt(pt || 0, 10); if (n) onPoints(-n); setPt('') }} style={{ background: '#fff', color: RED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>− Kullan</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onStamps(1)} style={{ flex: 1, background: VIOLET, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ Damga Ver</button>
              <button onClick={() => onStamps(-1)} style={{ flex: 1, background: '#fff', color: '#666', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>− Damga</button>
            </div>
          </div>

          {/* özet + not */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row k="Toplam harcama" v={money(c.total_spent)} />
            <Row k="Ziyaret sayısı" v={c.visit_count || 0} />
            <Row k="Son ziyaret" v={fmtDate(c.last_visit)} />
            <Row k="Kayıt" v={fmtDate(c.created_at)} />
            {c.email && <Row k="E-posta" v={c.email} />}
            {c.note && <div style={{ marginTop: 4, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '7px 9px' }}><p style={{ fontSize: 12, color: '#92620a' }}>📝 {c.note}</p></div>}
          </div>

          {/* geçmiş */}
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: '#444' }}>Sadakat Geçmişi</p>
            {tx.length === 0 ? (
              <p style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>Henüz hareket yok.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tx.map(t => {
                  const p = Number(t.points || 0); const s = Number(t.stamps || 0)
                  const pos = p > 0 || s > 0
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 11px' }}>
                      <span style={{ fontSize: 15 }}>{t.type === 'stamp_redeem' ? '🎁' : pos ? '➕' : '➖'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note || t.type}</p>
                        <p style={{ fontSize: 10.5, color: '#bbb' }}>{fmtDate(t.created_at)}</p>
                      </div>
                      {p !== 0 && <span style={{ fontSize: 12.5, fontWeight: 800, color: p > 0 ? GREEN : RED }}>{p > 0 ? '+' : ''}{p} puan</span>}
                      {s !== 0 && <span style={{ fontSize: 12.5, fontWeight: 800, color: s > 0 ? VIOLET : AMBER }}>{s > 0 ? '+' : ''}{s} damga</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={onDelete} style={{ background: '#fff', border: `1px solid ${BORDER}`, color: RED, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>🗑️ Müşteriyi Sil</button>
        </div>
      </div>
    </div>
  )
}

/* ── Yeni / Düzenle müşteri ── */
function CustomerFormModal({ init, onCancel, onSave }) {
  const [f, setF] = useState({ id: init.id, name: init.name || '', phone: init.phone || '', email: init.email || '', note: init.note || '' })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const inp = { width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', marginBottom: 10 }
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px,100%)', background: '#fff', borderRadius: 16, padding: 20 }}>
        <p style={{ fontSize: 17, fontWeight: 900, marginBottom: 16 }}>{init.id ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}</p>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Ad Soyad</label>
        <input value={f.name} onChange={e => set('name', e.target.value)} style={inp} placeholder="Ad Soyad" />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Telefon</label>
        <input value={f.phone} onChange={e => set('phone', e.target.value)} style={inp} placeholder="+995 5xx xx xx xx" />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>E-posta (opsiyonel)</label>
        <input value={f.email} onChange={e => set('email', e.target.value)} style={inp} placeholder="ornek@mail.com" />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Not (opsiyonel)</label>
        <textarea value={f.note} onChange={e => set('note', e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="VIP, alerji, tercih vb." />
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button onClick={onCancel} style={{ flex: 1, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#666', cursor: 'pointer' }}>Vazgeç</button>
          <button onClick={() => onSave(f)} disabled={!f.name && !f.phone} style={{ flex: 1, background: (!f.name && !f.phone) ? '#cbd5d0' : GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: (!f.name && !f.phone) ? 'not-allowed' : 'pointer' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

/* ── Sadakat ayarları ── */
function SettingsModal({ init, onCancel, onSave }) {
  const [s, setS] = useState({ ...init })
  const set = (k, v) => setS(p => ({ ...p, [k]: v }))
  const inp = { width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', marginBottom: 12 }
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px,100%)', background: '#fff', borderRadius: 16, padding: 20 }}>
        <p style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>Sadakat Ayarları</p>
        <p style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>Puan ve damga kuralları (otomatik kazanım Faz 2b'de bunları kullanır).</p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!s.loyalty_enabled} onChange={e => set('loyalty_enabled', e.target.checked)} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Sadakat sistemi aktif</span>
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>1 ₾ harcama = kaç puan</label>
        <input value={s.loyalty_points_per_gel} onChange={e => set('loyalty_points_per_gel', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" style={inp} />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Kaç damga = 1 ödül</label>
        <input value={s.loyalty_stamps_needed} onChange={e => set('loyalty_stamps_needed', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={inp} />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Ödül açıklaması</label>
        <input value={s.loyalty_reward} onChange={e => set('loyalty_reward', e.target.value)} style={inp} placeholder="Bir sonraki siparişte ikram" />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onCancel} style={{ flex: 1, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#666', cursor: 'pointer' }}>Vazgeç</button>
          <button onClick={() => onSave(s)} style={{ flex: 1, background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

/* ── küçük parçalar ── */
function Kpi({ big, label, color = '#111', small }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
      <p style={{ fontSize: small ? 22 : 30, fontWeight: 900, color }}>{big}</p>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, marginTop: 2 }}>{label}</p>
    </div>
  )
}
function Mini({ label, value, color = '#111' }) {
  return (
    <div style={{ flex: 1, background: '#fafafa', border: `1px solid #f0f0ee`, borderRadius: 9, padding: '7px 9px', textAlign: 'center' }}>
      <p style={{ fontSize: 15, fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: 9.5, color: MUTED, marginTop: 1 }}>{label}</p>
    </div>
  )
}
function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
      <span style={{ color: MUTED }}>{k}</span>
      <span style={{ color: '#222', fontWeight: 600, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
