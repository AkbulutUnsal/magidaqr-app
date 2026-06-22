import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useOrders } from '../../hooks/useOrders'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

const WAITER_STATUSES = ['ready']

export default function WaiterPanel() {
  const { profile, signOut } = useAuth()
  const { orders, loading, updateStatus } = useOrders(profile?.restaurant_id, WAITER_STATUSES)
  const [calls, setCalls] = useState([])
  const [tab, setTab] = useState('calls') // 'calls' | 'orders'

  useEffect(() => {
    if (!profile?.restaurant_id) return
    loadCalls()

    const channel = supabase
      .channel('waiter-calls-' + profile.restaurant_id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'table_calls',
        filter: `restaurant_id=eq.${profile.restaurant_id}`
      }, () => loadCalls())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.restaurant_id])

  async function loadCalls() {
    const { data } = await supabase
      .from('table_calls')
      .select('*, tables(table_number, label)')
      .eq('restaurant_id', profile.restaurant_id)
      .in('call_status', ['pending'])
      .order('created_at', { ascending: false })
    setCalls(data || [])
  }

  async function dismissCall(id) {
    await supabase.from('table_calls').update({ call_status: 'acknowledged' }).eq('id', id)
    loadCalls()
  }

  async function dismissAllCalls() {
    await supabase.from('table_calls')
      .update({ call_status: 'acknowledged' })
      .eq('restaurant_id', profile.restaurant_id)
      .eq('call_status', 'pending')
    loadCalls()
  }

  const waiterCalls = calls.filter(c => c.type === 'waiter')
  const billCalls   = calls.filter(c => c.type === 'bill')
  const totalCalls  = calls.length

  return (
    <div style={{ minHeight:'100vh', background:'#0f0f0f', fontFamily:'Inter,system-ui,sans-serif', color:'#fff' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        .call-card:hover { transform:translateY(-2px) }
      `}</style>

      {/* Header */}
      <header style={{ background:'#1a1a1a', borderBottom:'1px solid #2a2a2a', padding:'14px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>🛎</span>
          <h1 style={{ fontSize:17, fontWeight:700, margin:0 }}>Garson Paneli</h1>
          {totalCalls > 0 && (
            <span style={{ background:'#E8192C', color:'#fff', fontSize:11, fontWeight:700,
              padding:'3px 10px', borderRadius:20, animation:'pulse 1.5s infinite' }}>
              {totalCalls} çağrı
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:'#666' }}>{profile?.full_name}</span>
          <button onClick={signOut}
            style={{ background:'transparent', border:'1px solid rgba(255,255,255,.2)', padding:'6px 14px',
              borderRadius:8, fontSize:12, color:'#fff', fontWeight:600, cursor:'pointer' }}>
            Çıkış
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ background:'#161616', borderBottom:'1px solid #222', padding:'0 20px', display:'flex', gap:4 }}>
        {[
          { key:'calls',  label:`Çağrılar`,  count: totalCalls },
          { key:'orders', label:`Siparişler`, count: orders.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'12px 16px', background:'transparent', border:'none',
              borderBottom: tab===t.key ? '2px solid #1D9E75' : '2px solid transparent',
              color: tab===t.key ? '#1D9E75' : '#666', fontSize:13, fontWeight:600,
              cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: tab===t.key ? '#1D9E75' : '#333', color:'#fff',
                fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding:20 }}>

        {/* ── Çağrılar tab ── */}
        {tab === 'calls' && (
          <div>
            {calls.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px 20px', color:'#444' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <p style={{ fontSize:15 }}>Bekleyen çağrı yok</p>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <p style={{ fontSize:13, color:'#666' }}>{calls.length} bekleyen çağrı</p>
                  <button onClick={dismissAllCalls}
                    style={{ fontSize:12, color:'#888', background:'transparent', border:'1px solid #333',
                      padding:'5px 12px', borderRadius:8, cursor:'pointer' }}>
                    Tümünü kapat
                  </button>
                </div>

                {/* Garson çağrıları */}
                {waiterCalls.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <h3 style={{ fontSize:12, fontWeight:700, color:'#1D9E75', textTransform:'uppercase',
                      letterSpacing:'.06em', marginBottom:12 }}>
                      🔔 Garson Çağrısı ({waiterCalls.length})
                    </h3>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                      {waiterCalls.map(call => (
                        <div key={call.id} className="call-card"
                          style={{ background:'#1a2a1a', border:'1px solid #1D9E75', borderRadius:14,
                            padding:18, transition:'transform .2s', cursor:'default' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10 }}>
                            <div>
                              <p style={{ fontSize:22, fontWeight:900, color:'#1D9E75', lineHeight:1 }}>
                                Masa {call.tables?.table_number}
                              </p>
                              {call.tables?.label && (
                                <p style={{ fontSize:11, color:'#555', marginTop:2 }}>{call.tables.label}</p>
                              )}
                            </div>
                            <span style={{ fontSize:18 }}>🔔</span>
                          </div>
                          <p style={{ fontSize:11, color:'#555', marginBottom:12 }}>
                            {formatDistanceToNow(new Date(call.created_at), { addSuffix:true, locale:tr })}
                          </p>
                          <button onClick={() => dismissCall(call.id)}
                            style={{ width:'100%', background:'#1D9E75', color:'#fff', border:'none',
                              padding:'9px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
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
                    <h3 style={{ fontSize:12, fontWeight:700, color:'#f59e0b', textTransform:'uppercase',
                      letterSpacing:'.06em', marginBottom:12 }}>
                      🧾 Hesap İsteniyor ({billCalls.length})
                    </h3>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                      {billCalls.map(call => (
                        <div key={call.id} className="call-card"
                          style={{ background:'#2a2010', border:'1px solid #f59e0b', borderRadius:14,
                            padding:18, transition:'transform .2s', cursor:'default' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10 }}>
                            <div>
                              <p style={{ fontSize:22, fontWeight:900, color:'#f59e0b', lineHeight:1 }}>
                                Masa {call.tables?.table_number}
                              </p>
                              {call.tables?.label && (
                                <p style={{ fontSize:11, color:'#666', marginTop:2 }}>{call.tables.label}</p>
                              )}
                            </div>
                            <span style={{ fontSize:18 }}>🧾</span>
                          </div>
                          <p style={{ fontSize:11, color:'#666', marginBottom:12 }}>
                            {formatDistanceToNow(new Date(call.created_at), { addSuffix:true, locale:tr })}
                          </p>
                          <button onClick={() => dismissCall(call.id)}
                            style={{ width:'100%', background:'#f59e0b', color:'#000', border:'none',
                              padding:'9px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
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

        {/* ── Siparişler tab ── */}
        {tab === 'orders' && (
          <div>
            {orders.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px 20px', color:'#444' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <p style={{ fontSize:15 }}>Teslim bekleyen sipariş yok</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 }}>
                {orders.map(order => (
                  <div key={order.id}
                    style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:14, padding:18 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10 }}>
                      <div>
                        <p style={{ fontSize:20, fontWeight:900, color:'#1D9E75' }}>
                          Masa {order.table?.table_number}
                        </p>
                        <p style={{ fontSize:11, color:'#555', marginTop:2 }}>
                          #{order.id?.slice(0,6)}
                        </p>
                      </div>
                      <span style={{ background:'#1D9E75', color:'#fff', fontSize:10, fontWeight:700,
                        padding:'3px 10px', borderRadius:20 }}>HAZIR</span>
                    </div>
                    <ul style={{ listStyle:'none', marginBottom:14 }}>
                      {order.order_items?.map(oi => (
                        <li key={oi.id} style={{ fontSize:12, color:'#999', padding:'3px 0',
                          borderBottom:'1px solid #222', display:'flex', justifyContent:'space-between' }}>
                          <span>{oi.quantity}× {oi.menu_item?.name_en || oi.menu_item?.name_ka}</span>
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontSize:11, color:'#555', marginBottom:12 }}>
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix:true, locale:tr })}
                    </p>
                    <button onClick={() => updateStatus(order.id, 'served')}
                      style={{ width:'100%', background:'#1D9E75', color:'#fff', border:'none',
                        padding:'10px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      ✅ Servis Edildi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
