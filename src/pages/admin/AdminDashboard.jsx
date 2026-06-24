import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ today:0, week:0, total:0, items:0, yesterday:0, prevWeek:0 })
  const [topItems, setTopItems] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [chartData, setChartData] = useState([])
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: rest } = await supabase.from('restaurants').select('*').limit(1).single()
    setRestaurant(rest)
    if (!rest) return setLoading(false)
    const rid = rest.id

    const today = new Date(); today.setHours(0,0,0,0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
    const week  = new Date(); week.setDate(week.getDate()-7)
    const prevWeekStart = new Date(); prevWeekStart.setDate(prevWeekStart.getDate()-14)
    const prevWeekEnd = new Date(); prevWeekEnd.setDate(prevWeekEnd.getDate()-7)

    const [{ count: todayC }, { count: weekC }, { count: totalC }, { count: itemsC }, { count: yesterdayC }, { count: prevWeekC }] = await Promise.all([
      supabase.from('orders').select('*',{count:'exact',head:true}).eq('restaurant_id',rid).gte('created_at',today.toISOString()),
      supabase.from('orders').select('*',{count:'exact',head:true}).eq('restaurant_id',rid).gte('created_at',week.toISOString()),
      supabase.from('orders').select('*',{count:'exact',head:true}).eq('restaurant_id',rid),
      supabase.from('menu_items').select('*',{count:'exact',head:true}).eq('restaurant_id',rid),
      supabase.from('orders').select('*',{count:'exact',head:true}).eq('restaurant_id',rid).gte('created_at',yesterday.toISOString()).lt('created_at',today.toISOString()),
      supabase.from('orders').select('*',{count:'exact',head:true}).eq('restaurant_id',rid).gte('created_at',prevWeekStart.toISOString()).lt('created_at',prevWeekEnd.toISOString()),
    ])
    setStats({ today:todayC||0, week:weekC||0, total:totalC||0, items:itemsC||0, yesterday:yesterdayC||0, prevWeek:prevWeekC||0 })

    // Chart
    const days = []
    for (let i=13;i>=0;i--) {
      const d=new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0)
      const d2=new Date(d); d2.setDate(d2.getDate()+1)
      const {count}=await supabase.from('orders').select('*',{count:'exact',head:true})
        .eq('restaurant_id',rid).gte('created_at',d.toISOString()).lt('created_at',d2.toISOString())
      const mo=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]
      days.push({date:`${d.getDate()} ${mo}`,orders:count||0})
    }
    setChartData(days)

    // Top items
    const {data:ois}=await supabase.from('order_items')
      .select('menu_item_id,quantity,menu_items(name_tr,name_en,name_ka,image_url)').limit(200)
    if (ois) {
      const counts={}
      ois.forEach(oi=>{
        const id=oi.menu_item_id
        if(!counts[id]) counts[id]={name:oi.menu_items?.name_tr||oi.menu_items?.name_en||oi.menu_items?.name_ka||'?',image:oi.menu_items?.image_url,count:0}
        counts[id].count+=oi.quantity
      })
      const sorted=Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,5)
      const max=sorted[0]?.count||1
      setTopItems(sorted.map(i=>({...i,pct:Math.round(i.count/max*100)})))
    }

    // Recent orders
    const {data:orders}=await supabase.from('orders')
      .select('*,tables(table_number)').eq('restaurant_id',rid)
      .order('created_at',{ascending:false}).limit(6)
    setRecentOrders(orders||[])
    setLoading(false)
  }

  const greet=()=>{const h=new Date().getHours();return h<12?'Günaydın':h<18?'İyi öğleden sonralar':'İyi akşamlar'}
  // Trend: bugünkü değer önceki değere göre yüzde
  const trend=(cur,prev)=>{
    if(prev===0) return cur>0?{pct:100,up:true}:null
    const pct=Math.round((cur-prev)/prev*100)
    return {pct:Math.abs(pct),up:pct>=0}
  }
  const todayTrend=trend(stats.today,stats.yesterday)
  const weekTrend=trend(stats.week,stats.prevWeek)
  const SC={pending:'#f59e0b',preparing:'#3b82f6',ready:'#1D9E75',served:'#6b7280',cancelled:'#ef4444'}
  const SL={pending:'Bekliyor',preparing:'Hazırlanıyor',ready:'Hazır',served:'Servis edildi',cancelled:'İptal'}

  // AI insights
  const insights=[]
  if(stats.today===0) insights.push({color:'#f59e0b',bg:'#fffbeb',text:'Bugün henüz sipariş yok. Menünüzü kontrol edin.'})
  if(stats.items===0) insights.push({color:'#ef4444',bg:'#fef2f2',text:'Menünüzde ürün yok! Hemen ürün ekleyin.'})
  if(stats.week>10) insights.push({color:'#1D9E75',bg:'#e8f5ee',text:`Son 7 günde ${stats.week} sipariş — harika gidiyorsunuz! 🎉`})

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
      <div style={{width:32,height:32,border:'3px solid #e8e8e4',borderTop:'3px solid #1D9E75',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{color:'#aaa',fontSize:13}}>Yükleniyor...</span>
    </div>
  )

  const restName = restaurant?.name_tr || restaurant?.name_en || restaurant?.name_ka || 'Restoranınız'
  const restSlug = restaurant?.slug || 'main'

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20,maxWidth:1200,margin:'0 auto',alignItems:'start'}}>

      {/* ── Sol ── */}
      <div>
        {/* Welcome banner */}
        <div style={{background:'linear-gradient(135deg,#0d5e48,#1D9E75,#2db88a)',borderRadius:16,padding:'24px 28px',marginBottom:16,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',right:-30,top:-30,width:200,height:200,borderRadius:'50%',background:'rgba(255,255,255,.05)'}}/>
          <p style={{fontSize:11,color:'rgba(255,255,255,.65)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{greet()}</p>
          <h1 style={{fontSize:22,fontWeight:900,color:'#fff',marginBottom:6}}>{restName}</h1>
          <p style={{fontSize:13,color:'rgba(255,255,255,.8)'}}>
            Bugün <strong style={{color:'#fff'}}>{stats.today}</strong> sipariş
            {todayTrend && (
              <span style={{marginLeft:8,background:'rgba(255,255,255,.15)',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:600}}>
                {todayTrend.up?'↗':'↘'} Dünden %{todayTrend.pct} {todayTrend.up?'daha iyi':'daha az'}
              </span>
            )}
          </p>
        </div>

        {/* Komut / arama kutusu */}
        <a href="/admin/menu" style={{display:'flex',alignItems:'center',gap:14,background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:'16px 18px',marginBottom:20,textDecoration:'none',transition:'border-color .15s,box-shadow .15s'}}
          onMouseOver={e=>{e.currentTarget.style.borderColor='#1D9E75';e.currentTarget.style.boxShadow='0 4px 16px rgba(29,158,117,.1)'}}
          onMouseOut={e=>{e.currentTarget.style.borderColor='#e8e8e4';e.currentTarget.style.boxShadow='none'}}>
          <div style={{width:42,height:42,borderRadius:11,background:'#e8f5ee',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:15,fontWeight:700,color:'#222'}}>Ne yapmak istiyorsun?</p>
            <p style={{fontSize:12,color:'#aaa',marginTop:1}}>Ürün, kategori, ayar, sayfa… yönetmeye başla</p>
          </div>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        {/* KPI cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
          {[
            {label:'BUGÜN',        val:stats.today, sub:'sipariş', color:'#1D9E75', bg:'#e8f5ee', tr:todayTrend},
            {label:'SON 7 GÜN',    val:stats.week,  sub:'sipariş', color:'#3b82f6', bg:'#eff6ff', tr:weekTrend},
            {label:'TÜM ZAMANLAR', val:stats.total, sub:'sipariş', color:'#8b5cf6', bg:'#f5f3ff', tr:null},
            {label:'MENÜDE',       val:stats.items,  sub:'ürün',   color:'#f59e0b', bg:'#fffbeb', tr:null},
          ].map((k,i)=>(
            <div key={i} style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <p style={{fontSize:10,fontWeight:700,color:'#aaa',textTransform:'uppercase',letterSpacing:'.06em'}}>{k.label}</p>
                {k.tr && (
                  <span style={{fontSize:10,fontWeight:700,color:k.tr.up?'#1D9E75':'#ef4444',background:k.tr.up?'#e8f5ee':'#fef2f2',padding:'2px 7px',borderRadius:20,display:'flex',alignItems:'center',gap:2}}>
                    {k.tr.up?'↗':'↘'} %{k.tr.pct}
                  </span>
                )}
              </div>
              <p style={{fontSize:28,fontWeight:900,color:k.color,lineHeight:1}}>{k.val}</p>
              <p style={{fontSize:11,color:'#ccc',marginTop:3}}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'20px',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <h3 style={{fontSize:14,fontWeight:700}}>Son 14 Gün</h3>
              <p style={{fontSize:12,color:'#aaa'}}>Günlük sipariş trafiği</p>
            </div>
            <a href="/admin/analytics" style={{fontSize:12,color:'#1D9E75',fontWeight:600,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
              Detaylı analitik
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}/>
              </linearGradient></defs>
              <XAxis dataKey="date" tick={{fontSize:9,fill:'#bbb'}} tickLine={false} axisLine={false} interval={1}/>
              <YAxis tick={{fontSize:9,fill:'#bbb'}} tickLine={false} axisLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{border:'1px solid #e8e8e4',borderRadius:8,fontSize:12}}/>
              <Area type="monotone" dataKey="orders" stroke="#1D9E75" strokeWidth={2} fill="url(#cg)" dot={false} activeDot={{r:4,fill:'#1D9E75'}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

          {/* Top items */}
          <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'18px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <span>⭐</span>
              <div>
                <h3 style={{fontSize:13,fontWeight:700}}>Bu Hafta Yıldızlar</h3>
                <p style={{fontSize:11,color:'#aaa'}}>En çok sipariş edilenler</p>
              </div>
            </div>
            {topItems.length===0
              ? <p style={{fontSize:12,color:'#ccc',textAlign:'center',padding:'20px 0'}}>Henüz veri yok</p>
              : topItems.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:800,color:'#ddd',width:16,textAlign:'center'}}>{i+1}</span>
                  {item.image
                    ? <img src={item.image} alt="" style={{width:32,height:32,borderRadius:6,objectFit:'cover',flexShrink:0}}/>
                    : <div style={{width:32,height:32,borderRadius:6,background:'#f4f4f2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>🍽️</div>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>{item.name}</p>
                    <div style={{height:3,background:'#f4f4f2',borderRadius:4}}>
                      <div style={{height:'100%',background:'#1D9E75',borderRadius:4,width:`${item.pct}%`}}/>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <span style={{fontSize:13,fontWeight:800,color:'#1D9E75'}}>{item.count}</span>
                    <p style={{fontSize:8,color:'#bbb',marginTop:1}}>sipariş</p>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Quick actions */}
          <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'18px'}}>
            <h3 style={{fontSize:13,fontWeight:700,marginBottom:14}}>Hızlı İşlemler</h3>
            {[
              {href:'/admin/menu',      icon:'🍽️', label:'Ürün Ekle',       desc:'Menüye yeni ürün'},
              {href:'/admin/categories',icon:'📁', label:'Kategori Ekle',   desc:'Yeni kategori'},
              {href:'/admin/qr',        icon:'🖨️', label:'QR Yazdır',       desc:'Masa QR kodları'},
              {href:'/admin/tables',    icon:'🪑', label:'Masa Ekle',       desc:'Yeni masa tanımla'},
              {href:'/kitchen',         icon:'👨‍🍳', label:'Mutfak Paneli',  desc:'Sipariş yönetimi', target:'_blank'},
            ].map((a,i)=>(
              <a key={i} href={a.href} target={a.target}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,textDecoration:'none',color:'inherit',transition:'background .12s',marginBottom:4}}
                onMouseOver={e=>e.currentTarget.style.background='#f0f0ee'}
                onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <span style={{fontSize:16,width:24,textAlign:'center'}}>{a.icon}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:12,fontWeight:600}}>{a.label}</p>
                  <p style={{fontSize:10,color:'#aaa'}}>{a.desc}</p>
                </div>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sağ: Canlı önizleme + AI + Son siparişler ── */}
      <div style={{display:'flex',flexDirection:'column',gap:16,position:'sticky',top:0}}>

        {/* Canlı menü önizleme */}
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h3 style={{fontSize:13,fontWeight:700}}>Menü Önizleme</h3>
            <a href={`/menu/${restSlug}/c4efa2ba-fc1c-43e5-980b-b57257b27147`} target="_blank"
              style={{fontSize:11,color:'#1D9E75',fontWeight:600,textDecoration:'none'}}>Yeni sekmede ↗</a>
          </div>
          {/* Mini phone */}
          <div style={{width:'100%',maxWidth:200,margin:'0 auto',background:'#1a1a1a',borderRadius:24,padding:6,boxShadow:'0 8px 32px rgba(0,0,0,.2)'}}>
            <div style={{background:'#fff',borderRadius:18,overflow:'hidden'}}>
              <div style={{height:80,background:'#222',position:'relative'}}>
                {restaurant?.cover_url
                  ? <img src={restaurant.cover_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#1a1a1a,#333)',display:'flex',alignItems:'center',justifyContent:'center',color:'#555',fontSize:20}}>🍽️</div>
                }
                <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent,rgba(0,0,0,.5))'}}/>
                <div style={{position:'absolute',bottom:6,left:8,color:'#fff',fontSize:9,fontWeight:700}}>{restName}</div>
                <div style={{position:'absolute',bottom:6,right:8,background:'rgba(255,255,255,.15)',borderRadius:10,padding:'2px 6px',color:'#fff',fontSize:8,fontWeight:700}}>Masa 1</div>
              </div>
              <div style={{padding:8}}>
                <div style={{display:'flex',gap:4,marginBottom:6}}>
                  <span style={{fontSize:8,background:'#1D9E75',color:'#fff',padding:'2px 7px',borderRadius:20,fontWeight:700}}>Tümü</span>
                  <span style={{fontSize:8,background:'#f4f4f2',color:'#666',padding:'2px 7px',borderRadius:20,fontWeight:600}}>Ana yemek</span>
                </div>
                {[{n:'Mtsvadi',p:'18 ₾'},{n:'Khachapuri',p:'14 ₾'}].map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #f4f4f2'}}>
                    <span style={{fontSize:9,fontWeight:600}}>{item.n}</span>
                    <span style={{fontSize:9,fontWeight:800,color:'#1D9E75'}}>{item.p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <span style={{fontSize:16}}>🤖</span>
            <div>
              <h3 style={{fontSize:13,fontWeight:700}}>Senin için öneriler</h3>
              <p style={{fontSize:10,color:'#aaa'}}>AI analiz</p>
            </div>
          </div>
          {insights.length===0
            ? <p style={{fontSize:12,color:'#ccc',textAlign:'center',padding:'12px 0'}}>Her şey yolunda 👍</p>
            : insights.map((ins,i)=>(
              <div key={i} style={{background:ins.bg,border:`1px solid ${ins.color}30`,borderRadius:8,padding:'10px 12px',marginBottom:8}}>
                <p style={{fontSize:12,color:ins.color,lineHeight:1.5}}>{ins.text}</p>
              </div>
            ))
          }
        </div>

        {/* Son siparişler */}
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:'16px'}}>
          <h3 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Son Siparişler</h3>
          {recentOrders.length===0
            ? <p style={{fontSize:12,color:'#ccc',textAlign:'center',padding:'12px 0'}}>Henüz sipariş yok</p>
            : recentOrders.map(o=>(
              <div key={o.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f9f9f7'}}>
                <div>
                  <p style={{fontSize:12,fontWeight:600}}>Masa {o.tables?.table_number||'?'}</p>
                  <p style={{fontSize:10,color:'#aaa'}}>{new Date(o.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</p>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>{o.total_price} ₾</p>
                  <span style={{fontSize:9,fontWeight:700,color:SC[o.status]||'#aaa',background:(SC[o.status]||'#aaa')+'18',padding:'1px 7px',borderRadius:20}}>
                    {SL[o.status]||o.status}
                  </span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
