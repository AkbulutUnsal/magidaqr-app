import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useOrders } from '../../hooks/useOrders'
import { formatDistanceToNow } from 'date-fns'

const KITCHEN_STATUSES = ['pending','confirmed','preparing']

const STATUS_COLOR = {
  pending: '#E24B4A',
  confirmed: '#BA7517',
  preparing: '#1D9E75',
}

export default function KitchenPanel() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const { orders, loading, updateStatus } = useOrders(profile?.restaurant_id, KITCHEN_STATUSES)

  const prevCountRef = useRef(0)

  // Yeni sipariş sesi
  useEffect(() => {
    if (orders.length > prevCountRef.current) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      } catch {}
    }
    prevCountRef.current = orders.length
  }, [orders.length])

  const lang = 'en'

  const nextStatus = {
    pending: 'confirmed',
    confirmed: 'preparing',
    preparing: 'ready',
  }

  const nextLabel = {
    pending: t('mark_confirmed'),
    confirmed: '🍳 ' + t('status_preparing'),
    preparing: t('mark_ready'),
  }

  if (loading) return <div className="page-loading">{t('loading')}</div>

  return (
    <div className="kitchen-page">
      <header className="kitchen-header">
        <h1>👨‍🍳 {t('kitchen_orders')}</h1>
        <div className="kitchen-count">{orders.length} aktif</div>
        <button onClick={signOut} className="sign-out-btn">{t('logout')}</button>
      </header>

      {orders.length === 0 ? (
        <div className="empty-state">
          <p>🎉 {t('no_orders')}</p>
        </div>
      ) : (
        <div className="kitchen-grid">
          {orders.map(order => (
            <div
              key={order.id}
              className="kitchen-card"
              style={{ borderTop: `4px solid ${STATUS_COLOR[order.status]}` }}
            >
              <div className="kitchen-card-header">
                <span className="kcard-table">Masa {order.table?.table_number} — {order.table?.label}</span>
                <span className={`kcard-status status-${order.status}`}>{t(`status_${order.status}`)}</span>
              </div>

              <div className="kcard-time">
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              </div>

              <ul className="kcard-items">
                {order.order_items?.map(oi => (
                  <li key={oi.id}>
                    <span className="kitem-qty">{oi.quantity}×</span>
                    <span className="kitem-name">{oi.menu_item?.[`name_${lang}`] || oi.menu_item?.name_en}</span>
                    {oi.item_note && <span className="kitem-note">📝 {oi.item_note}</span>}
                  </li>
                ))}
              </ul>

              {order.note && (
                <div className="kcard-note">📝 {order.note}</div>
              )}

              <div className="kcard-footer">
                <span className="kcard-num">#{order.order_number}</span>
                {nextStatus[order.status] && (
                  <button
                    className="kcard-action-btn"
                    onClick={() => updateStatus(order.id, nextStatus[order.status])}
                  >
                    {nextLabel[order.status]}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
