import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PLANS, AI_ADDON } from '../../lib/plans'

export default function SuperStats() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: tenants } = await supabase.from('tenants').select('*')
    const { data: restaurants } = await supabase.from('restaurants').select('id')
    const { data: orders } = await supabase.from('orders').select('id,total_price,created_at')

    const t = tenants || []
    const active = t.filter(x => x.is_active)
    const basic = t.filter(x => x.plan === 'basic')
    const advanced = t.filter(x => x.plan === 'advanced')
    const withAI = t.filter(x => x.ai_addon)

    // Yıllık tahmini gelir (MRR değil, yıllık)
    let annualRevenue = 0
    active.forEach(x => {
      annualRevenue += (x.plan === 'advanced' ? PLANS.advanced.price : PLANS.basic.price)
      if (x.ai_addon) annualRevenue += AI_ADDON.price
    })

    // Son 30 gün yeni firma
    const since = Date.now() - 30*24*60*60*1000
    const newThisMonth = t.filter(x => new Date(x.created_at).getTime() > since).length

    // Toplam sipariş cirosu (tüm sistem)
    const totalOrderRevenue = (orders || []).reduce((s,o)=>s+(Number(o.total_price)||0), 0)

    setData({
      totalTenants: t.length,
      activeTenants: active.length,
      passiveTenants: t.length - active.length,
      basicCount: basic.length,
      advancedCount: advanced.length,
      aiCount: withAI.length,
      annualRevenue,
      newThisMonth,
      restaurantCount: (restaurants||[]).length,
      orderCount: (orders||[]).length,
      totalOrderRevenue,
    })
    setLoading(false)
  }

  if (loading) return <div style={{textAlign:'center',padding:64,color:'#aaa'}}>Yükleniyor...</div>

  const d = data

  return (
    <div style={{maxWidth:1000,margin:'0 auto'}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>İstatistikler</h1>
        <p style={{fontSize:13,color:'#aaa'}}>Platform geneli özet</p>
      </div>

      {/* Gelir kartı */}
      <div style={{background:'linear-gradient(135deg,#1D9E75,#0F6E56)',borderRadius:18,padding:'28px 32px',
        marginBottom:20,color:'#fff'}}>
        <p style={{fontSize:13,opacity:0.85}}>Tahmini Yıllık Gelir (aktif abonelikler)</p>
        <p style={{fontSize:40,fontWeight:900,margin:'6px 0'}}>{d.annualRevenue.toLocaleString('tr-TR')} ₾</p>
        <p style={{fontSize:12,opacity:0.75}}>{d.activeTenants} aktif firma üzerinden hesaplandı</p>
      </div>

      {/* Ana metrikler */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        <Stat label="TOPLAM FİRMA" value={d.totalTenants} color="#1D9E75" />
        <Stat label="AKTİF" value={d.activeTenants} color="#3b82f6" />
        <Stat label="PASİF" value={d.passiveTenants} color="#ef4444" />
        <Stat label="BU AY YENİ" value={`+${d.newThisMonth}`} color="#8b5cf6" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Paket dağılımı */}
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:16}}>Paket Dağılımı</h3>
          <PlanRow label="Temel" count={d.basicCount} total={d.totalTenants} color="#1D9E75" />
          <PlanRow label="Gelişmiş" count={d.advancedCount} total={d.totalTenants} color="#8b5cf6" />
          <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #f0f0ee',display:'flex',
            justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,color:'#666'}}>✨ AI eklentili</span>
            <span style={{fontSize:14,fontWeight:700,color:'#8b5cf6'}}>{d.aiCount} firma</span>
          </div>
        </div>

        {/* Operasyon */}
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:16}}>Operasyon</h3>
          <OpRow label="Toplam Restoran" value={d.restaurantCount} />
          <OpRow label="Toplam Sipariş" value={d.orderCount} />
          <OpRow label="Toplam Sipariş Cirosu" value={`${d.totalOrderRevenue.toLocaleString('tr-TR')} ₾`} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'16px 18px'}}>
      <p style={{fontSize:10,fontWeight:700,color:'#aaa',letterSpacing:'.05em'}}>{label}</p>
      <p style={{fontSize:26,fontWeight:900,color,marginTop:4}}>{value}</p>
    </div>
  )
}

function PlanRow({ label, count, total, color }) {
  const pct = total ? Math.round((count/total)*100) : 0
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:13,color:'#444'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:700,color}}>{count} (%{pct})</span>
      </div>
      <div style={{height:8,background:'#f0f0ee',borderRadius:4,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:4}} />
      </div>
    </div>
  )
}

function OpRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',
      borderBottom:'1px solid #f4f4f2'}}>
      <span style={{fontSize:13,color:'#666'}}>{label}</span>
      <span style={{fontSize:15,fontWeight:700,color:'#222'}}>{value}</span>
    </div>
  )
}
