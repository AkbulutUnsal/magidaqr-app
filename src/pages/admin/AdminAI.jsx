import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { AI_ADDON } from '../../lib/plans'

const G = '#1D9E75', P = '#8b5cf6'

const CAPABILITIES = [
  { icon:'📝', title:'Ürün Açıklamaları Üret', desc:'Boş ürünler için iştah açan kısa metinler.', cat:'content' },
  { icon:'🌐', title:'Ürün Çevirilerini Tamamla', desc:'Eksik dillerdeki ürün adı ve açıklamalarını doldur.', cat:'content' },
  { icon:'🔤', title:'Arayüz Çevirilerini Geliştir', desc:'UI metinlerini seçili dillerde toplu çevir.', cat:'content' },
  { icon:'⚠️', title:'Alerjen Çevirileri', desc:'Alerjen etiketleri tüm mutfak dillerinde hazır.', cat:'content' },
  { icon:'💬', title:'Anket Sorusu Çevirileri', desc:'Misafir anketinin sorularını çok dilliye çevir.', cat:'content' },
  { icon:'🔍', title:'Arama Önerilerini Çevir', desc:'Popüler arama anahtar kelimelerini lokalize et.', cat:'content' },
  { icon:'🖼️', title:'Kategori Kapak Görseli Üret', desc:'Her kategori için marka uyumlu hero görseli.', cat:'image' },
  { icon:'✨', title:'Ürün Fotoğraflarını İyileştir', desc:'Amatör karelerden stüdyo kalitesinde görsel.', cat:'image' },
]

