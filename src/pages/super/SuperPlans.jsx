import { PLANS, AI_ADDON } from '../../lib/plans'

export default function SuperPlans() {
  const plans = [PLANS.basic, PLANS.advanced]

  return (
    <div style={{maxWidth:1000,margin:'0 auto'}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Paketler</h1>
        <p style={{fontSize:13,color:'#aaa'}}>Satışa sunulan abonelik paketleri (yıllık)</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
        {plans.map(p => (
          <div key={p.key} style={{background:'#fff',border:`2px solid ${p.color}`,borderRadius:18,
            overflow:'hidden'}}>
            <div style={{background:p.bg,padding:'20px 24px',borderBottom:`1px solid ${p.color}22`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h2 style={{fontSize:18,fontWeight:800,color:p.color}}>{p.name}</h2>
                <span style={{fontSize:11,fontWeight:600,color:'#888'}}>{p.name_en}</span>
              </div>
              <p style={{fontSize:12,color:'#888',marginTop:4}}>{p.tagline}</p>
              <div style={{marginTop:12,display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontSize:34,fontWeight:900,color:'#222'}}>{p.price}</span>
                <span style={{fontSize:16,fontWeight:700,color:p.color}}>{p.currency}</span>
                <span style={{fontSize:13,color:'#aaa'}}>/ {p.period}</span>
              </div>
            </div>
            <div style={{padding:'18px 24px'}}>
              {p.features.map((f,i)=>(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:10}}>
                  <span style={{color:p.color,fontWeight:700,flexShrink:0}}>✓</span>
                  <span style={{fontSize:13,color:'#555',lineHeight:1.4}}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* AI Eklenti */}
      <div style={{background:'linear-gradient(135deg,#8b5cf6,#6d28d9)',borderRadius:18,padding:'24px 28px',color:'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16}}>
          <div style={{flex:1,minWidth:240}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{fontSize:22}}>✨</span>
              <h2 style={{fontSize:18,fontWeight:800}}>{AI_ADDON.name}</h2>
              <span style={{background:'rgba(255,255,255,0.2)',fontSize:10,fontWeight:700,
                padding:'2px 8px',borderRadius:20}}>EKLENTİ</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:12}}>
              {AI_ADDON.features.map((f,i)=>(
                <span key={i} style={{fontSize:12,background:'rgba(255,255,255,0.15)',
                  padding:'5px 12px',borderRadius:20}}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{display:'flex',alignItems:'baseline',gap:4,justifyContent:'flex-end'}}>
              <span style={{fontSize:32,fontWeight:900}}>+{AI_ADDON.price}</span>
              <span style={{fontSize:15,fontWeight:700}}>{AI_ADDON.currency}</span>
            </div>
            <p style={{fontSize:12,opacity:0.8}}>/ {AI_ADDON.period}</p>
          </div>
        </div>
      </div>

      <div style={{marginTop:20,padding:14,background:'#f9f9f7',border:'1px solid #eee',borderRadius:12}}>
        <p style={{fontSize:12,color:'#888',lineHeight:1.5}}>
          💡 Fiyatlar <code style={{background:'#fff',padding:'1px 6px',borderRadius:4}}>src/lib/plans.js</code> dosyasından yönetilir.
          Firma eklerken bu paketler ve AI eklentisi seçilebilir.
        </p>
      </div>
    </div>
  )
}
