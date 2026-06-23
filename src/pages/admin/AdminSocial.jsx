import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const FIELDS = [
  { key:'instagram_url', label:'Instagram', icon:'📷', ph:'https://instagram.com/...' },
  { key:'facebook_url',  label:'Facebook',  icon:'👍', ph:'https://facebook.com/...' },
  { key:'tiktok_url',    label:'TikTok',    icon:'🎵', ph:'https://tiktok.com/@...' },
  { key:'website_url',   label:'Web Sitesi', icon:'🌐', ph:'https://...' },
  { key:'whatsapp_number', label:'WhatsApp', icon:'💬', ph:'+995 555 000 000' },
  { key:'wifi_password', label:'WiFi Şifresi', icon:'📶', ph:'Misafir WiFi şifresi' },
]

export default function AdminSocial() {
  const { profile } = useAuth()
  const [data, setData] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: r } = await supabase.from('restaurants')
      .select('instagram_url,facebook_url,tiktok_url,website_url,whatsapp_number,wifi_password')
      .eq('id', profile.restaurant_id).single()
    setData(r || {})
  }

  async function save() {
    await supabase.from('restaurants').update(data).eq('id', profile.restaurant_id)
    setSaved(true)
    setTimeout(()=>setSaved(false), 2000)
  }

  const set = (k,v) => setData(p=>({...p,[k]:v}))

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Sosyal Medya & İletişim</h1>
        <button className="btn-primary" onClick={save}>{saved?'✓ Kaydedildi':'Kaydet'}</button>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:20}}>Müşteri menüsünde gösterilecek bağlantılar.</p>

      <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:24,maxWidth:560}}>
        {FIELDS.map(field => (
          <div key={field.key} style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
            <span style={{fontSize:22,width:30,textAlign:'center'}}>{field.icon}</span>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{field.label}</label>
              <input value={data[field.key]||''} onChange={e=>set(field.key,e.target.value)} placeholder={field.ph}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
