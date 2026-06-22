import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

const STATUS_COLOR = { pending:'#f59e0b', confirmed:'#3b82f6', preparing:'#8b5cf6', ready:'#1D9E75' }
const STATUS_LABEL = { pending:'Bekliyor', confirmed:'Onaylandı', preparing:'Hazırlanıyor', ready:'Hazır' }

export default function KitchenPanel() {
  const { profile, signOut } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [audio] = useState(() => typeof Audio !== 'undefined' ? new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA...') : null)

  useEffect(() => {
    if (!profile?.restaurant_id) return
    loadOrders()

    const channel = supabase
      .channel('kitchen-' + profile.restaurant_id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${profile.restaurant_id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Yeni sipariş sesi
          try { new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3').play() } catch(e) {}
        }
        loadOrders()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.restaurant_id])

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select(`*, 
        tables(table_number, label),
        order_items(*, menu_item:menu_items(name_tr, name_en, name_ka, goes_to_kitchen))
      `)
      .eq('restaurant_id', profile.restaurant_id)
      .in('order_status', ['pending', 'confirmed', 'preparing'])
      .order('created_at', { ascending: true })

    // Sadece mutfağa giden ürünü olan siparişleri göster
    const kitchenOrders = (data || []).filter(order =>
      order.order_items?.some(oi => oi.menu_item?.goes_to_kitchen !== false)
    )
    setOrders(kitchenOrders)
    setLoading(false)
  }

  async function updateStatus(orderId, status) {
    await supabase.from('orders').update({ order_status: status }).eq('id', orderId)
    loadOrders()
  }

  const nextStatus = { pending:'preparing', preparing:'ready' }
  const nextLabel  = { pending:'Hazırlamaya Başla', preparing:'Hazır!' }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f0f0f',gap:12}}>
      <div style={{width:32,height:32,border:'3px solid #333',borderTop:'3px solid #1D9E75',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0f0f0f',fontFamily:'Inter,system-ui,sans-serif',color:'#fff'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <header style={{background:'#1a1a1a',borderBottom:'1px solid #2a2a2a',padding:'14px 20px',
        display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>👨‍🍳</span>
          <h1 style={{fontSize:17,fontWeight:700,margin:0}}>Mutfak Paneli</h1>
          {orders.length > 0 && (
            <span style={{background:'#E8192C',color:'#fff',fontSize:11,fontWeight:700,
              padding:'3px 10px',borderRadius:20}}>
              {orders.length} aktif
            </span>
          )}
        </div>
        <button onClick={signOut}
          style={{background:'transparent',border:'1px solid rgba(255,255,255,.2)',padding:'6px 14px',
            borderRadius:8,fontSize:12,color:'#fff',fontWeight:600,cursor:'pointer'}}>
          Çıkış
        </button>
      </header>

      {/* Content */}
      <div style={{padding:20}}>
        {orders.length === 0 ? (
          <div style={{textAlign:'center',padding:'80px 20px',color:'#444'}}>
            <div style={{fontSize:48,marginBottom:12}}>🎉</div>
            <p style={{fontSize:16,fontWeight:600}}>Bekleyen sipariş yok</p>
            <p style={{fontSize:13,color:'#333',marginTop:6}}>Yeni siparişler otomatik görünecek</p>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
            {orders.map((order, idx) => {
              const kitchenItems = order.order_items?.filter(oi => oi.menu_item?.goes_to_kitchen !== false)
              return (
                <div key={order.id}
                  style={{background:'#1a1a1a',border:`1px solid ${STATUS_COLOR[order.order_status]||'#333'}`,
                    borderRadius:16,overflow:'hidden',animation:`fadeIn .3s ease ${idx*.05}s both`}}>
                  
                  {/* Kart header */}
                  <div style={{background:'#222',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <p style={{fontSize:20,fontWeight:900,color:'#fff',margin:0}}>
                        Masa {order.tables?.table_number}
                        {order.tables?.label && <span style={{fontSize:13,fontWeight:400,color:'#666',marginLeft:6}}>— {order.tables.label}</span>}
                      </p>
                      <p style={{fontSize:11,color:'#555',margin:'2px 0 0'}}>
                        {formatDistanceToNow(new Date(order.created_at), {addSuffix:true, locale:tr})}
                      </p>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:STATUS_COLOR[order.order_status],
                      background:STATUS_COLOR[order.order_status]+'22',padding:'4px 12px',borderRadius:20}}>
                      {STATUS_LABEL[order.order_status]}
                    </span>
                  </div>

                  {/* Ürünler — sadece mutfağa gidenler */}
                  <div style={{padding:'12px 16px'}}>
                    {kitchenItems?.map(oi => (
                      <div key={oi.id} style={{display:'flex',justifyContent:'space-between',
                        padding:'8px 0',borderBottom:'1px solid #222',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{width:24,height:24,background:'#1D9E75',borderRadius:6,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>
                            {oi.quantity}
                          </span>
                          <span style={{fontSize:13,color:'#ddd'}}>
                            {oi.menu_item?.name_tr || oi.menu_item?.name_en || oi.menu_item?.name_ka}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Not */}
                    {order.note && (
                      <div style={{marginTop:10,background:'#2a2a1a',border:'1px solid #f59e0b33',
                        borderRadius:8,padding:'8px 12px'}}>
                        <p style={{fontSize:11,color:'#f59e0b',fontWeight:600,marginBottom:2}}>📝 Not</p>
                        <p style={{fontSize:12,color:'#ccc'}}>{order.note}</p>
                      </div>
                    )}
                  </div>

                  {/* Aksiyon butonu */}
                  {nextStatus[order.order_status] && (
                    <div style={{padding:'0 16px 16px'}}>
                      <button onClick={() => updateStatus(order.id, nextStatus[order.order_status])}
                        style={{width:'100%',background: order.order_status==='preparing'?'#1D9E75':'#3b82f6',
                          color:'#fff',border:'none',padding:'12px',borderRadius:10,
                          fontSize:14,fontWeight:700,cursor:'pointer',
                          boxShadow:`0 4px 16px ${order.order_status==='preparing'?'#1D9E75':'#3b82f6'}44`}}>
                        {nextLabel[order.order_status]}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
