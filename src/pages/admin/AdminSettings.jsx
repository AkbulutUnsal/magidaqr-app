import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminSettings() {
  const { profile } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)

  useEffect(() => {
    if (!profile?.restaurant_id) return
    supabase.from('restaurants').select('*').eq('id', profile.restaurant_id).single()
      .then(({ data }) => { setRestaurant(data); setForm(data || {}) })
  }, [profile?.restaurant_id])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function uploadImage(file, field) {
    const setter = field === 'logo_url' ? setLogoUploading : setCoverUploading
    setter(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.restaurant_id}/${field}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
    if (error) { alert('Yükleme hatası: ' + error.message); setter(false); return }
    const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(path)
    set(field, publicUrl)
    setter(false)
  }

  async function save() {
    setSaving(true)
    setMsg('')
    const { error } = await supabase.from('restaurants').update({
      name_ka: form.name_ka, name_en: form.name_en, name_tr: form.name_tr, name_ru: form.name_ru,
      logo_url: form.logo_url, cover_url: form.cover_url,
      wifi_password: form.wifi_password, address: form.address, phone: form.phone,
      default_lang: form.default_lang, currency: form.currency,
    }).eq('id', profile.restaurant_id)
    setSaving(false)
    setMsg(error ? '❌ ' + error.message : '✅ Kaydedildi!')
    setTimeout(() => setMsg(''), 3000)
  }

  if (!restaurant) return <div className="page-loading">Yükleniyor...</div>

  return (
    <div className="admin-page">
      <h1 className="page-title">Restoran Ayarları</h1>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, maxWidth:900 }}>

        {/* Sol kolon */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Restoran isimleri */}
          <div className="settings-section">
            <h3 className="settings-section-title">🏷️ Restoran adı</h3>
            {[['ka','Gürcüce'],['en','İngilizce'],['tr','Türkçe'],['ru','Rusça']].map(([l, label]) => (
              <div key={l} className="form-group">
                <label>{label}</label>
                <input value={form[`name_${l}`] || ''} onChange={e => set(`name_${l}`, e.target.value)} placeholder={`İsim (${l.toUpperCase()})`} />
              </div>
            ))}
          </div>

          {/* İletişim */}
          <div className="settings-section">
            <h3 className="settings-section-title">📞 İletişim & Konum</h3>
            <div className="form-group">
              <label>Telefon</label>
              <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+995 555 000 000" />
            </div>
            <div className="form-group">
              <label>Adres</label>
              <input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Tbilisi, Rustaveli Ave 1" />
            </div>
            <div className="form-group">
              <label>WiFi şifresi</label>
              <input value={form.wifi_password || ''} onChange={e => set('wifi_password', e.target.value)} placeholder="wifi123" />
            </div>
          </div>

          {/* Ayarlar */}
          <div className="settings-section">
            <h3 className="settings-section-title">⚙️ Genel ayarlar</h3>
            <div className="form-group">
              <label>Varsayılan dil</label>
              <select value={form.default_lang || 'ka'} onChange={e => set('default_lang', e.target.value)}>
                <option value="ka">Gürcüce</option>
                <option value="en">İngilizce</option>
                <option value="tr">Türkçe</option>
                <option value="ru">Rusça</option>
              </select>
            </div>
            <div className="form-group">
              <label>Para birimi</label>
              <select value={form.currency || 'GEL'} onChange={e => set('currency', e.target.value)}>
                <option value="GEL">₾ GEL</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="TRY">₺ TRY</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sağ kolon */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Logo */}
          <div className="settings-section">
            <h3 className="settings-section-title">🖼️ Logo</h3>
            {form.logo_url && (
              <img src={form.logo_url} alt="logo"
                style={{ width:80, height:80, borderRadius:12, objectFit:'cover', marginBottom:10, border:'1px solid #eee' }} />
            )}
            <label className="upload-label">
              {logoUploading ? '⏳ Yükleniyor...' : '📁 Logo yükle (PNG/JPG)'}
              <input type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'logo_url')} />
            </label>
            {form.logo_url && (
              <div className="form-group" style={{ marginTop:8 }}>
                <label>veya URL gir</label>
                <input value={form.logo_url || ''} onChange={e => set('logo_url', e.target.value)} />
              </div>
            )}
          </div>

          {/* Cover */}
          <div className="settings-section">
            <h3 className="settings-section-title">🖼️ Kapak görseli</h3>
            {form.cover_url && (
              <img src={form.cover_url} alt="cover"
                style={{ width:'100%', height:100, borderRadius:10, objectFit:'cover', marginBottom:10, border:'1px solid #eee' }} />
            )}
            <label className="upload-label">
              {coverUploading ? '⏳ Yükleniyor...' : '📁 Kapak yükle (1200×400 önerilir)'}
              <input type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'cover_url')} />
            </label>
            <div className="form-group" style={{ marginTop:8 }}>
              <label>veya URL gir</label>
              <input value={form.cover_url || ''} onChange={e => set('cover_url', e.target.value)} />
            </div>
          </div>

          {/* Şifre değiştir */}
          <div className="settings-section">
            <h3 className="settings-section-title">🔒 Şifre değiştir</h3>
            <PasswordChange />
          </div>
        </div>
      </div>

      {/* Kaydet */}
      <div style={{ marginTop:24, display:'flex', alignItems:'center', gap:14 }}>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ padding:'11px 32px', fontSize:15 }}>
          {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
        </button>
        {msg && <span style={{ fontSize:14, color: msg.startsWith('✅') ? '#1D9E75' : '#E24B4A' }}>{msg}</span>}
      </div>
    </div>
  )
}

function PasswordChange() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')

  async function change() {
    if (pw.length < 6) { setMsg('Min 6 karakter'); return }
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? '❌ ' + error.message : '✅ Şifre güncellendi')
    setPw('')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{ display:'flex', gap:8 }}>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)}
        placeholder="Yeni şifre" style={{ flex:1 }} />
      <button className="btn-primary" onClick={change}>Güncelle</button>
      {msg && <p style={{ fontSize:12, color: msg.startsWith('✅') ? '#1D9E75' : '#E24B4A', marginTop:6 }}>{msg}</p>}
    </div>
  )
}
