import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SuperDashboard() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', plan:'starter', slug:'' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadTenants() }, [])

  async function loadTenants() {
    const { data } = await supabase
      .from('tenants')
      .select('*, restaurants(id, name_en, name_ka, slug)')
      .order('created_at', { ascending: false })
    setTenants(data || [])
    setLoading(false)
  }

  async function addTenant() {
    if (!form.name || !form.email || !form.slug) return setMsg('Tüm alanları doldurun')
    setSaving(true); setMsg('')
    try {
      // 1. Tenant oluştur
      const { data: tenant, error: te } = await supabase
        .from('tenants')
        .insert({ name: form.name, plan: form.plan, is_active: true })
        .select().single()
      if (te) throw te

      // 2. Restoran oluştur
      const { error: re } = await supabase
        .from('restaurants')
        .insert({ tenant_id: tenant.id, name_en: form.name, name_ka: form.name, slug: form.slug, is_active: true })
      if (re) throw re

      setMsg('✅ Firma başarıyla eklendi!')
      setForm({ name:'', email:'', plan:'starter', slug:'' })
      setShowAdd(false)
      loadTenants()
    } catch(e) {
      setMsg('❌ Hata: ' + (e.message || JSON.stringify(e)))
    }
    setSaving(false)
  }

  const planColor = { starter:'#3b82f6', pro:'#1D9E75', chain:'#8b5cf6' }
  const planBg    = { starter:'#eff6ff', pro:'#e8f5ee', chain:'#f5f3ff' }

  if (loading) return <div style={{textAlign:'center',padding:64,color:'#aaa'}}>Yükleniyor...</div>

  return (
    <div style={{maxWidth:1000,margin:'0 auto'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Firma Yönetimi</h1>
          <p style={{fontSize:13,color:'#aaa'}}>{tenants.length} kayıtlı firma</p>
        </div>
        <button onClick={()=>setShowAdd(true)}
          style={{background:'#1D9E75',color:'#fff',border:'none',padding:'10px 20px',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
          + Firma Ekle
        </button>
      </div>

      {msg && <div style={{background: msg.startsWith('✅')?'#e8f5ee':'#fef2f2', border:`1px solid ${msg.startsWith('✅')?'#1D9E75':'#ef4444'}`, borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color: msg.startsWith('✅')?'#0F6E56':'#b91c1c'}}>{msg}</div>}

      {/* Add tenant modal */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
          <div style={{background:'#fff',borderRadius:16,padding:32,width:440,boxShadow:'0 24px 64px rgba(0,0,0,.18)'}}>
            <h2 style={{fontSize:18,fontWeight:800,marginBottom:20}}>Yeni Firma Ekle</h2>
            {[
              {label:'Firma Adı',    key:'name',  placeholder:'Örn: Aurora Restaurant'},
              {label:'E-posta',      key:'email', placeholder:'admin@firma.com', type:'email'},
              {label:'Slug (URL)',   key:'slug',  placeholder:'aurora-restaurant'},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{f.label}</label>
                <input type={f.type||'text'} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e8e8e4',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit'}}
                  onFocus={e=>e.target.style.borderColor='#1D9E75'} onBlur={e=>e.target.style.borderColor='#e8e8e4'}/>
              </div>
            ))}
            <div style={{marginBottom:20}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>Paket</label>
              <select value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e8e8e4',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',background:'#fff'}}>
                <option value="starter">Starter — $29/ay</option>
                <option value="pro">Pro — $59/ay</option>
                <option value="chain">Chain — $129/ay</option>
              </select>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowAdd(false)}
                style={{flex:1,padding:'10px',border:'1.5px solid #e8e8e4',background:'#fff',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                İptal
              </button>
              <button onClick={addTenant} disabled={saving}
                style={{flex:1,padding:'10px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:saving?'wait':'pointer',opacity:saving?0.7:1}}>
                {saving ? 'Ekleniyor...' : 'Firma Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant table */}
      <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid #f0f0ee'}}>
              {['Firma','Slug / URL','Paket','Durum','Kayıt',''].map(h=>(
                <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 && (
              <tr><td colSpan={6} style={{padding:32,textAlign:'center',color:'#bbb',fontSize:13}}>Henüz firma yok</td></tr>
            )}
            {tenants.map(t => {
              const rest = t.restaurants?.[0]
              return (
                <tr key={t.id} style={{borderBottom:'1px solid #f9f9f7',transition:'background .1s'}}
                  onMouseOver={e=>e.currentTarget.style.background='#f9f9f7'}
                  onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'14px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:34,height:34,borderRadius:8,background:'#1D9E75',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0}}>
                        {t.name?.[0]?.toUpperCase()||'?'}
                      </div>
                      <div>
                        <p style={{fontSize:13,fontWeight:600}}>{t.name}</p>
                        <p style={{fontSize:11,color:'#aaa'}}>{t.id.slice(0,8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:'14px 16px'}}>
                    {rest ? (
                      <a href={`/menu/${rest.slug}`} target="_blank"
                        style={{fontSize:12,color:'#1D9E75',textDecoration:'none',fontFamily:'monospace',background:'#e8f5ee',padding:'3px 8px',borderRadius:6}}>
                        /{rest.slug}
                      </a>
                    ) : <span style={{fontSize:12,color:'#bbb'}}>—</span>}
                  </td>
                  <td style={{padding:'14px 16px'}}>
                    <span style={{fontSize:11,fontWeight:700,color:planColor[t.plan]||'#aaa',background:planBg[t.plan]||'#f4f4f2',padding:'3px 10px',borderRadius:20,textTransform:'capitalize'}}>
                      {t.plan||'starter'}
                    </span>
                  </td>
                  <td style={{padding:'14px 16px'}}>
                    <span style={{fontSize:11,fontWeight:700,color:t.is_active?'#1D9E75':'#ef4444',background:t.is_active?'#e8f5ee':'#fef2f2',padding:'3px 10px',borderRadius:20}}>
                      {t.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td style={{padding:'14px 16px',fontSize:12,color:'#aaa'}}>
                    {new Date(t.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td style={{padding:'14px 16px'}}>
                    <button
                      onClick={async () => {
                        await supabase.from('tenants').update({is_active:!t.is_active}).eq('id',t.id)
                        loadTenants()
                      }}
                      style={{fontSize:11,fontWeight:600,color:t.is_active?'#ef4444':'#1D9E75',background:'transparent',border:`1px solid ${t.is_active?'#fecaca':'#bbf7d0'}`,padding:'5px 12px',borderRadius:8,cursor:'pointer'}}>
                      {t.is_active ? 'Durdur' : 'Aktifleştir'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
