import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminDelivery() {
  const { profile } = useAuth()
  const [d, setD] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data } = await supabase.from('restaurants')
      .select('delivery_enabled,delivery_min_amount,delivery_fee,delivery_radius_km,delivery_note')
      .eq('id', profile.restaurant_id).single()
    setD(data || {})
  }

  async function save() {
    await supabase.from('restaurants').update({
      delivery_enabled: d.delivery_enabled ?? false,
      delivery_min_amount: parseFloat(d.delivery_min_amount) || 0,
      delivery_fee: parseFloat(d.delivery_fee) || 0,
      delivery_radius_km: parseFloat(d.delivery_radius_km) || 0,
      delivery_note: d.delivery_note || ''
    }).eq('id', profile.restaurant_id)
    setSaved(true); setTimeout(()=>setSaved(false), 2000)
  }

  const set = (k,v) => setD(p=>({...p,[k]:v}))
  const on = d.delivery_enabled

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Paket Servisi</h1>
        <button className="btn-primary" onClick={save}>{saved?'✓ Kaydedildi':'Kaydet'}</button>
      </div>

      <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:24,maxWidth:520}}>
        {/* Aç/kapat */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
          paddingBottom:18,borderBottom:'1px solid #f4f4f2',marginBottom:18}}>
          <div>
            <p style={{fontSize:15,fontWeight:700,color:'#222'}}>Paket Servisi Aktif</p>
            <p style={{fontSize:12,color:'#999',marginTop:2}}>Müşteriler eve sipariş verebilir</p>
          </div>
          <button onClick={()=>set('delivery_enabled', !on)}
            style={{width:50,height:28,borderRadius:20,border:'none',cursor:'pointer',position:'relative',
              background:on?'#1D9E75':'#ddd',transition:'background .2s'}}>
            <span style={{position:'absolute',top:3,left:on?25:3,width:22,height:22,borderRadius:'50%',
              background:'#fff',transition:'left .2s'}} />
          </button>
        </div>

        <div style={{opacity:on?1:0.4,pointerEvents:on?'auto':'none'}}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>
              Minimum Sipariş Tutarı (₾)
            </label>
            <input type="number" step="0.01" value={d.delivery_min_amount||''} onChange={e=>set('delivery_min_amount',e.target.value)}
              style={{width:'100%',padding:'10px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>
              Teslimat Ücreti (₾)
            </label>
            <input type="number" step="0.01" value={d.delivery_fee||''} onChange={e=>set('delivery_fee',e.target.value)}
              style={{width:'100%',padding:'10px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>
              Teslimat Yarıçapı (km)
            </label>
            <input type="number" step="0.5" value={d.delivery_radius_km||''} onChange={e=>set('delivery_radius_km',e.target.value)}
              style={{width:'100%',padding:'10px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>
              Teslimat Notu
            </label>
            <textarea value={d.delivery_note||''} onChange={e=>set('delivery_note',e.target.value)} rows={3}
              placeholder="Teslimat süresi ~45 dk, sadece nakit..."
              style={{width:'100%',padding:'10px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13,resize:'vertical'}} />
          </div>
        </div>
      </div>
    </div>
  )
}
