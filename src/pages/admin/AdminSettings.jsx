import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Ayarlar  (qrmenum referans · #1D9E75)
   3 sekme + canlı telefon önizleme + sticky kaydet (⌘S).
   Şema-güvenli kayıt: yalnızca restaurants'ta var olan kolonlar
   yazılır; olmayanlar UI'da görünür ama kaydedilmez (altta liste).
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const CUR_SYM = { GEL: '₾', TRY: '₺', USD: '$', EUR: '€' }
const LANGS = [['ka', 'Gürcüce'], ['en', 'İngilizce'], ['tr', 'Türkçe'], ['ru', 'Rusça']]

export default function AdminSettings() {
  const { profile } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [form, setForm] = useState({})
  const [tab, setTab] = useState('info') // info | design | home
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [logoUp, setLogoUp] = useState(false)
  const [coverUp, setCoverUp] = useState(false)

  useEffect(() => {
    if (!profile?.restaurant_id) return
    supabase.from('restaurants').select('*').eq('id', profile.restaurant_id).single()
      .then(({ data }) => { setRestaurant(data); setForm(data || {}) })
  }, [profile?.restaurant_id])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // kaydederken denenecek tüm alanlar
  const desiredKeys = useMemo(() => ([
    'name_ka', 'name_en', 'name_tr', 'name_ru', 'phone', 'address', 'wifi_password',
    'default_lang', 'currency', 'currency_symbol', 'price_decimals', 'map_link',
    'logo_url', 'cover_url', 'brand_color', 'working_hours',
    'show_contact_modal', 'show_hours_modal', 'notify_email',
    'use_images', 'similar_layout', 'welcome_text',
  ]), [])
  const missingCols = useMemo(() => restaurant ? desiredKeys.filter(k => !(k in restaurant)) : [], [restaurant, desiredKeys])

  async function uploadImage(file, field) {
    const setter = field === 'logo_url' ? setLogoUp : setCoverUp
    setter(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.restaurant_id}/${field}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
    if (error) { alert('Yükleme hatası: ' + error.message); setter(false); return }
    const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(path)
    set(field, publicUrl); setter(false)
  }

  async function save() {
    if (!restaurant) return
    setSaving(true); setMsg('')
    const payload = {}
    desiredKeys.forEach(k => { if (k in restaurant && form[k] !== undefined) payload[k] = form[k] })
    const { error } = await supabase.from('restaurants').update(payload).eq('id', profile.restaurant_id)
    setSaving(false)
    setMsg(error ? '❌ ' + error.message : '✅ Kaydedildi!')
    setTimeout(() => setMsg(''), 3000)
  }

  // ⌘S / Ctrl+S
  useEffect(() => {
    const h = e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, restaurant])

  if (!restaurant) return <div style={{ textAlign: 'center', padding: 64, color: '#aaa' }}>Yükleniyor...</div>

  const TABS = [['info', 'Bilgi & Davranış', InfoIcon], ['design', 'Tasarım', BrushIcon], ['home', 'Menü Anasayfası', GridIcon]]

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 80 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>Ayarlar</h1>

      {/* sekmeler */}
      <div style={{ display: 'inline-flex', gap: 4, background: '#f4f4f2', borderRadius: 12, padding: 4, marginBottom: 22 }}>
        {TABS.map(([k, lbl, Ic]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: tab === k ? '#fff' : 'transparent', color: tab === k ? GREEN : '#888', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
            <Ic active={tab === k} /> {lbl}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        {/* SOL: form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'info' && <InfoTab form={form} set={set} restaurant={restaurant} />}
          {tab === 'design' && <DesignTab form={form} set={set} restaurant={restaurant} uploadImage={uploadImage} logoUp={logoUp} coverUp={coverUp} />}
          {tab === 'home' && <HomeTab form={form} set={set} restaurant={restaurant} uploadImage={uploadImage} coverUp={coverUp} />}

          {missingCols.length > 0 && (
            <p style={{ fontSize: 11.5, color: '#bbb', lineHeight: 1.6 }}>
              <b>Not (reis):</b> Şu alanlar UI'da var ama <code>restaurants</code> tablosunda kolonu olmadığı için kaydedilmez:
              {' '}<code>{missingCols.join(', ')}</code>. Kolon ekleyince otomatik kalıcı olur.
            </p>
          )}
        </div>

        {/* SAĞ: canlı önizleme */}
        <div style={{ position: 'sticky', top: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12, textAlign: 'center' }}>Canlı Ön-İzleme</p>
          <PhonePreview form={form} />
          <p style={{ fontSize: 10.5, color: '#bbb', textAlign: 'center', marginTop: 10 }}>Form alanları değiştikçe önizleme güncellenir.</p>
        </div>
      </div>

      {/* sticky kaydet çubuğu */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: `1px solid ${BORDER}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, zIndex: 40, boxShadow: '0 -2px 12px rgba(0,0,0,.04)' }}>
        {msg
          ? <span style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✅') ? GREEN : '#dc2626' }}>{msg}</span>
          : <span style={{ fontSize: 12, color: '#aaa' }}>Değişiklikler kaydet ile uygulanır. <kbd style={{ background: '#f0f0ee', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>⌘S</kbd> ile kaydet</span>}
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 26px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
          <SaveIcon /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}

/* ════════ Bilgi & Davranış ════════ */
function InfoTab({ form, set }) {
  const sym = form.currency_symbol || CUR_SYM[form.currency] || '₾'
  const dec = Number(form.price_decimals ?? 2)
  const fmt = d => (1200).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }) + sym

  return (
    <>
      <Card title="İşletme Bilgileri">
        <Label>İşletme Adı</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {LANGS.map(([l, lbl]) => (
            <div key={l}>
              <span style={{ fontSize: 11, color: '#aaa' }}>{lbl}</span>
              <input value={form[`name_${l}`] || ''} onChange={e => set(`name_${l}`, e.target.value)} style={inp} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div><Label>Para Birimi Sembolü</Label><input value={sym} onChange={e => set('currency_symbol', e.target.value)} style={inp} /></div>
          <div>
            <Label>Para Birimi Kodu</Label>
            <select value={form.currency || 'GEL'} onChange={e => set('currency', e.target.value)} style={inp}>
              <option value="GEL">GEL</option><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <Label>Fiyat Ondalık Hanesi</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[0, 1, 2].map(d => (
            <button key={d} onClick={() => set('price_decimals', d)}
              style={{ padding: '12px 8px', borderRadius: 10, border: `1.5px solid ${dec === d ? GREEN : BORDER}`, background: dec === d ? GREEN_BG : '#fff', cursor: 'pointer', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>{d} hane</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: dec === d ? GREEN : '#333' }}>{fmt(d)}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card title="İletişim & Adres">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div><Label>Telefon</Label><input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+995 555 000 000" style={inp} /></div>
          <div><Label>Harita Linki</Label><input value={form.map_link || ''} onChange={e => set('map_link', e.target.value)} placeholder="https://maps.google.com/..." style={inp} /></div>
        </div>
        <Label>Adres</Label>
        <textarea value={form.address || ''} onChange={e => set('address', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <ToggleRow label="İletişim bilgilerini modalda göster" on={!!form.show_contact_modal} onClick={() => set('show_contact_modal', !form.show_contact_modal)} />
          <ToggleRow label="Çalışma saatlerini modalda göster" on={!!form.show_hours_modal} onClick={() => set('show_hours_modal', !form.show_hours_modal)} />
        </div>
      </Card>

      <WorkingHours form={form} set={set} />

      <Card title="E-posta Bildirimleri">
        <Label>Bildirim E-postası</Label>
        <input value={form.notify_email || ''} onChange={e => set('notify_email', e.target.value)} placeholder="info@magidaqr.ge" style={inp} />
        <p style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Anket yanıtları bu adrese gönderilir.</p>
      </Card>

      <Card title="Ürün Listeleme Görünümü">
        <ToggleRow label="Görsel kullan" sub="Kapatınca görsel slotu kaldırılır — minimal menü için ideal." on={form.use_images ?? true} onClick={() => set('use_images', !(form.use_images ?? true))} box />
        <Label style={{ marginTop: 16 }}>Benzer Ürünler Düzeni</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['carousel', 'Carousel', 'Yatay kaydırılan kart şeridi'], ['list', 'Liste', 'Alt alta sıralı satır görünümü']].map(([v, t, d]) => {
            const on = (form.similar_layout || 'carousel') === v
            return (
              <button key={v} onClick={() => set('similar_layout', v)}
                style={{ padding: '14px', borderRadius: 12, border: `1.5px solid ${on ? GREEN : BORDER}`, background: on ? GREEN_BG : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: on ? GREEN : '#333' }}>{t}</p>
                <p style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{d}</p>
              </button>
            )
          })}
        </div>
      </Card>
    </>
  )
}

/* çalışma saatleri */
function WorkingHours({ form, set }) {
  const rows = Array.isArray(form.working_hours) ? form.working_hours : []
  const update = next => set('working_hours', next)
  const addRow = () => update([...rows, { time: '09:00 - 22:00', labels: { tr: '', en: '' } }])
  const setRow = (i, patch) => update(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const setLbl = (i, l, v) => update(rows.map((r, idx) => idx === i ? { ...r, labels: { ...(r.labels || {}), [l]: v } } : r))
  const del = i => update(rows.filter((_, idx) => idx !== i))

  return (
    <Card title="Çalışma Saatleri" subtitle="Saat dilden bağımsız ortaktır; gün etiketini her dile özel girebilirsin.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, width: 36 }}>Saat</span>
              <input value={r.time || ''} onChange={e => setRow(i, { time: e.target.value })} placeholder="08:00 - 24:00" style={{ ...inp, flex: 1, fontFamily: 'monospace' }} />
              <button onClick={() => del(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 18 }}>✕</button>
            </div>
            {[['tr', 'TR'], ['en', 'GB']].map(([l, flag]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#bbb', width: 36, textAlign: 'right' }}>{flag}</span>
                <input value={r.labels?.[l] || ''} onChange={e => setLbl(i, l, e.target.value)} placeholder={l === 'tr' ? 'Pazartesi-Cuma' : 'Monday-Friday'} style={{ ...inp, flex: 1 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <button onClick={addRow} style={{ marginTop: 12, background: 'none', border: 'none', color: GREEN, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Saat satırı ekle</button>
    </Card>
  )
}

/* ════════ Tasarım ════════ */
function DesignTab({ form, set, uploadImage, logoUp, coverUp }) {
  return (
    <>
      <Card title="Logo">
        {form.logo_url && <img src={form.logo_url} alt="logo" style={{ width: 80, height: 80, borderRadius: 14, objectFit: 'cover', marginBottom: 12, border: `1px solid ${BORDER}` }} />}
        <UploadBtn busy={logoUp} text="Logo yükle (PNG/JPG)" onFile={f => uploadImage(f, 'logo_url')} />
        <div style={{ marginTop: 10 }}><Label>veya URL</Label><input value={form.logo_url || ''} onChange={e => set('logo_url', e.target.value)} style={inp} /></div>
      </Card>

      <Card title="Kapak Görseli">
        {form.cover_url && <img src={form.cover_url} alt="cover" style={{ width: '100%', height: 110, borderRadius: 12, objectFit: 'cover', marginBottom: 12, border: `1px solid ${BORDER}` }} />}
        <UploadBtn busy={coverUp} text="Kapak yükle (1200×400 önerilir)" onFile={f => uploadImage(f, 'cover_url')} />
        <div style={{ marginTop: 10 }}><Label>veya URL</Label><input value={form.cover_url || ''} onChange={e => set('cover_url', e.target.value)} style={inp} /></div>
      </Card>

      <Card title="Marka & Dil">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Marka Rengi</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '7px 10px' }}>
              <input type="color" value={form.brand_color || GREEN} onChange={e => set('brand_color', e.target.value)} style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#555' }}>{form.brand_color || GREEN}</span>
            </div>
          </div>
          <div>
            <Label>Varsayılan Dil</Label>
            <select value={form.default_lang || 'ka'} onChange={e => set('default_lang', e.target.value)} style={inp}>
              {LANGS.map(([l, lbl]) => <option key={l} value={l}>{lbl}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Label>WiFi Şifresi</Label><input value={form.wifi_password || ''} onChange={e => set('wifi_password', e.target.value)} placeholder="wifi123" style={inp} /></div>
      </Card>

      <Card title="Hesap Güvenliği">
        <PasswordChange />
      </Card>
    </>
  )
}

/* ════════ Menü Anasayfası ════════ */
function HomeTab({ form, set, uploadImage, coverUp }) {
  return (
    <>
      <Card title="Karşılama" subtitle="Menü açılış ekranında görünen kapak ve metin.">
        {form.cover_url && <img src={form.cover_url} alt="" style={{ width: '100%', height: 120, borderRadius: 12, objectFit: 'cover', marginBottom: 12, border: `1px solid ${BORDER}` }} />}
        <UploadBtn busy={coverUp} text="Kapak görseli yükle" onFile={f => uploadImage(f, 'cover_url')} />
        <div style={{ marginTop: 12 }}><Label>Karşılama Metni</Label>
          <textarea value={form.welcome_text || ''} onChange={e => set('welcome_text', e.target.value)} rows={2} placeholder="Hoş geldiniz! Menümüzü keşfedin..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
      </Card>

      <Card title="İlgili Sayfalar" subtitle="Anasayfa içeriğinin büyük kısmı ayrı sayfalardan yönetilir.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LinkRow to="/admin/hero-cards" label="Ana Sayfa Kartları" desc="Menü girişindeki tanıtım kartları" />
          <LinkRow to="/admin/info-pages" label="Bilgi Sayfaları" desc="Hakkımızda, KVKK, vb." />
          <LinkRow to="/admin/languages" label="Diller & Çeviriler" desc="Arayüz metinleri" />
        </div>
      </Card>
    </>
  )
}

/* ════════ Canlı telefon önizleme ════════ */
function PhonePreview({ form }) {
  const lang = form.default_lang || 'ka'
  const name = form[`name_${lang}`] || form.name_tr || form.name_en || 'Restoran'
  const brand = form.brand_color || GREEN
  const cats = ['Yiyecekler', 'İçecekler', 'Alkoller', 'Tatlılar']
  return (
    <div style={{ width: '100%', maxWidth: 280, margin: '0 auto', border: '8px solid #111', borderRadius: 32, overflow: 'hidden', background: '#000', boxShadow: '0 16px 40px rgba(0,0,0,.2)' }}>
      <div style={{ position: 'relative', height: 150, background: form.cover_url ? `url(${form.cover_url}) center/cover` : 'linear-gradient(135deg,#2a2a2a,#444)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(0,0,0,.1),rgba(0,0,0,.65))' }} />
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center' }}>
          {form.logo_url
            ? <img src={form.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', marginBottom: 6 }} />
            : <div style={{ width: 52, height: 52, borderRadius: '50%', background: brand, border: '2px solid #fff', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>{name[0]}</div>}
          <p style={{ color: '#fff', fontSize: 14, fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{name}</p>
        </div>
      </div>
      <div style={{ background: '#f7f7f5', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {cats.map((c, i) => (
            <div key={i} style={{ height: 56, borderRadius: 10, background: '#fff', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#555' }}>{c}</div>
          ))}
        </div>
        <div style={{ marginTop: 10, height: 32, borderRadius: 10, background: brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>MENÜ</div>
      </div>
    </div>
  )
}

/* ── şifre değiştir ── */
function PasswordChange() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  async function change() {
    if (pw.length < 6) { setMsg('Min 6 karakter'); return }
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? '❌ ' + error.message : '✅ Şifre güncellendi'); setPw('')
    setTimeout(() => setMsg(''), 3000)
  }
  return (
    <div>
      <Label>Yeni Şifre</Label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••" style={{ ...inp, flex: 1 }} />
        <button onClick={change} style={{ padding: '0 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Güncelle</button>
      </div>
      {msg && <p style={{ fontSize: 12, marginTop: 6, color: msg.startsWith('✅') ? GREEN : '#dc2626' }}>{msg}</p>}
    </div>
  )
}

/* ── küçük bileşenler & stiller ── */
function Card({ title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: subtitle ? 4 : 16 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{subtitle}</p>}
      {children}
    </div>
  )
}
function Label({ children, style }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, ...style }}>{children}</label>
}
function ToggleRow({ label, sub, on, onClick, box }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', border: box ? `1.5px solid ${on ? GREEN : BORDER}` : `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', background: box && on ? GREEN_BG : '#fff' }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{sub}</p>}
      </div>
      <span style={{ width: 40, height: 23, borderRadius: 12, background: on ? GREEN : '#d8d8d4', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 2.5, left: on ? 19 : 2.5, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
      </span>
    </div>
  )
}
function UploadBtn({ busy, text, onFile }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: `1.5px dashed ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#666', cursor: 'pointer', background: '#fafafa' }}>
      {busy ? '⏳ Yükleniyor...' : `📁 ${text}`}
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
    </label>
  )
}
function LinkRow({ to, label, desc }) {
  return (
    <Link to={to} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, textDecoration: 'none', background: '#fff' }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{label}</p>
        <p style={{ fontSize: 11, color: '#999' }}>{desc}</p>
      </div>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
    </Link>
  )
}
const inp = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box', background: '#fff', marginTop: 4 }

function InfoIcon({ active }) { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={active ? GREEN : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg> }
function BrushIcon({ active }) { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={active ? GREEN : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" /><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" /></svg> }
function GridIcon({ active }) { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={active ? GREEN : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> }
function SaveIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg> }
