import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useOrders } from '../../hooks/useOrders'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

const WAITER_STATUSES = ['ready']

export default function WaiterPanel() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const { orders, loading, updateStatus } = useOrders(profile?.restaurant_id, WAITER_STATUSES)
  const [calls, setCalls] = useState([])
  const prevCallCount = useRef(0)

  useEffect(() => {
    if (!profile?.restaurant_id) return
    fetchCalls()

    const channel = supabase
      .channel(`calls-waiter-${profile.restaurant_id}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'table_calls',
        filter: `restaurant_id=eq.${profile.restaurant_id}`
      }, () => fetchCalls())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.restaurant_id])

  // Yeni çağrı sesi
  useEffect(() => {
    if (calls.length > prevCallCount.current) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
        osc.start(); osc.stop(ctx.currentTime + 0.6)
      } catch {}
    }
    prevCallCount.current = calls.length
  }, [calls.length])

  async function fetchCalls() {
    const { data } = await supabase
      .from('table_calls')
      .select('*, table:tables(table_number, label)')
      .eq('restaurant_id', profile.restaurant_id)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
    setCalls(data || [])
  }

  async function closeCall(id) {
    await supabase.from('table_calls').update({ status: 'closed' }).eq('id', id)
    fetchCalls()
  }

  if (loading) return <div className="page-loading">{t('loading')}</div>

  const waiterCalls = calls.filter(c => c.type === 'waiter')
  const billCalls   = calls.filter(c => c.type === 'bill')

  return (
    <div className="waiter-page">
      <header className="waiter-header">
        <h1>🛎 {t('waiter_panel')}</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {calls.length > 0 && (
            <div className="waiter-count" style={{ background:'#E24B4A', color:'#fff' }}>
              {calls.length} çağrı
            </div>
          )}
          <div className="waiter-count">{orders.length} teslim bekliyor</div>
        </div>
        <button onClick={signOut} className="sign-out-btn">{t('logout')}</button>
      </header>

      {/* Çağrılar */}
      {calls.length > 0 && (
        <div className="calls-section">
          {waiterCalls.length > 0 && (
            <div className="calls-group">
              <h3 className="calls-group-title">🛎 Garson çağrıları</h3>
              <div className="calls-grid">
                {waiterCalls.map(call => (
                  <div key={call.id} className="call-card waiter-call-card">
                    <div className="call-table">Masa {call.table?.table_number} — {call.table?.label}</div>
                    <div className="call-time">{formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}</div>
                    <button className="call-close-btn" onClick={() => closeCall(call.id)}>✅ Tamam</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {billCalls.length > 0 && (
            <div className="calls-group">
              <h3 className="calls-group-title">💳 Hesap istekleri</h3>
              <div className="calls-grid">
                {billCalls.map(call => (
                  <div key={call.id} className="call-card bill-call-card">
                    <div className="call-table">Masa {call.table?.table_number} — {call.table?.label}</div>
                    <div className="call-time">{formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}</div>
                    <button className="call-close-btn bill-close" onClick={() => closeCall(call.id)}>✅ Hesap verildi</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Teslim bekleyen siparişler */}
      <div className="waiter-orders-section">
        <h3 className="calls-group-title">🍽️ Teslim bekleyen siparişler</h3>
        {orders.length === 0 ? (
          <div className="empty-state"><p>✅ Teslim bekleyen sipariş yok</p></div>
        ) : (
          <div className="waiter-grid">
            {orders.map(order => (
              <div key={order.id} className="waiter-card">
                <div className="wcard-table">
                  🪑 Masa {order.table?.table_number}
                  {order.table?.label && <span className="wcard-label"> — {order.table.label}</span>}
                </div>
                <div className="wcard-num">#{order.order_number}</div>
                <div className="wcard-time">
                  {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })} hazırlandı
                </div>
                <ul className="wcard-items">
                  {order.order_items?.map(oi => (
                    <li key={oi.id}>{oi.quantity}× {oi.menu_item?.name_en}</li>
                  ))}
                </ul>
                <button className="wcard-serve-btn" onClick={() => updateStatus(order.id, 'served')}>
                  ✅ {t('mark_served')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
