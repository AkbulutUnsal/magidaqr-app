import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

export default function WaiterPanel() {
  const { profile, signOut } = useAuth()
  const [orders, setOrders] = useState([])   // hazır + içecek siparişleri
  const [calls, setCalls]   = useState([])   // garson/hesap çağrıları
  const [tab, setTab]       = useState('calls')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.restaurant_id) return
    loadAll()

    const ch1 = supabase.channel('waiter-orders-' + profile.restaurant_id)
      .on('postgres_changes', { event:'*', schema:'public', table:'orders',
        filter:`restaurant_id=eq.${profile.restaurant_id}` }, loadAll)
      .subscribe()

    const ch2 = supabase.channel('waiter-calls-' + profile.restaurant_id)
      .on('postgres_changes', { event:'*', schema:'public', table:'table_calls',
        filter:`restaurant_id=eq.${profile.restaurant_id}` }, loadAll)
      .subscribe()

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [profile?.restaurant_id])

  async function loadAll() {
    const rid = profile.restaurant_id

    // 1. Siparişler: hem "ready" hem de içecek olan "pending/preparing"
    const { data: allOrders } = await supabase
      .from('orders')
      .select(`*, tables(table_number, label),
        order_items(*, menu_item:menu_items(name_tr, name_en, name_ka, goes_to_kitchen))`)
      .eq('restaurant_id', rid)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    // Garsona görünecek siparişler:
    // - "ready" olanlar (mutfaktan çıktı)
    // - içecek içeren pending/preparing (mutfağa gitmeyen ürünler)
    const waiterOrders = (allOrders || []).filter(order => {
      if (order.status === 'ready') return true
      // pending/preparing ise sadece mutfağa GİTMEYEN ürünü varsa göster
      return order.order_items?.some(oi => oi.menu_item?.goes_to_kitchen === false)
    })

    setOrders(waiterOrders)

    // 2. Çağrılar
    const { data: callData } = await supabase
      .from('table_calls')
      .select('*, tables(table_number, label)')
      .eq('restaurant_id', rid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    setCalls(callData || [])
    setLoading(false)
  }

  async function dismissCall(id) {
    await supabase.from('table_calls').update({ status:'acknowledged' }).eq('id', id)
    loadAll()
  }

  async function serveOrder(orderId) {
    await supabase.from('orders').update({ status:'served' }).eq('id', orderId)
    loadAll()
  }

  // İçecek siparişinde sadece mutfağa gitmeyen ürünleri göster
  const getWaiterItems = (order) => {
    if (order.status === 'ready') return order.order_items // hepsini göster
    return order.order_items?.filter(oi => oi.menu_item?.goes_to_kitchen === false)
  }

  const waiterCalls = calls.filter(c => c.type === 'waiter')
  const billCalls   = calls.filter(c => c.type === 'bill')
  const totalCalls  = calls.length
  const totalOrders = orders.length

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f0f0f'}}>
      <div style={{width:32,height:32,border:'3px solid #333',borderTop:'3px solid #1D9E75',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0f0f0f',fontFamily:'Inter,system-ui,sans-serif',color:'#fff'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Header */}
      <header style={{background:'#1a1a1a',borderBottom:'1px solid #2a2a2a',padding:'14px 20px',
        display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>🛎</span>
          <h1 style={{fontSize:17,fontWeight:700,margin:0}}>Garson Paneli</h1>
          {(totalCalls > 0 || totalOrders > 0) && (
            <span style={{background:'#E8192C',color:'#fff',fontSize:11,fontWeight:700,
              padding:'3px 10px',borderRadius:20,animation:'pulse 1.5s infinite'}}>
              {totalCalls + totalOrders}
            </span>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12,color:'#555'}}>{profile?.full_name}</span>
          <button onClick={signOut}
            style={{background:'transparent',border:'1px solid rgba(255,255,255,.2)',padding:'6px 14px',
              borderRadius:8,fontSize:12,color:'#fff',fontWeight:600,cursor:'pointer'}}>
            Çıkış
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{background:'#161616',borderBottom:'1px solid #222',padding:'0 20px',display:'flex',gap:4}}>
        {[
          {key:'calls',  label:'Çağrılar',   count:totalCalls},
          {key:'orders', label:'Siparişler',  count:totalOrders},
        ].map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{padding:'12px 16px',background:'transparent',border:'none',
              borderBottom:tab===t.key?'2px solid #1D9E75':'2px solid transparent',
              color:tab===t.key?'#1D9E75':'#555',fontSize:13,fontWeight:600,cursor:'pointer',
              display:'flex',alignItems:'center',gap:8}}>
            {t.label}
            {t.count > 0 && (
              <span style={{background:tab===t.key?'#1D9E75':'#333',color:'#fff',
                fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20}}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{padding:20}}>

        {/* ── ÇAĞRILAR ── */}
        {tab === 'calls' && (
          <div>
            {calls.length === 0 ? (
              <div style={{textAlign:'center',padding:'80px 20px',color:'#444'}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <p style={{fontSize:15}}>Bekleyen çağrı yok</p>
              </div>
            ) : (
              <>
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
                  <button onClick={async()=>{
                    await supabase.from('table_calls').update({status:'acknowledged'})
                      .eq('restaurant_id',profile.restaurant_id).eq('status','pending')
                    loadAll()
                  }} style={{fontSize:11,color:'#666',background:'transparent',border:'1px solid #333',
                    padding:'5px 12px',borderRadius:8,cursor:'pointer'}}>
                    Tümünü kapat
                  </button>
                </div>

                {/* Garson çağrıları */}
                {waiterCalls.length > 0 && (
                  <div style={{marginBottom:24}}>
                    <p style={{fontSize:11,fontWeight:700,color:'#1D9E75',textTransform:'uppercase',
                      letterSpacing:'.06em',marginBottom:10}}>🔔 Garson Çağrısı ({waiterCalls.length})</p>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                      {waiterCalls.map(call=>(
                        <div key={call.id} style={{background:'#0d2018',border:'1px solid #1D9E75',
                          borderRadius:14,padding:18,animation:'fadeIn .3s ease'}}>
                          <p style={{fontSize:24,fontWeight:900,color:'#1D9E75',marginBottom:4}}>
                            Masa {call.tables?.table_number}
                          </p>
                          {call.tables?.label && <p style={{fontSize:11,color:'#555',marginBottom:8}}>{call.tables.label}</p>}
                          <p style={{fontSize:11,color:'#555',marginBottom:12}}>
                            {formatDistanceToNow(new Date(call.created_at),{addSuffix:true,locale:tr})}
                          </p>
                          <button onClick={()=>dismissCall(call.id)}
                            style={{width:'100%',background:'#1D9E75',color:'#fff',border:'none',
                              padding:'9px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                            ✓ Gidiyorum
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hesap çağrıları */}
                {billCalls.length > 0 && (
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:'#f59e0b',textTransform:'uppercase',
                      letterSpacing:'.06em',marginBottom:10}}>🧾 Hesap İsteniyor ({billCalls.length})</p>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                      {billCalls.map(call=>(
                        <div key={call.id} style={{background:'#1a1505',border:'1px solid #f59e0b',
                          borderRadius:14,padding:18,animation:'fadeIn .3s ease'}}>
                          <p style={{fontSize:24,fontWeight:900,color:'#f59e0b',marginBottom:4}}>
                            Masa {call.tables?.table_number}
                          </p>
                          {call.tables?.label && <p style={{fontSize:11,color:'#666',marginBottom:8}}>{call.tables.label}</p>}
                          <p style={{fontSize:11,color:'#666',marginBottom:12}}>
                            {formatDistanceToNow(new Date(call.created_at),{addSuffix:true,locale:tr})}
                          </p>
                          <button onClick={()=>dismissCall(call.id)}
                            style={{width:'100%',background:'#f59e0b',color:'#000',border:'none',
                              padding:'9px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                            ✓ Hesabı Götür
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── SİPARİŞLER ── */}
        {tab === 'orders' && (
          <div>
            {orders.length === 0 ? (
              <div style={{textAlign:'center',padding:'80px 20px',color:'#444'}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <p style={{fontSize:15}}>Servis edilecek sipariş yok</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
                {orders.map((order,idx)=>{
                  const items = getWaiterItems(order)
                  const isReady = order.status === 'ready'
                  const isDrinkOnly = order.order_items?.every(oi => oi.menu_item?.goes_to_kitchen === false)
                  return (
                    <div key={order.id}
                      style={{background:'#1a1a1a',border:`1px solid ${isReady?'#1D9E75':'#f59e0b'}`,
                        borderRadius:14,overflow:'hidden',animation:`fadeIn .3s ease ${idx*.05}s both`}}>
                      <div style={{background:'#222',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <p style={{fontSize:20,fontWeight:900,color:'#fff',margin:0}}>
                            Masa {order.tables?.table_number}
                          </p>
                          <p style={{fontSize:11,color:'#555',margin:'2px 0 0'}}>
                            {formatDistanceToNow(new Date(order.created_at),{addSuffix:true,locale:tr})}
                          </p>
                        </div>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,
                          color:isReady?'#1D9E75':'#f59e0b',
                          background:isReady?'#1D9E7522':'#f59e0b22'}}>
                          {isReady ? '✓ HAZIR' : isDrinkOnly ? '🥤 İÇECEK' : '⏳ BEKLİYOR'}
                        </span>
                      </div>
                      <div style={{padding:'12px 16px'}}>
                        {items?.map(oi=>(
                          <div key={oi.id} style={{display:'flex',alignItems:'center',gap:8,
                            padding:'6px 0',borderBottom:'1px solid #222'}}>
                            <span style={{width:22,height:22,background:isReady?'#1D9E75':'#f59e0b',
                              borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}}>
                              {oi.quantity}
                            </span>
                            <span style={{fontSize:13,color:'#ccc'}}>
                              {oi.menu_item?.name_tr||oi.menu_item?.name_en||oi.menu_item?.name_ka}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{padding:'0 16px 14px'}}>
                        <button onClick={()=>serveOrder(order.id)}
                          style={{width:'100%',background:isReady?'#1D9E75':'#f59e0b',
                            color:isReady?'#fff':'#000',border:'none',padding:'11px',borderRadius:10,
                            fontSize:13,fontWeight:700,cursor:'pointer'}}>
                          ✓ Servis Edildi
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
