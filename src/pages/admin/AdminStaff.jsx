import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const ROLE_LABELS = { kitchen:'👨‍🍳 Mutfak', waiter:'🛎 Garson', admin:'⚙️ Admin' }
const ROLE_COLORS = { kitchen:'#534AB7', waiter:'#1D9E75', admin:'#E24B4A' }

export default function AdminStaff() {
  const { profile } = useAuth()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email:'', password:'', full_name:'', role:'waiter' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { if (profile?.restaurant_id) loadStaff() }, [profile?.restaurant_id])

  async function loadStaff() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('restaurant_id', profile.restaurant_id)
      .neq('role', 'super_admin')
      .order('created_at')
    setStaff(data || [])
    setLoading(false)
  }

  async function addStaff() {
    if (!form.email || !form.password || !form.full_name) {
      setMsg('❌ Tüm alanları doldurun'); return
    }
    setSaving(true)
    setMsg('')

    // Supabase Admin API ile kullanıcı oluştur
    // Not: Bu işlem için service_role key gerekir — şimdilik SQL ile yapıyoruz
    const { data: { user }, error: authError } = await supabase.auth.admin?.createUser({
      email: form.email, password: form.password, email_confirm: true
    })

    if (authError || !user) {
      // Fallback: kullanıcıya kayıt linki gönder
      setMsg('⚠️ Kullanıcı oluşturmak için SQL Editor\'dan ekleyin (aşağıya bakın)')
      setSaving(false)
      return
    }

    await supabase.from('profiles').insert({
      id: user.id, tenant_id: profile.tenant_id,
      restaurant_id: profile.restaurant_id,
      full_name: form.full_name, role: form.role
    })

    setMsg('✅ Personel eklendi!')
    setForm({ email:'', password:'', full_name:'', role:'waiter' })
    setShowForm(false)
    loadStaff()
    setSaving(false)
  }

  async function removeStaff(id) {
    if (!confirm('Bu personeli kaldır?')) return
    await supabase.from('profiles').delete().eq('id', id)
    loadStaff()
  }

  // SQL ile personel ekleme talimatı
  const sqlInstructions = (email, password, name, role) => `
-- 1. Supabase Dashboard → Authentication → Users → Add user
-- Email: ${email || 'personel@email.com'}
-- Password: ${password || 'sifre123'}
-- Auto confirm: ✓

-- 2. Kullanıcı ID'sini kopyala, sonra SQL Editor'da çalıştır:
INSERT INTO profiles (id, tenant_id, restaurant_id, full_name, role)
VALUES (
  'BURAYA_USER_ID',
  '${profile?.tenant_id || ''}',
  '${profile?.restaurant_id || ''}',
  '${name || 'Personel Adı'}',
  '${role || 'waiter'}'
);`

  if (loading) return <div className="page-loading">Yükleniyor...</div>

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">👥 Personel Yönetimi</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ İptal' : '+ Personel ekle'}
        </button>
      </div>

      {/* Personel ekleme formu */}
      {showForm && (
        <div className="settings-section" style={{ maxWidth:500, marginBottom:24 }}>
          <h3 className="settings-section-title">Yeni personel</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Ad Soyad</label>
              <input value={form.full_name} onChange={e => setForm(p=>({...p,full_name:e.target.value}))} placeholder="Giorgi Beridze" />
            </div>
            <div className="form-group">
              <label>Rol</label>
              <select value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                <option value="waiter">🛎 Garson</option>
                <option value="kitchen">👨‍🍳 Mutfak</option>
                <option value="admin">⚙️ Admin</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>E-posta</label>
              <input type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="garson@restoran.ge" />
            </div>
            <div className="form-group">
              <label>Şifre</label>
              <input type="text" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="min 6 karakter" />
            </div>
          </div>

          {msg && <p style={{ fontSize:13, color: msg.startsWith('✅') ? '#1D9E75' : '#BA7517', marginBottom:10 }}>{msg}</p>}

          {/* Manuel SQL talimatı */}
          <details style={{ marginBottom:14 }}>
            <summary style={{ fontSize:12, color:'#888', cursor:'pointer' }}>Manuel ekleme talimatı (SQL)</summary>
            <pre style={{ background:'#1a1a1a', color:'#a8ff78', padding:12, borderRadius:8, fontSize:11, marginTop:8, overflow:'auto' }}>
              {sqlInstructions(form.email, form.password, form.full_name, form.role)}
            </pre>
          </details>

          <button className="btn-primary" onClick={addStaff} disabled={saving}>
            {saving ? '⏳ Ekleniyor...' : '+ Ekle'}
          </button>
        </div>
      )}

      {/* Mevcut personel listesi */}
      <div className="menu-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Rol</th>
              <th>Giriş URL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign:'center', color:'#aaa', padding:32 }}>Henüz personel yok</td></tr>
            ) : staff.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%',
                      background: ROLE_COLORS[s.role] + '20',
                      color: ROLE_COLORS[s.role],
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:13 }}>
                      {s.full_name?.[0] || '?'}
                    </div>
                    <span style={{ fontWeight:500 }}>{s.full_name || '—'}</span>
                  </div>
                </td>
                <td>
                  <span style={{ background: ROLE_COLORS[s.role] + '15', color: ROLE_COLORS[s.role],
                    padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>
                    {ROLE_LABELS[s.role] || s.role}
                  </span>
                </td>
                <td style={{ fontSize:12, color:'#888' }}>
                  {s.role === 'kitchen' ? '/kitchen' : s.role === 'waiter' ? '/waiter' : '/admin'}
                </td>
                <td>
                  {s.id !== profile?.id && (
                    <button className="icon-btn danger" onClick={() => removeStaff(s.id)}>🗑️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bilgi kutusu */}
      <div style={{ marginTop:20, background:'#E1F5EE', border:'1px solid #1D9E75', borderRadius:10, padding:14, maxWidth:600 }}>
        <p style={{ fontSize:13, color:'#0F6E56', margin:0, lineHeight:1.6 }}>
          <strong>💡 Personel giriş adresleri:</strong><br/>
          🛎 Garson: <code>{origin}/waiter</code><br/>
          👨‍🍳 Mutfak: <code>{origin}/kitchen</code><br/>
          ⚙️ Admin: <code>{origin}/admin</code>
        </p>
      </div>
    </div>
  )
}
