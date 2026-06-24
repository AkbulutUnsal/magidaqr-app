import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

const RANGES = [
  { key: 7, label: '7 Gün' },
  { key: 30, label: '30 Gün' },
  { key: 90, label: '90 Gün' },
]
const TABS = [
  { key: 'overview', label: 'Genel Bakış', icon: '📊' },
  { key: 'products', label: 'Ürünler', icon: '🍽️' },
  { key: 'visitors', label: 'Ziyaretçiler', icon: '👥' },
]
const G = '#1D9E75'

export default function AdminAnalytics() {
  const [restaurant, setRestaurant] = useState(null)
  const [range, setRange] = useState(30)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => { load() }, [range])

  async function load() {
    setLoading(true)
    const { data: rest } = await supabase.from('restaurants').select('*').limit(1).single()
    if (!rest) { setLoading(false); return }
    setRestaurant(rest)
    const rid = rest.id

    const since = new Date(); since.setDate(since.getDate() - range); since.setHours(0,0,0,0)
    const prevSince = new Date(); prevSince.setDate(prevSince.getDate() - range*2)
    const prevEnd = new Date(since)

    // Tüm olayları çek (dönem içi)
    const { data: events } = await supabase.from('analytics_events')
      .select('*').eq('restaurant_id', rid).gte('created_at', since.toISOString())
      .order('created_at', { ascending: true }).limit(10000)

    // Önceki dönem (karşılaştırma için sadece sayım)
    const { count: prevViews } = await supabase.from('analytics_events')
      .select('*', { count:'exact', head:true }).eq('restaurant_id', rid)
      .eq('event_type','page_view').gte('created_at', prevSince.toISOString()).lt('created_at', prevEnd.toISOString())

    // Siparişler
    const { data: orders } = await supabase.from('orders')
      .select('id,total_price,created_at,status').eq('restaurant_id', rid)
      .gte('created_at', since.toISOString()).order('created_at',{ascending:true}).limit(5000)

    const ev = events || []
    const ords = orders || []

    // ── Metrikler ──
    const pageViews = ev.filter(e => e.event_type === 'page_view')
    const sessions = new Set(ev.map(e => e.session_id))
    const totalViews = pageViews.length
    const uniqueVisitors = sessions.size
    const viewTrend = prevViews ? Math.round((totalViews - prevViews)/prevViews*100) : (totalViews>0?100:0)

    // Cihaz dağılımı
    const devices = { mobile:0, tablet:0, desktop:0 }
    const seenSessionDevice = {}
    ev.forEach(e => { if(!seenSessionDevice[e.session_id]){ seenSessionDevice[e.session_id]=e.device; devices[e.device]=(devices[e.device]||0)+1 } })

    // Kaynak (QR vs direkt)
    const sources = { qr:0, direct:0 }
    const seenSessionSource = {}
    ev.forEach(e => { if(!seenSessionSource[e.session_id]){ seenSessionSource[e.session_id]=e.source; sources[e.source]=(sources[e.source]||0)+1 } })
    const totalSrc = sources.qr + sources.direct
    const qrPct = totalSrc ? Math.round(sources.qr/totalSrc*100) : 0

    // Dil dağılımı
    const langs = {}
    const seenSessionLang = {}
    ev.forEach(e => { if(!seenSessionLang[e.session_id]){ seenSessionLang[e.session_id]=e.lang; langs[e.lang]=(langs[e.lang]||0)+1 } })

    // Günlük trafik
    const dayMap = {}
    for (let i=range-1;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0)
      const key=d.toISOString().slice(0,10)
      const mo=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]
      dayMap[key]={ date:`${d.getDate()} ${mo}`, views:0, visitors:new Set() }
    }
    pageViews.forEach(e=>{ const k=e.created_at.slice(0,10); if(dayMap[k]){ dayMap[k].views++; dayMap[k].visitors.add(e.session_id) } })
    const trafficData = Object.values(dayMap).map(d=>({ date:d.date, views:d.views, visitors:d.visitors.size }))

    // Saatlik yoğunluk (7×24)
    const heat = Array.from({length:7},()=>Array(24).fill(0))
    pageViews.forEach(e=>{ const dt=new Date(e.created_at); const wd=(dt.getDay()+6)%7; heat[wd][dt.getHours()]++ })
    const heatMax = Math.max(1, ...heat.flat())

    // Menü hunisi
    const funnelViews = ev.filter(e=>e.event_type==='page_view').length
    const funnelCat = new Set(ev.filter(e=>e.event_type==='category_view').map(e=>e.session_id)).size
    const funnelItem = new Set(ev.filter(e=>e.event_type==='item_view').map(e=>e.session_id)).size
    const funnelOrder = ev.filter(e=>e.event_type==='order_placed').length

    // Sipariş metrikleri
    const orderRevenue = ords.reduce((s,o)=>s+(Number(o.total_price)||0),0)
    const orderCount = ords.length
    const avgOrder = orderCount ? Math.round(orderRevenue/orderCount) : 0

    // Top ürünler (item_view bazlı)
    const itemViews = {}
    ev.filter(e=>e.event_type==='item_view').forEach(e=>{
      const id=e.event_data?.item_id; if(id) itemViews[id]=(itemViews[id]||0)+1
    })
    const topItemIds = Object.entries(itemViews).sort((a,b)=>b[1]-a[1]).slice(0,8)
    let topProducts = []
    if (topItemIds.length){
      const { data: mi } = await supabase.from('menu_items').select('id,name_tr,name_en,name_ka,image_url').in('id', topItemIds.map(x=>x[0]))
      topProducts = topItemIds.map(([id,views])=>{
        const item=(mi||[]).find(m=>m.id===id)
        return { name:item?.name_tr||item?.name_en||item?.name_ka||'?', image:item?.image_url, views }
      })
    }
    const topMax = topProducts[0]?.views || 1

    // İçgörüler (otomatik)
    const insights = []
    if (qrPct < 30 && totalSrc > 5) insights.push({ type:'warn', text:`Trafiğin yalnızca %${qrPct}'i QR ile başlıyor — masa QR yerleşimini gözden geçir.` })
    if (funnelViews > 0 && funnelCat/Math.max(funnelViews,1) < 0.4) insights.push({ type:'warn', text:`Ziyaretçilerin çoğu ana sayfadan ilerlemiyor — hero ve kategori kartlarını daha çekici yap.` })
    if (topProducts[0]) insights.push({ type:'up', text:`"${topProducts[0].name}" bu dönem en çok görüntülenen ürün — menüde öne çıkarmayı düşün.` })
    if (orderCount > 0) insights.push({ type:'up', text:`${orderCount} sipariş · ${orderRevenue.toLocaleString('tr-TR')} ₾ ciro — ortalama sepet ${avgOrder} ₾.` })
    if (insights.length===0) insights.push({ type:'info', text:'Henüz yeterli veri yok. Müşteriler menüyü kullandıkça içgörüler burada belirecek.' })

    setData({
      totalViews, uniqueVisitors, viewTrend, orderCount, orderRevenue, avgOrder,
      devices, sources, qrPct, langs, trafficData, heat, heatMax,
      funnel: { views:funnelViews, cat:funnelCat, item:funnelItem, order:funnelOrder },
      topProducts, topMax, insights,
    })
    setLoading(false)
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
      <div style={{width:32,height:32,border:`3px solid #e8e8e4`,borderTop:`3px solid ${G}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{color:'#aaa',fontSize:13}}>Analitik yükleniyor...</span>
    </div>
  )

  const d = data
  const langNames = { ka:'🇬🇪 Gürcüce', en:'🇬🇧 İngilizce', tr:'🇹🇷 Türkçe', ru:'🇷🇺 Rusça' }

  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      {/* Başlık + filtreler */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16,marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Analitik</h1>
          <p style={{fontSize:13,color:'#aaa'}}>Menü trafiği, popüler ürünler ve ziyaretçi dağılımı</p>
        </div>
        <div style={{display:'flex',gap:6,background:'#fff',border:'1px solid #e8e8e4',borderRadius:10,padding:4}}>
          {RANGES.map(r=>(
            <button key={r.key} onClick={()=>setRange(r.key)}
              style={{fontSize:12,fontWeight:700,padding:'6px 14px',borderRadius:7,border:'none',cursor:'pointer',
                background:range===r.key?G:'transparent',color:range===r.key?'#fff':'#666'}}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Sekmeler */}
      <div style={{display:'flex',gap:4,borderBottom:'1px solid #e8e8e4',marginBottom:24}}>
        {TABS.map(tb=>(
          <button key={tb.key} onClick={()=>setTab(tb.key)}
            style={{fontSize:13,fontWeight:700,padding:'10px 16px',border:'none',background:'none',cursor:'pointer',
              color:tab===tb.key?G:'#999',borderBottom:tab===tb.key?`2px solid ${G}`:'2px solid transparent',marginBottom:-1}}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* İçgörüler (her sekmede üstte) */}
      <div style={{background:'linear-gradient(135deg,#f0fdf9,#ecfdf5)',border:'1px solid #d1fae5',borderRadius:14,padding:'18px 20px',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <span style={{fontSize:16}}>✨</span>
          <h3 style={{fontSize:14,fontWeight:800}}>Bu Dönemin İçgörüleri</h3>
          <span style={{fontSize:10,color:G,background:'#d1fae5',padding:'2px 8px',borderRadius:20,fontWeight:600}}>otomatik</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {d.insights.map((ins,i)=>(
            <div key={i} style={{display:'flex',gap:8,fontSize:13,color:'#444',lineHeight:1.5,background:'#fff',borderRadius:10,padding:'12px 14px'}}>
              <span>{ins.type==='warn'?'⚠️':ins.type==='up'?'📈':'💡'}</span>
              <span dangerouslySetInnerHTML={{__html: ins.text.replace(/"([^"]+)"/g,'<strong>$1</strong>').replace(/%(\d+)/g,'<strong>%$1</strong>')}}/>
            </div>
          ))}
        </div>
      </div>

      {/* ── GENEL BAKIŞ ── */}
      {tab==='overview' && <>
        {/* KPI kartları */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
          <KPI label="GÖRÜNTÜLENME" val={d.totalViews} trend={d.viewTrend} sub={`${d.uniqueVisitors} tekil ziyaretçi`} color={G}/>
          <KPI label="TEKİL ZİYARETÇİ" val={d.uniqueVisitors} sub="benzersiz oturum" color="#3b82f6"/>
          <KPI label="SİPARİŞ" val={d.orderCount} sub={`${d.orderRevenue.toLocaleString('tr-TR')} ₾ ciro`} color="#8b5cf6"/>
          <KPI label="ORT. SEPET" val={`${d.avgOrder} ₾`} sub="sipariş başına" color="#f59e0b"/>
        </div>

        {/* Trafik grafiği */}
        <Card title="Günlük Trafik" sub={`Son ${range} gün`}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={d.trafficData} margin={{top:10,right:10,left:-15,bottom:0}}>
              <defs>
                <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G} stopOpacity={0.25}/><stop offset="95%" stopColor={G} stopOpacity={0}/></linearGradient>
                <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{fontSize:9,fill:'#bbb'}} tickLine={false} axisLine={false} interval={Math.floor(range/8)}/>
              <YAxis tick={{fontSize:9,fill:'#bbb'}} tickLine={false} axisLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{border:'1px solid #e8e8e4',borderRadius:8,fontSize:12}}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Area type="monotone" dataKey="views" name="Görüntüleme" stroke={G} strokeWidth={2} fill="url(#gv)" dot={false}/>
              <Area type="monotone" dataKey="visitors" name="Tekil Ziyaretçi" stroke="#3b82f6" strokeWidth={2} fill="url(#gu)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Saatlik yoğunluk heatmap */}
        <Card title="Saatlik Yoğunluk" sub={`Son ${range} gün · gün × saat`}>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'separate',borderSpacing:3,fontSize:9}}>
              <thead><tr><th></th>{Array.from({length:24},(_,h)=>(
                <th key={h} style={{color:'#bbb',fontWeight:600,fontSize:8,padding:'0 1px'}}>{String(h).padStart(2,'0')}</th>
              ))}</tr></thead>
              <tbody>
                {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map((day,wd)=>(
                  <tr key={wd}>
                    <td style={{color:'#888',fontWeight:700,fontSize:10,paddingRight:6,whiteSpace:'nowrap'}}>{day}</td>
                    {d.heat[wd].map((v,h)=>{
                      const op = v===0?0.05:0.15+(v/d.heatMax)*0.85
                      return <td key={h} title={`${day} ${h}:00 — ${v}`} style={{width:18,height:18,borderRadius:4,background:`rgba(29,158,117,${op})`}}/>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Menü hunisi */}
        <Card title="Menü Hunisi" sub="Ziyaretçi menüde nereye kadar ilerliyor">
          {[
            { label:'Sayfa Görüntüleme', val:d.funnel.views, color:G },
            { label:'Kategori İnceleme', val:d.funnel.cat, color:'#3b82f6' },
            { label:'Ürün Detayı', val:d.funnel.item, color:'#8b5cf6' },
            { label:'Sipariş', val:d.funnel.order, color:'#f59e0b' },
          ].map((f,i,arr)=>{
            const max = arr[0].val || 1
            const pct = Math.round(f.val/max*100)
            return (
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#444'}}>{f.label}</span>
                  <span style={{fontSize:12,fontWeight:700,color:f.color}}>{f.val} <span style={{color:'#bbb',fontWeight:400}}>(%{pct})</span></span>
                </div>
                <div style={{height:10,background:'#f4f4f2',borderRadius:5,overflow:'hidden'}}>
                  <div style={{width:`${pct}%`,height:'100%',background:f.color,borderRadius:5,transition:'width .4s'}}/>
                </div>
              </div>
            )
          })}
        </Card>
      </>}

      {/* ── ÜRÜNLER ── */}
      {tab==='products' && (
        <Card title="En Çok Görüntülenen Ürünler" sub={`Son ${range} gün`}>
          {d.topProducts.length===0
            ? <Empty text="Henüz ürün görüntüleme verisi yok"/>
            : d.topProducts.map((p,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                <span style={{fontSize:13,fontWeight:800,color:'#ddd',width:18,textAlign:'center'}}>{i+1}</span>
                {p.image
                  ? <img src={p.image} alt="" style={{width:40,height:40,borderRadius:8,objectFit:'cover',flexShrink:0}}/>
                  : <div style={{width:40,height:40,borderRadius:8,background:'#f4f4f2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>🍽️</div>}
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600,marginBottom:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</p>
                  <div style={{height:6,background:'#f4f4f2',borderRadius:3}}>
                    <div style={{height:'100%',background:G,borderRadius:3,width:`${Math.round(p.views/d.topMax*100)}%`}}/>
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:800,color:G}}>{p.views}</span>
                  <p style={{fontSize:9,color:'#bbb'}}>görüntüleme</p>
                </div>
              </div>
            ))}
        </Card>
      )}

      {/* ── ZİYARETÇİLER ── */}
      {tab==='visitors' && <>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          {/* Cihaz */}
          <Card title="Cihaz Dağılımı" noPad>
            <div style={{padding:'0 20px 20px'}}>
              {[
                { k:'mobile', label:'📱 Mobil', color:G },
                { k:'tablet', label:'📲 Tablet', color:'#8b5cf6' },
                { k:'desktop', label:'💻 Masaüstü', color:'#3b82f6' },
              ].map(dev=>{
                const tot = (d.devices.mobile||0)+(d.devices.tablet||0)+(d.devices.desktop||0)
                const pct = tot ? Math.round((d.devices[dev.k]||0)/tot*100) : 0
                return (
                  <div key={dev.k} style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <span style={{fontSize:13,color:'#444'}}>{dev.label}</span>
                      <span style={{fontSize:13,fontWeight:700,color:dev.color}}>%{pct}</span>
                    </div>
                    <div style={{height:8,background:'#f4f4f2',borderRadius:4}}>
                      <div style={{width:`${pct}%`,height:'100%',background:dev.color,borderRadius:4}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Kaynak */}
          <Card title="Giriş Noktası" noPad>
            <div style={{padding:'0 20px 20px',display:'flex',alignItems:'center',justifyContent:'space-around',height:'calc(100% - 50px)'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:32,fontWeight:900,color:G}}>%{d.qrPct}</div>
                <p style={{fontSize:12,color:'#888',marginTop:4}}>📷 QR ile</p>
                <p style={{fontSize:10,color:'#bbb'}}>{d.sources.qr||0} oturum</p>
              </div>
              <div style={{width:1,height:60,background:'#eee'}}/>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:32,fontWeight:900,color:'#94a3b8'}}>%{100-d.qrPct}</div>
                <p style={{fontSize:12,color:'#888',marginTop:4}}>🔗 Direkt</p>
                <p style={{fontSize:10,color:'#bbb'}}>{d.sources.direct||0} oturum</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Dil dağılımı */}
        <Card title="Dil Tercihi" sub="Ziyaretçilerin menüyü görüntülediği dil">
          {Object.keys(d.langs).length===0
            ? <Empty text="Henüz dil verisi yok"/>
            : Object.entries(d.langs).sort((a,b)=>b[1]-a[1]).map(([lng,cnt])=>{
              const tot=Object.values(d.langs).reduce((s,x)=>s+x,0)
              const pct=tot?Math.round(cnt/tot*100):0
              return (
                <div key={lng} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{fontSize:13,color:'#444'}}>{langNames[lng]||lng}</span>
                    <span style={{fontSize:13,fontWeight:700,color:G}}>%{pct} <span style={{color:'#bbb',fontWeight:400}}>({cnt})</span></span>
                  </div>
                  <div style={{height:8,background:'#f4f4f2',borderRadius:4}}>
                    <div style={{width:`${pct}%`,height:'100%',background:G,borderRadius:4}}/>
                  </div>
                </div>
              )
            })}
        </Card>
      </>}
    </div>
  )
}

function KPI({ label, val, trend, sub, color }) {
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
      <p style={{fontSize:26,fontWeight:900,color,lineHeight:1}}>{typeof val==='number'?val.toLocaleString('tr-TR'):val}</p>
      <p style={{fontSize:11,color:'#bbb',marginTop:4}}>{sub}</p>
    </div>
  )
}

function Card({ title, sub, children, noPad }) {
  return (
    <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:14,padding:noPad?'20px 0 0':20,marginBottom:16}}>
      <div style={{marginBottom:16,padding:noPad?'0 20px':0}}>
        <h3 style={{fontSize:14,fontWeight:700}}>{title}</h3>
        {sub && <p style={{fontSize:12,color:'#aaa',marginTop:2}}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }) {
  return <p style={{fontSize:13,color:'#ccc',textAlign:'center',padding:'30px 0'}}>{text}</p>
}
