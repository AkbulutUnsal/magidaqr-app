import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const ROLE_LABELS = { kitchen:'👨‍🍳 Mutfak', waiter:'🛎 Garson', admin:'⚙️ Admin' }
const ROLE_COLORS = { kitchen:'#534AB7', waiter:'#1D9E75', admin:'#E24B4A' }

async function createUser({ email, password, full_name, role, tenant_id, restaurant_id }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ email, password, full_name, role, tenant_id, restaurant_id }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Kullanıcı oluşturulamadı')
  return data
}

export default function AdminStaff() {
  const { profile } = useAuth()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email:'', password:'', full_name:'', role:'waiter' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [deletingId, setDeletingId] = useState(null)

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
    if (form.password.length < 6) {
      setMsg('❌ Şifre en az 6 karakter olmalı'); return
    }
    setSaving(true)
    setMsg('')
    try {
      await createUser({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        tenant_id: profile.tenant_id,
        restaurant_id: profile.restaurant_id,
      })
      setMsg('✅ Personel başarıyla eklendi!')
      setForm({ email:'', password:'', full_name:'', role:'waiter' })
      setShowForm(false)
      loadStaff()
    } catch(e) {
      setMsg('❌ ' + e.message)
    }
    setSaving(false)
  }

  async function removeStaff(id) {
    if (!confirm('Bu personeli kaldırmak istediğinizden emin misiniz?')) return
    setDeletingId(id)
    const { data: { session } } = await supabase.auth.getSession()
    // Sadece profiles'tan sil (auth user kalır ama giriş yapamaz)
    await supabase.from('profiles').delete().eq('id', id)
    setDeletingId(null)
    loadStaff()
  }

  if (loading) return <div className="page-loading">Yükleniyor...</div>

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Personel Yönetimi</h1>
          <p style={{fontSize:13,color:'#888',marginTop:4}}>Garson ve mutfak personelini buradan yönetin</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setMsg('') }}>
          {showForm ? '✕ İptal' : '+ Personel Ekle'}
        </button>
      </div>

      {/* Personel ekleme formu */}
      {showForm && (
        <div className="settings-section" style={{ maxWidth:520, marginBottom:24 }}>
          <h3 className="settings-section-title">Yeni Personel</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Ad Soyad *</label>
              <input
                value={form.full_name}
                onChange={e => setForm(p=>({...p,full_name:e.target.value}))}
                placeholder="Giorgi Beridze"
              />
            </div>
            <div className="form-group">
              <label>Rol *</label>
              <select value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                <option value="waiter">🛎 Garson</option>
                <option value="kitchen">👨‍🍳 Mutfak</option>
                <option value="admin">⚙️ Admin</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>E-posta *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p=>({...p,email:e.target.value}))}
                placeholder="garson@restoran.ge"
              />
            </div>
            <div className="form-group">
              <label>Şifre *</label>
              <input
                type="text"
                value={form.password}
                onChange={e => setForm(p=>({...p,password:e.target.value}))}
                placeholder="min. 6 karakter"
              />
            </div>
          </div>

          {msg && (
            <p style={{ fontSize:13, color: msg.startsWith('✅') ? '#1D9E75' : '#ef4444', marginBottom:12 }}>
              {msg}
            </p>
          )}

          <button className="btn-primary" onClick={addStaff} disabled={saving}>
            {saving ? '⏳ Ekleniyor...' : '+ Ekle'}
          </button>
        </div>
      )}

      {msg && !showForm && (
        <div style={{background:msg.startsWith('✅')?'#e8f5ee':'#fef2f2',border:`1px solid ${msg.startsWith('✅')?'#1D9E75':'#ef4444'}`,borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13}}>
          {msg}
        </div>
      )}

      {/* Personel listesi */}
      <div className="menu-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Personel</th>
              <th>Rol</th>
              <th>Giriş Adresi</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign:'center', color:'#aaa', padding:32 }}>
                  Henüz personel yok — yukarıdan ekleyin
                </td>
              </tr>
            ) : staff.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:36, height:36, borderRadius:'50%',
                      background: ROLE_COLORS[s.role] + '20',
                      color: ROLE_COLORS[s.role],
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:14, flexShrink:0
                    }}>
                      {s.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p style={{fontSize:13,fontWeight:600,margin:0}}>{s.full_name || '—'}</p>
                      <p style={{fontSize:11,color:'#aaa',margin:0}}>{s.id.slice(0,8)}...</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{
                    background: ROLE_COLORS[s.role] + '15',
                    color: ROLE_COLORS[s.role],
                    padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600
                  }}>
                    {ROLE_LABELS[s.role] || s.role}
                  </span>
                </td>
                <td style={{ fontSize:12, color:'#888', fontFamily:'monospace' }}>
                  {origin}{s.role === 'kitchen' ? '/kitchen' : s.role === 'waiter' ? '/waiter' : '/admin'}
                </td>
                <td>
                  <span style={{
                    fontSize:11, fontWeight:600,
                    color: s.is_active ? '#1D9E75' : '#ef4444',
                    background: s.is_active ? '#e8f5ee' : '#fef2f2',
                    padding:'3px 10px', borderRadius:20
                  }}>
                    {s.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td>
                  {s.id !== profile?.id && (
                    <button
                      onClick={() => removeStaff(s.id)}
                      disabled={deletingId === s.id}
                      style={{
                        fontSize:12, color:'#ef4444', background:'transparent',
                        border:'1px solid #fecaca', padding:'4px 10px',
                        borderRadius:8, cursor:'pointer'
                      }}>
                      {deletingId === s.id ? '...' : '🗑️ Kaldır'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Giriş bilgi kutusu */}
      <div style={{ marginTop:20, background:'#e8f5ee', border:'1px solid #1D9E75', borderRadius:10, padding:16, maxWidth:600 }}>
        <p style={{ fontSize:13, color:'#0F6E56', margin:0, lineHeight:1.8, fontWeight:500 }}>
          💡 <strong>Personel giriş adresleri:</strong>
        </p>
        <p style={{ fontSize:12, color:'#0F6E56', margin:'6px 0 0', lineHeight:2, fontFamily:'monospace' }}>
          🛎 Garson: <strong>{origin}/waiter</strong><br/>
          👨‍🍳 Mutfak: <strong>{origin}/kitchen</strong><br/>
          ⚙️ Admin: <strong>{origin}/admin</strong>
        </p>
      </div>
    </div>
  )
}
