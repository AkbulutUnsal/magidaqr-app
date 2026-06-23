import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { AI_ADDON } from '../../lib/plans'

export default function AdminAI() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [aiEnabled, setAiEnabled] = useState(null)  // null=kontrol ediliyor

  useEffect(() => {
    if (!profile?.tenant_id) return
    supabase.from('tenants').select('ai_addon').eq('id', profile.tenant_id).single()
      .then(({ data }) => {
        const on = !!data?.ai_addon
        setAiEnabled(on)
        if (on && profile?.restaurant_id) analyze()
        else setLoading(false)
      })
  }, [profile?.tenant_id, profile?.restaurant_id])

  async function analyze() {
    setLoading(true)
    const rid = profile.restaurant_id

    // Son 30 günün siparişleri + kalemleri
    const since = new Date(Date.now() - 30*24*60*60*1000).toISOString()
    const { data: orders } = await supabase.from('orders')
      .select('id,total_price,created_at,status,order_items(quantity,unit_price,menu_item:menu_items(id,name_tr,name_en,name_ka,price,category_id))')
      .eq('restaurant_id', rid)
      .gte('created_at', since)

    const { data: allItems } = await supabase.from('menu_items')
      .select('id,name_tr,name_en,name_ka,price,is_available')
      .eq('restaurant_id', rid)

    const ord = orders || []
    const items = allItems || []

    // Ürün bazlı satış
    const sales = {}   // itemId: { name, qty, revenue }
    let totalRevenue = 0
    const hourBuckets = Array(24).fill(0)

    ord.forEach(o => {
      totalRevenue += Number(o.total_price) || 0
      const h = new Date(o.created_at).getHours()
      hourBuckets[h]++
      ;(o.order_items||[]).forEach(oi => {
        const mi = oi.menu_item
        if (!mi) return
        if (!sales[mi.id]) sales[mi.id] = { name: mi.name_tr||mi.name_en||mi.name_ka, qty:0, revenue:0, price:mi.price }
        sales[mi.id].qty += oi.quantity
        sales[mi.id].revenue += oi.quantity * (oi.unit_price || mi.price)
      })
    })

    const salesArr = Object.entries(sales).map(([id,v])=>({ id, ...v }))
    const topSellers = [...salesArr].sort((a,b)=>b.qty-a.qty).slice(0,5)
    const topRevenue = [...salesArr].sort((a,b)=>b.revenue-a.revenue).slice(0,5)

    // Hiç satılmayan ürünler
    const soldIds = new Set(salesArr.map(s=>s.id))
    const neverSold = items.filter(i=>!soldIds.has(i.id))

    // En yoğun saat
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets))
    const avgOrder = ord.length ? (totalRevenue/ord.length) : 0

    // Otomatik öneriler
    const tips = []
    if (neverSold.length > 0)
      tips.push({ icon:'🔍', text:`${neverSold.length} ürün son 30 günde hiç satılmadı. Bunları menüden kaldırmayı veya öne çıkarmayı düşün.` })
    if (topSellers[0])
      tips.push({ icon:'🔥', text:`"${topSellers[0].name}" en çok satan ürün (${topSellers[0].qty} adet). Fiyatını test edebilir veya menüde üste taşıyabilirsin.` })
    if (peakHour >= 0 && Math.max(...hourBuckets) > 0)
      tips.push({ icon:'⏰', text:`En yoğun saat: ${peakHour}:00-${peakHour+1}:00. Bu saatlerde personel/stok planı yap.` })
    if (avgOrder > 0)
      tips.push({ icon:'🛒', text:`Ortalama sepet ${avgOrder.toFixed(2)} ₾. Combo/menü önerileriyle artırabilirsin.` })
    if (topRevenue[0] && topSellers[0] && topRevenue[0].id !== topSellers[0].id)
      tips.push({ icon:'💰', text:`"${topRevenue[0].name}" en çok ciro getiren ürün ama en çok satan değil — yüksek kârlı, tanıtımını artır.` })
    if (ord.length === 0)
      tips.push({ icon:'📊', text:'Son 30 günde sipariş yok. Veriler biriktikçe burası akıllı önerilerle dolacak.' })

    setStats({ totalRevenue, orderCount:ord.length, avgOrder, topSellers, topRevenue, neverSold, peakHour, hasData:Math.max(...hourBuckets)>0, tips })
    setLoading(false)
  }

  // AI eklentisi yoksa kilit ekranı
  if (aiEnabled === false) return (
    <div className="admin-page">
      <div className="page-header"><h1 className="page-title">🤖 AI Asistan</h1></div>
      <div style={{ maxWidth:520, margin:'40px auto', textAlign:'center', background:'#fff',
        border:'1px solid #eee', borderRadius:18, padding:'40px 32px' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h2 style={{ fontSize:20, fontWeight:800, color:'#222', marginBottom:8 }}>AI Asistan kilitli</h2>
        <p style={{ fontSize:14, color:'#888', lineHeight:1.6, marginBottom:24 }}>
          Bu özellik <strong>AI Asistan eklentisi</strong> ile açılır. Satış analizleri, akıllı öneriler
          ve menü mühendisliği için eklentiyi etkinleştirin.
        </p>
        <div style={{ background:'#f5f3ff', borderRadius:12, padding:'18px 20px', textAlign:'left', marginBottom:24 }}>
          {AI_ADDON.features.map((f,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:i<AI_ADDON.features.length-1?8:0 }}>
              <span style={{ color:'#8b5cf6' }}>✓</span>
              <span style={{ fontSize:13, color:'#555' }}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:22, fontWeight:900, color:'#8b5cf6' }}>
          +{AI_ADDON.price} {AI_ADDON.currency}<span style={{fontSize:13,fontWeight:500,color:'#999'}}>/{AI_ADDON.period}</span>
        </div>
        <p style={{ fontSize:12, color:'#bbb', marginTop:16 }}>
          Etkinleştirmek için sistem yöneticinizle iletişime geçin.
        </p>
      </div>
    </div>
  )

  if (loading) return (
    <div className="admin-page">
      <div className="page-header"><h1 className="page-title">AI Asistan</h1></div>
      <p style={{color:'#bbb'}}>Veriler analiz ediliyor...</p>
    </div>
  )

  const s = stats

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">🤖 AI Asistan</h1>
        <button className="btn-primary" onClick={analyze}>Yenile</button>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:20}}>Son 30 günün sipariş verilerinden otomatik analiz ve öneriler.</p>

      {/* Öneriler */}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
        {s.tips.map((t,i)=>(
          <div key={i} style={{display:'flex',gap:12,background:'#fff',border:'1px solid #eee',
            borderRadius:12,padding:'14px 18px',alignItems:'flex-start'}}>
            <span style={{fontSize:22}}>{t.icon}</span>
            <p style={{fontSize:13,color:'#444',lineHeight:1.5,flex:1}}>{t.text}</p>
          </div>
        ))}
      </div>

      {/* Özet kartlar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:24}}>
        <StatCard label="30 GÜN CİRO" value={`${s.totalRevenue.toFixed(0)} ₾`} color="#1D9E75" />
        <StatCard label="SİPARİŞ" value={s.orderCount} color="#3b82f6" />
        <StatCard label="ORT. SEPET" value={`${s.avgOrder.toFixed(1)} ₾`} color="#8b5cf6" />
        <StatCard label="EN YOĞUN SAAT" value={s.hasData?`${s.peakHour}:00`:'—'} color="#f59e0b" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* En çok satanlar */}
        <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#222',marginBottom:14}}>🔥 En Çok Satanlar</h3>
          {s.topSellers.length ? s.topSellers.map((it,i)=>(
            <div key={it.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',
              borderBottom:i<s.topSellers.length-1?'1px solid #f4f4f2':'none'}}>
              <span style={{width:24,height:24,borderRadius:6,background:'#1D9E75',color:'#fff',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{i+1}</span>
              <span style={{flex:1,fontSize:13,color:'#333'}}>{it.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:'#1D9E75'}}>{it.qty} adet</span>
            </div>
          )) : <p style={{color:'#bbb',fontSize:13}}>Veri yok</p>}
        </div>

        {/* En çok ciro */}
        <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#222',marginBottom:14}}>💰 En Çok Ciro</h3>
          {s.topRevenue.length ? s.topRevenue.map((it,i)=>(
            <div key={it.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',
              borderBottom:i<s.topRevenue.length-1?'1px solid #f4f4f2':'none'}}>
              <span style={{width:24,height:24,borderRadius:6,background:'#8b5cf6',color:'#fff',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{i+1}</span>
              <span style={{flex:1,fontSize:13,color:'#333'}}>{it.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:'#8b5cf6'}}>{it.revenue.toFixed(0)} ₾</span>
            </div>
          )) : <p style={{color:'#bbb',fontSize:13}}>Veri yok</p>}
        </div>
      </div>

      {/* Hiç satılmayanlar */}
      {s.neverSold.length > 0 && (
        <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:20,marginTop:16}}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#222',marginBottom:14}}>
            ❄️ Hiç Satılmayanlar ({s.neverSold.length})
          </h3>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {s.neverSold.map(it=>(
              <span key={it.id} style={{padding:'6px 12px',borderRadius:20,background:'#f5f5f3',
                fontSize:12,color:'#888'}}>
                {it.name_tr||it.name_en||it.name_ka}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{background:'#fff',border:'1px solid #eee',borderRadius:12,padding:'16px 18px'}}>
      <p style={{fontSize:10,fontWeight:700,color:'#aaa',letterSpacing:'.05em'}}>{label}</p>
      <p style={{fontSize:24,fontWeight:900,color,marginTop:4}}>{value}</p>
    </div>
  )
}