export default function AdminAI() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [aiEnabled, setAiEnabled] = useState(null)

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
    const since = new Date(Date.now() - 30*24*60*60*1000).toISOString()
    const { data: orders } = await supabase.from('orders')
      .select('id,total_price,created_at,status,order_items(quantity,unit_price,menu_item:menu_items(id,name_tr,name_en,name_ka,price,category_id))')
      .eq('restaurant_id', rid).gte('created_at', since)
    const { data: allItems } = await supabase.from('menu_items')
      .select('id,name_tr,name_en,name_ka,price,is_available,description_tr,description_en,description_ka')
      .eq('restaurant_id', rid)

    const ord = orders || []
    const items = allItems || []
    const sales = {}
    let totalRevenue = 0
    const hourBuckets = Array(24).fill(0)

    ord.forEach(o => {
      totalRevenue += Number(o.total_price) || 0
      hourBuckets[new Date(o.created_at).getHours()]++
      ;(o.order_items||[]).forEach(oi => {
        const mi = oi.menu_item; if (!mi) return
        if (!sales[mi.id]) sales[mi.id] = { name: mi.name_tr||mi.name_en||mi.name_ka, qty:0, revenue:0, price:mi.price }
        sales[mi.id].qty += oi.quantity
        sales[mi.id].revenue += oi.quantity * (oi.unit_price || mi.price)
      })
    })

    const salesArr = Object.entries(sales).map(([id,v])=>({ id, ...v }))
    const topSellers = [...salesArr].sort((a,b)=>b.qty-a.qty).slice(0,5)
    const topRevenue = [...salesArr].sort((a,b)=>b.revenue-a.revenue).slice(0,5)
    const soldIds = new Set(salesArr.map(s=>s.id))
    const neverSold = items.filter(i=>!soldIds.has(i.id))
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets))
    const avgOrder = ord.length ? (totalRevenue/ord.length) : 0

    const langCoverage = ['tr','en','ka','ru'].map(lng => {
      const nameFilled = items.filter(i => i[`name_${lng}`]?.trim()).length
      const descFilled = items.filter(i => i[`description_${lng}`]?.trim()).length
      return {
        lang: lng,
        namePct: items.length ? Math.round(nameFilled/items.length*100) : 0,
        descPct: items.length ? Math.round(descFilled/items.length*100) : 0,
      }
    })
    const missingDesc = items.filter(i => !i.description_tr?.trim() && !i.description_en?.trim() && !i.description_ka?.trim()).length

    const tips = []
    if (neverSold.length > 0) tips.push({ icon:'🔍', text:`${neverSold.length} ürün son 30 günde hiç satılmadı. Bunları menüden kaldırmayı veya öne çıkarmayı düşün.` })
    if (topSellers[0]) tips.push({ icon:'🔥', text:`"${topSellers[0].name}" en çok satan ürün (${topSellers[0].qty} adet). Fiyatını test edebilir veya menüde üste taşıyabilirsin.` })
    if (peakHour >= 0 && Math.max(...hourBuckets) > 0) tips.push({ icon:'⏰', text:`En yoğun saat: ${peakHour}:00-${peakHour+1}:00. Bu saatlerde personel/stok planı yap.` })
    if (avgOrder > 0) tips.push({ icon:'🛒', text:`Ortalama sepet ${avgOrder.toFixed(2)} ₾. Combo/menü önerileriyle artırabilirsin.` })
    if (topRevenue[0] && topSellers[0] && topRevenue[0].id !== topSellers[0].id) tips.push({ icon:'💰', text:`"${topRevenue[0].name}" en çok ciro getiren ürün ama en çok satan değil — yüksek kârlı, tanıtımını artır.` })
    if (missingDesc > 0) tips.push({ icon:'📝', text:`${missingDesc} ürünün açıklaması boş. AI ile otomatik açıklama üretmek menü çekiciliğini artırır.` })
    if (ord.length === 0) tips.push({ icon:'📊', text:'Son 30 günde sipariş yok. Veriler biriktikçe burası akıllı önerilerle dolacak.' })

    setStats({ totalRevenue, orderCount:ord.length, avgOrder, topSellers, topRevenue, neverSold, peakHour, hasData:Math.max(...hourBuckets)>0, tips, langCoverage, itemCount:items.length, missingDesc })
    setLoading(false)
  }

  if (aiEnabled === false) return (
    <div style={{maxWidth:560,margin:'40px auto',textAlign:'center',background:'#fff',border:'1px solid #eee',borderRadius:18,padding:'44px 32px'}}>
      <div style={{width:72,height:72,borderRadius:18,background:`linear-gradient(135deg,${P},#6d28d9)`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:32}}>🔒</div>
      <h2 style={{fontSize:20,fontWeight:800,color:'#222',marginBottom:8}}>AI Asistan kilitli</h2>
      <p style={{fontSize:14,color:'#888',lineHeight:1.6,marginBottom:24}}>
        Bu özellik <strong>AI Asistan eklentisi</strong> ile açılır. Satış analizleri, akıllı öneriler, içerik ve görsel üretimi için eklentiyi etkinleştirin.
      </p>
      <div style={{background:'#f5f3ff',borderRadius:12,padding:'18px 20px',textAlign:'left',marginBottom:24}}>
        {AI_ADDON.features.map((f,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:i<AI_ADDON.features.length-1?8:0}}>
            <span style={{color:P}}>✓</span><span style={{fontSize:13,color:'#555'}}>{f}</span>
          </div>
        ))}
      </div>
      <div style={{fontSize:22,fontWeight:900,color:P}}>+{AI_ADDON.price} {AI_ADDON.currency}<span style={{fontSize:13,fontWeight:500,color:'#999'}}>/{AI_ADDON.period}</span></div>
      <p style={{fontSize:12,color:'#bbb',marginTop:16}}>Etkinleştirmek için sistem yöneticinizle iletişime geçin.</p>
    </div>
  )

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
      <div style={{width:32,height:32,border:'3px solid #e8e8e4',borderTop:`3px solid ${P}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{color:'#aaa',fontSize:13}}>Veriler analiz ediliyor...</span>
    </div>
  )

  const s = stats

  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      {/* Mor banner */}
      <div style={{background:`linear-gradient(120deg,${P},#a855f7,#c026d3)`,borderRadius:18,padding:'26px 30px',marginBottom:24,position:'relative',overflow:'hidden',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
        <div style={{position:'absolute',right:40,top:-20,fontSize:120,opacity:.12}}>✨</div>
        <div style={{display:'flex',alignItems:'center',gap:16,position:'relative'}}>
          <div style={{width:52,height:52,borderRadius:14,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>✨</div>
          <div>
            <h1 style={{fontSize:22,fontWeight:900,color:'#fff',marginBottom:4}}>AI Asistan</h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.85)'}}>İçerik + görsel asistanı — tek yerden tüm kullanım, kapsam ve fırsatlar.</p>
          </div>
        </div>
        <button onClick={analyze} style={{position:'relative',background:'rgba(255,255,255,.18)',color:'#fff',border:'1px solid rgba(255,255,255,.3)',borderRadius:10,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
          ⟳ Analizi Yenile
        </button>
      </div>

      {/* Yetenekler */}
      <div style={{marginBottom:28}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:28,height:28,borderRadius:8,background:`${P}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>⭐</span>
            <h2 style={{fontSize:16,fontWeight:800}}>Yetenekler</h2>
          </div>
          <span style={{fontSize:12,color:'#bbb'}}>AI asistanın yapabilecekleri</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {CAPABILITIES.map((c,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:'18px',position:'relative',opacity:.92}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div style={{width:40,height:40,borderRadius:10,background:c.cat==='image'?`${P}14`:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{c.icon}</div>
                <span style={{fontSize:9,fontWeight:700,color:'#f59e0b',background:'#fffbeb',padding:'3px 8px',borderRadius:20,border:'1px solid #fde68a'}}>YAKINDA</span>
              </div>
              <h3 style={{fontSize:13,fontWeight:700,marginBottom:5,lineHeight:1.3}}>{c.title}</h3>
              <p style={{fontSize:11,color:'#999',lineHeight:1.5}}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* İçerik Asistanı */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <span style={{width:26,height:26,borderRadius:7,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>📄</span>
          <h2 style={{fontSize:15,fontWeight:800}}>İçerik Asistanı</h2>
          <span style={{fontSize:9,fontWeight:700,color:'#94a3b8',background:'#f1f5f9',padding:'3px 8px',borderRadius:20}}>HAZIRLANIYOR</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <UsageCard label="BUGÜN" value="0" sub="Token (input + output)" max="—" />
          <UsageCard label="TOPLAM KULLANIM" value="0" sub="Tüm zamanlar" />
        </div>
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20}}>
          <div style={{marginBottom:16}}>
            <h3 style={{fontSize:14,fontWeight:700}}>Çeviri Kapsamı</h3>
            <p style={{fontSize:12,color:'#aaa',marginTop:2}}>Toplam {s.itemCount} ürünün her dildeki tamamlanma oranı</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr',gap:12,fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.04em',paddingBottom:10,borderBottom:'1px solid #f0f0ee',marginBottom:6}}>
            <span>Dil</span><span>Ürün Adı</span><span>Açıklama</span>
          </div>
          {s.langCoverage.map(lc=>{
            const flag = { tr:'🇹🇷 Türkçe', en:'🇬🇧 English', ka:'🇬🇪 ქართული', ru:'🇷🇺 Русский' }[lc.lang]
            return (
              <div key={lc.lang} style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr',gap:12,alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f9f9f7'}}>
                <span style={{fontSize:12,fontWeight:600}}>{flag}</span>
                <Bar pct={lc.namePct} color={P} />
                <Bar pct={lc.descPct} color={G} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Görsel Asistanı */}
      <div style={{marginBottom:28}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <span style={{width:26,height:26,borderRadius:7,background:`${P}14`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>🖼️</span>
          <h2 style={{fontSize:15,fontWeight:800}}>Görsel Asistanı</h2>
          <span style={{fontSize:9,fontWeight:700,color:'#94a3b8',background:'#f1f5f9',padding:'3px 8px',borderRadius:20}}>HAZIRLANIYOR</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <UsageCard label="BUGÜN" value="0" sub="İyileştirilmiş + üretilmiş görsel" max="—" />
          <UsageCard label="TOPLAM KULLANIM" value="0" sub="Tüm zamanlar" />
        </div>
      </div>

      {/* ── AKILLI ÖNERİLER (lokal analitik — aktif) ── */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <span style={{width:26,height:26,borderRadius:7,background:'#e8f5ee',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>🧠</span>
        <h2 style={{fontSize:15,fontWeight:800}}>Akıllı Öneriler</h2>
        <span style={{fontSize:9,fontWeight:700,color:G,background:'#e8f5ee',padding:'3px 8px',borderRadius:20}}>AKTİF</span>
        <span style={{fontSize:11,color:'#bbb',marginLeft:'auto'}}>Son 30 gün sipariş analizi</span>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
        {s.tips.map((t,i)=>(
          <div key={i} style={{display:'flex',gap:12,background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'14px 18px',alignItems:'flex-start'}}>
            <span style={{fontSize:20}}>{t.icon}</span>
            <p style={{fontSize:13,color:'#444',lineHeight:1.5,flex:1}}>{t.text}</p>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        <StatCard label="30 GÜN CİRO" value={`${s.totalRevenue.toFixed(0)} ₾`} color={G} />
        <StatCard label="SİPARİŞ" value={s.orderCount} color="#3b82f6" />
        <StatCard label="ORT. SEPET" value={`${s.avgOrder.toFixed(1)} ₾`} color={P} />
        <StatCard label="EN YOĞUN SAAT" value={s.hasData?`${s.peakHour}:00`:'—'} color="#f59e0b" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>🔥 En Çok Satanlar</h3>
          {s.topSellers.length ? s.topSellers.map((it,i)=>(
            <div key={it.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<s.topSellers.length-1?'1px solid #f4f4f2':'none'}}>
              <span style={{width:24,height:24,borderRadius:6,background:G,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{i+1}</span>
              <span style={{flex:1,fontSize:13,color:'#333'}}>{it.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:G}}>{it.qty} adet</span>
            </div>
          )) : <p style={{color:'#bbb',fontSize:13}}>Veri yok</p>}
        </div>
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>💰 En Çok Ciro</h3>
          {s.topRevenue.length ? s.topRevenue.map((it,i)=>(
            <div key={it.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<s.topRevenue.length-1?'1px solid #f4f4f2':'none'}}>
              <span style={{width:24,height:24,borderRadius:6,background:P,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{i+1}</span>
              <span style={{flex:1,fontSize:13,color:'#333'}}>{it.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:P}}>{it.revenue.toFixed(0)} ₾</span>
            </div>
          )) : <p style={{color:'#bbb',fontSize:13}}>Veri yok</p>}
        </div>
      </div>

      {s.neverSold.length > 0 && (
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:20,marginTop:16}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>❄️ Hiç Satılmayanlar ({s.neverSold.length})</h3>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {s.neverSold.map(it=>(
              <span key={it.id} style={{padding:'6px 12px',borderRadius:20,background:'#f5f5f3',fontSize:12,color:'#888'}}>
                {it.name_tr||it.name_en||it.name_ka}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UsageCard({ label, value, sub, max }) {
  return (
    <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:'20px 22px'}}>
      <p style={{fontSize:11,fontWeight:700,color:'#aaa',letterSpacing:'.05em',marginBottom:8}}>{label}</p>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
        <span style={{fontSize:28,fontWeight:900,color:'#222'}}>{value}</span>
        {max && <span style={{fontSize:12,color:'#ccc'}}>/ {max}</span>}
      </div>
      <div style={{height:5,background:'#f0f0ee',borderRadius:3,margin:'10px 0 6px',overflow:'hidden'}}>
        <div style={{width:'2%',height:'100%',background:G,borderRadius:3}}/>
      </div>
      <p style={{fontSize:11,color:'#bbb'}}>{sub}</p>
    </div>
  )
}

function Bar({ pct, color }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{flex:1,height:7,background:'#f0f0ee',borderRadius:4,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:4}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:pct===100?G:'#888',width:34,textAlign:'right'}}>{pct}%</span>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'16px 18px'}}>
      <p style={{fontSize:10,fontWeight:700,color:'#aaa',letterSpacing:'.05em'}}>{label}</p>
      <p style={{fontSize:24,fontWeight:900,color,marginTop:4}}>{value}</p>
    </div>
  )
}
