import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PLANS, AI_ADDON } from '../../lib/plans'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function SuperDashboard() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', plan:'basic', slug:'', ai_addon:false })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name }

  useEffect(() => { loadTenants() }, [])

  async function loadTenants() {
    const { data } = await supabase
      .from('tenants')
      .select('*, restaurants(id, name_en, name_ka, slug)')
      .order('created_at', { ascending: false })
    setTenants(data || [])
    setLoading(false)
  }

  function handleNameChange(e) {
    const name = e.target.value
    const autoSlug = name.toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setForm(p => ({ ...p, name, slug: autoSlug }))
  }

  async function addTenant() {
    const slug = form.slug.trim()
    const name = form.name.trim()
    const email = form.email.trim()
    if (!name) return setMsg('❌ Firma adı zorunlu')
    if (!slug) return setMsg('❌ Slug zorunlu')

    setSaving(true); setMsg('')
    try {
      const { data: tenant, error: te } = await supabase
        .from('tenants')
        .insert({ name, plan: form.plan, slug, is_active: true, ai_addon: form.ai_addon,
          plan_expires_at: new Date(Date.now() + 14*24*60*60*1000).toISOString() })
        .select().single()
      if (te) throw te

      const { data: rest, error: re } = await supabase
        .from('restaurants')
        .insert({ tenant_id: tenant.id, name_en: name, name_ka: name, slug, is_active: true })
        .select().single()
      if (re) throw re

      if (email) {
        const defaultPassword = slug + '2024!'
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ email, password: defaultPassword, full_name: name + ' Admin', role: 'admin', tenant_id: tenant.id, restaurant_id: rest.id }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error('Kullanıcı oluşturulamadı: ' + result.error)
        setMsg(`✅ Firma eklendi! Giriş: ${email} / ${defaultPassword}`)

        // Welcome email gönder
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              email,
              password: defaultPassword,
              firm_name: name,
              slug,
              plan: form.plan,
            }),
          })
        } catch(emailErr) {
          console.warn('Email gönderilemedi:', emailErr)
        }
      } else {
        setMsg('✅ Firma başarıyla eklendi!')
      }

      setForm({ name:'', email:'', plan:'basic', slug:'', ai_addon:false })
      setShowAdd(false)
      loadTenants()
    } catch(e) {
      setMsg('❌ Hata: ' + (e.message || JSON.stringify(e)))
    }
    setSaving(false)
  }

  async function deleteTenant(id) {
    setDeletingId(id)
    try {
      // Sırayla sil (cascade yoksa)
      const { data: rests } = await supabase.from('restaurants').select('id').eq('tenant_id', id)
      const restIds = (rests || []).map(r => r.id)

      if (restIds.length > 0) {
        // order_items → orders → menu_items → menu_categories → tables → restaurants
        const { data: orders } = await supabase.from('orders').select('id').in('restaurant_id', restIds)
        const orderIds = (orders || []).map(o => o.id)
        if (orderIds.length > 0) {
          await supabase.from('order_items').delete().in('order_id', orderIds)
          await supabase.from('orders').delete().in('id', orderIds)
        }
        await supabase.from('menu_items').delete().in('restaurant_id', restIds)
        await supabase.from('menu_categories').delete().in('restaurant_id', restIds)
        await supabase.from('tables').delete().in('restaurant_id', restIds)
        await supabase.from('restaurants').delete().in('id', restIds)
      }

      await supabase.from('tenants').delete().eq('id', id)
      setConfirmDelete(null)
      loadTenants()
    } catch(e) {
      setMsg('❌ Silinemedi: ' + (e.message || JSON.stringify(e)))
    }
    setDeletingId(null)
  }
  const planColor = { basic:'#1D9E75', advanced:'#8b5cf6', trial:'#f59e0b' }
  const planBg    = { basic:'#e8f5ee', advanced:'#f5f3ff', trial:'#fff8e8' }
  const planName  = { basic:'Temel', advanced:'Gelişmiş', trial:'Trial' }

  if (loading) return <div style={{textAlign:'center',padding:64,color:'#aaa'}}>Yükleniyor...</div>

  // ── İş metrikleri ──
  const now = Date.now()
  const active = tenants.filter(t => t.is_active)
  const basicCount = tenants.filter(t => t.plan === 'basic').length
  const advancedCount = tenants.filter(t => t.plan === 'advanced').length
  const aiCount = tenants.filter(t => t.ai_addon).length
  // Deneme: 14 günden az kalan + aktif
  const trialCount = active.filter(t => {
    if (!t.plan_expires_at) return false
    const d = Math.ceil((new Date(t.plan_expires_at) - now)/(864e5))
    return d >= 0 && d <= 14
  }).length
  // Süresi dolan
  const expiredCount = tenants.filter(t => {
    if (!t.plan_expires_at) return false
    return new Date(t.plan_expires_at) < now
  }).length
  // Yıllık gelir (aktif abonelikler)
  let annualRevenue = 0
  active.forEach(t => {
    annualRevenue += (t.plan === 'advanced' ? PLANS.advanced.price : PLANS.basic.price)
    if (t.ai_addon) annualRevenue += AI_ADDON.price
  })
  // Bu ay yeni
  const monthAgo = now - 30*864e5
  const newThisMonth = tenants.filter(t => new Date(t.created_at).getTime() > monthAgo).length
  const prevMonthStart = now - 60*864e5
  const newPrevMonth = tenants.filter(t => {
    const c = new Date(t.created_at).getTime()
    return c > prevMonthStart && c <= monthAgo
  }).length
  const newTrend = newPrevMonth ? Math.round((newThisMonth-newPrevMonth)/newPrevMonth*100) : (newThisMonth>0?100:0)

  // Son 6 ay yeni kayıt grafiği
  const growthData = []
  for (let i=5;i>=0;i--){
    const d = new Date(); d.setMonth(d.getMonth()-i); d.setDate(1); d.setHours(0,0,0,0)
    const d2 = new Date(d); d2.setMonth(d2.getMonth()+1)
    const mo = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]
    const count = tenants.filter(t => {
      const c = new Date(t.created_at).getTime()
      return c >= d.getTime() && c < d2.getTime()
    }).length
    growthData.push({ month: mo, firma: count })
  }

  return (
    <div style={{maxWidth:1000,margin:'0 auto'}}>

      {/* ── Silme Onay Modal ── */}
      {confirmDelete && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:16,padding:32,maxWidth:400,width:'90%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:32,marginBottom:12}}>🗑️</div>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:8}}>Firmayı Sil</h3>
            <p style={{fontSize:13,color:'#666',marginBottom:20}}>
              <strong>"{confirmDelete.name}"</strong> firması ve tüm verileri (menü, siparişler, masalar) <strong>kalıcı olarak silinecek.</strong> Bu işlem geri alınamaz.
            </p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setConfirmDelete(null)}
                style={{flex:1,padding:'10px',border:'1.5px solid #e8e8e4',background:'#fff',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                İptal
              </button>
              <button onClick={() => deleteTenant(confirmDelete.id)} disabled={!!deletingId}
                style={{flex:1,padding:'10px',background:'#ef4444',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:deletingId?'wait':'pointer',opacity:deletingId?0.7:1}}>
                {deletingId ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Firma Yönetimi</h1>
          <p style={{fontSize:13,color:'#aaa'}}>{tenants.length} kayıtlı firma</p>
        </div>
        <button onClick={()=>{setShowAdd(true);setMsg('')}}
          style={{background:'#1D9E75',color:'#fff',border:'none',padding:'10px 20px',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>
          + Firma Ekle
        </button>
      </div>

      {/* ── Gelir banner ── */}
      <div style={{background:'linear-gradient(135deg,#0d5e48,#1D9E75,#2db88a)',borderRadius:16,padding:'24px 28px',marginBottom:16,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',right:-30,top:-30,width:200,height:200,borderRadius:'50%',background:'rgba(255,255,255,.05)'}}/>
        <p style={{fontSize:11,color:'rgba(255,255,255,.65)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>Tahmini Yıllık Gelir (ARR)</p>
        <h1 style={{fontSize:34,fontWeight:900,color:'#fff',marginBottom:4}}>{annualRevenue.toLocaleString('tr-TR')} ₾</h1>
        <p style={{fontSize:13,color:'rgba(255,255,255,.8)'}}>{active.length} aktif abonelik · aylık ≈ {Math.round(annualRevenue/12).toLocaleString('tr-TR')} ₾</p>
      </div>

      {/* ── KPI kartları ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
        <SuperKPI label="TOPLAM FİRMA" val={tenants.length} sub={`${active.length} aktif`} color="#1D9E75"/>
        <SuperKPI label="BU AY YENİ" val={newThisMonth} trend={newTrend} sub="son 30 gün" color="#3b82f6"/>
        <SuperKPI label="DENEMEDE" val={trialCount} sub="≤14 gün kalan" color="#f59e0b"/>
        <SuperKPI label="SÜRESİ DOLAN" val={expiredCount} sub="yenileme bekliyor" color="#ef4444"/>
      </div>

      {/* ── Paket dağılımı + Büyüme grafiği ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.3fr',gap:16,marginBottom:24}}>
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:16}}>Paket Dağılımı</h3>
          <SuperPlanRow label="Temel" count={basicCount} total={tenants.length} color="#1D9E75"/>
          <SuperPlanRow label="Gelişmiş" count={advancedCount} total={tenants.length} color="#8b5cf6"/>
          <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #f0f0ee',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,color:'#666'}}>✨ AI eklentili</span>
            <span style={{fontSize:14,fontWeight:700,color:'#8b5cf6'}}>{aiCount} firma</span>
          </div>
        </div>
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:4}}>Firma Büyümesi</h3>
          <p style={{fontSize:12,color:'#aaa',marginBottom:12}}>Son 6 ay yeni kayıt</p>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={growthData} margin={{top:0,right:0,left:-25,bottom:0}}>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}/>
              </linearGradient></defs>
              <XAxis dataKey="month" tick={{fontSize:10,fill:'#bbb'}} tickLine={false} axisLine={false}/>
              <YAxis tick={{fontSize:10,fill:'#bbb'}} tickLine={false} axisLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{border:'1px solid #e8e8e4',borderRadius:8,fontSize:12}}/>
              <Area type="monotone" dataKey="firma" stroke="#1D9E75" strokeWidth={2} fill="url(#sg)" dot={{r:3,fill:'#1D9E75'}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {msg && (
        <div style={{background:msg.startsWith('✅')?'#e8f5ee':'#fef2f2',border:`1px solid ${msg.startsWith('✅')?'#1D9E75':'#ef4444'}`,borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:msg.startsWith('✅')?'#0F6E56':'#b91c1c'}}>
          {msg}
        </div>
      )}

      {/* Modal */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
          <div style={{background:'#fff',borderRadius:16,padding:32,width:440,boxShadow:'0 24px 64px rgba(0,0,0,.18)'}}>
            <h2 style={{fontSize:18,fontWeight:800,marginBottom:20}}>Yeni Firma Ekle</h2>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>Firma Adı *</label>
              <input type="text" value={form.name} onChange={handleNameChange}
                placeholder="Örn: Aurora Restaurant"
                style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e8e8e4',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit'}}
                onFocus={e=>e.target.style.borderColor='#1D9E75'} onBlur={e=>e.target.style.borderColor='#e8e8e4'}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>Slug (URL) *</label>
              <input type="text" value={form.slug} onChange={e=>setForm(p=>({...p,slug:e.target.value}))}
                placeholder="aurora-restaurant"
                style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e8e8e4',borderRadius:8,fontSize:13,outline:'none',fontFamily:'monospace'}}
                onFocus={e=>e.target.style.borderColor='#1D9E75'} onBlur={e=>e.target.style.borderColor='#e8e8e4'}/>
              <p style={{fontSize:10,color:'#aaa',marginTop:4}}>menü URL: /menu/{form.slug || '...'}</p>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>E-posta</label>
              <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}
                placeholder="admin@firma.com"
                style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e8e8e4',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit'}}
                onFocus={e=>e.target.style.borderColor='#1D9E75'} onBlur={e=>e.target.style.borderColor='#e8e8e4'}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>Paket</label>
              <select value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e8e8e4',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',background:'#fff'}}>
                <option value="basic">{PLANS.basic.name} — {PLANS.basic.price} {PLANS.basic.currency}/{PLANS.basic.period}</option>
                <option value="advanced">{PLANS.advanced.name} — {PLANS.advanced.price} {PLANS.advanced.currency}/{PLANS.advanced.period}</option>
              </select>
              <p style={{fontSize:10,color:'#aaa',marginTop:4}}>
                {form.plan==='basic' ? PLANS.basic.tagline : PLANS.advanced.tagline}
              </p>
            </div>

            <div style={{marginBottom:20,padding:'12px 14px',background:form.ai_addon?'#f5f3ff':'#f9f9f7',borderRadius:10,border:`1px solid ${form.ai_addon?'#ddd6fe':'#eee'}`}}>
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                <input type="checkbox" checked={form.ai_addon} onChange={e=>setForm(p=>({...p,ai_addon:e.target.checked}))}
                  style={{width:18,height:18,accentColor:'#8b5cf6',cursor:'pointer'}} />
                <span style={{flex:1}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#222'}}>✨ {AI_ADDON.name} eklentisi</span>
                  <span style={{fontSize:11,color:'#888',display:'block',marginTop:1}}>Satış analizi & akıllı öneriler</span>
                </span>
                <span style={{fontSize:13,fontWeight:700,color:'#8b5cf6'}}>+{AI_ADDON.price} {AI_ADDON.currency}/{AI_ADDON.period}</span>
              </label>
            </div>

            {/* Toplam */}
            <div style={{marginBottom:20,padding:'10px 14px',background:'#1D9E7510',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:13,fontWeight:600,color:'#0F6E56'}}>Yıllık Toplam</span>
              <span style={{fontSize:18,fontWeight:900,color:'#1D9E75'}}>
                {(form.plan==='basic'?PLANS.basic.price:PLANS.advanced.price) + (form.ai_addon?AI_ADDON.price:0)} ₾
              </span>
            </div>

            {msg && <p style={{fontSize:12,color:'#ef4444',marginBottom:12}}>{msg}</p>}

            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowAdd(false);setMsg('')}}
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

      {/* Tablo */}
      <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid #f0f0ee'}}>
              {['FİRMA','SLUG / URL','PAKET','DURUM','KAYIT',''].map(h=>(
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
                <tr key={t.id} style={{borderBottom:'1px solid #f9f9f7'}}
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
                    {rest?.slug ? (
                      <span style={{fontSize:12,color:'#1D9E75',fontFamily:'monospace',background:'#e8f5ee',padding:'3px 8px',borderRadius:6}}>
                        /{rest.slug}
                      </span>
                    ) : <span style={{fontSize:12,color:'#bbb'}}>—</span>}
                  </td>
                  <td style={{padding:'14px 16px'}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:11,fontWeight:700,color:planColor[t.plan]||'#aaa',background:planBg[t.plan]||'#f4f4f2',padding:'3px 10px',borderRadius:20}}>
                        {planName[t.plan]||t.plan||'Temel'}
                      </span>
                      {t.ai_addon && <span style={{fontSize:11}} title="AI Asistan">✨</span>}
                    </span>
                  </td>
                  <td style={{padding:'14px 16px'}}>
                    {(() => {
                      const exp = t.plan_expires_at ? new Date(t.plan_expires_at) : null
                      const daysLeft = exp ? Math.ceil((exp - Date.now())/(24*60*60*1000)) : null
                      const expired = daysLeft !== null && daysLeft < 0
                      if (!t.is_active) return (
                        <span style={{fontSize:11,fontWeight:700,color:'#ef4444',background:'#fef2f2',padding:'3px 10px',borderRadius:20}}>Pasif</span>
                      )
                      if (expired) return (
                        <span style={{fontSize:11,fontWeight:700,color:'#ef4444',background:'#fef2f2',padding:'3px 10px',borderRadius:20}} title={exp.toLocaleDateString('tr-TR')}>⏰ Süresi doldu</span>
                      )
                      if (daysLeft !== null && daysLeft <= 14) return (
                        <span style={{fontSize:11,fontWeight:700,color:'#f59e0b',background:'#fff8e8',padding:'3px 10px',borderRadius:20}} title={exp.toLocaleDateString('tr-TR')}>⏳ {daysLeft} gün</span>
                      )
                      return (
                        <span style={{fontSize:11,fontWeight:700,color:'#1D9E75',background:'#e8f5ee',padding:'3px 10px',borderRadius:20}} title={exp?exp.toLocaleDateString('tr-TR'):''}>Aktif</span>
                      )
                    })()}
                  </td>
                  <td style={{padding:'14px 16px',fontSize:12,color:'#aaa'}}>
                    {new Date(t.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td style={{padding:'14px 16px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={async()=>{
                          await supabase.from('tenants').update({ ai_addon: !t.ai_addon }).eq('id', t.id)
                          loadTenants()
                        }}
                        style={{fontSize:11,fontWeight:600,color:t.ai_addon?'#8b5cf6':'#aaa',
                          background:t.ai_addon?'#f5f3ff':'#f9f9f7',
                          border:`1px solid ${t.ai_addon?'#ddd6fe':'#eee'}`,
                          padding:'5px 10px',borderRadius:8,cursor:'pointer',whiteSpace:'nowrap'}}
                        title={t.ai_addon?'AI eklentisini kapat':'AI eklentisini aç'}>
                        ✨ AI {t.ai_addon?'✓':''}
                      </button>
                      <button onClick={async()=>{
                          const base = t.plan_expires_at && new Date(t.plan_expires_at) > new Date()
                            ? new Date(t.plan_expires_at) : new Date()
                          base.setFullYear(base.getFullYear() + 1)
                          await supabase.from('tenants').update({ plan_expires_at: base.toISOString(), is_active: true }).eq('id', t.id)
                          loadTenants()
                        }}
                        style={{fontSize:11,fontWeight:600,color:'#1D9E75',background:'#e8f5ee',border:'1px solid #bbf7d0',padding:'5px 10px',borderRadius:8,cursor:'pointer',whiteSpace:'nowrap'}}
                        title="Aboneliği 1 yıl uzat">+1 yıl</button>
                      <button onClick={async()=>{
                          await supabase.from('tenants').update({is_active:!t.is_active}).eq('id',t.id)
                          loadTenants()
                        }}
                        style={{fontSize:11,fontWeight:600,color:t.is_active?'#ef4444':'#1D9E75',background:'transparent',border:`1px solid ${t.is_active?'#fecaca':'#bbf7d0'}`,padding:'5px 12px',borderRadius:8,cursor:'pointer'}}>
                        {t.is_active ? 'Durdur' : 'Aktifleştir'}
                      </button>
                      <button onClick={() => setConfirmDelete({ id: t.id, name: t.name })}
                        style={{fontSize:11,fontWeight:600,color:'#ef4444',background:'transparent',border:'1px solid #fecaca',padding:'5px 10px',borderRadius:8,cursor:'pointer'}}
                        title="Firmayı kalıcı sil">
                        🗑
                      </button>
                    </div>
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

function SuperKPI({ label, val, trend, sub, color }) {
  return (
    <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <p style={{fontSize:10,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</p>
        {trend!==undefined && (
          <span style={{fontSize:10,fontWeight:700,color:trend>=0?'#1D9E75':'#ef4444',background:trend>=0?'#e8f5ee':'#fef2f2',padding:'2px 7px',borderRadius:20}}>
            {trend>=0?'↗':'↘'} %{Math.abs(trend)}
          </span>
        )}
      </div>
      <p style={{fontSize:26,fontWeight:900,color,lineHeight:1}}>{val}</p>
      <p style={{fontSize:11,color:'#bbb',marginTop:4}}>{sub}</p>
    </div>
  )
}

function SuperPlanRow({ label, count, total, color }) {
  const pct = total ? Math.round(count/total*100) : 0
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:13,color:'#444'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:700,color}}>{count} (%{pct})</span>
      </div>
      <div style={{height:8,background:'#f0f0ee',borderRadius:4,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:4}}/>
      </div>
    </div>
  )
}
