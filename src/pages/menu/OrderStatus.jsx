import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

const STATUS_STEPS = ['pending','confirmed','preparing','ready','served']
const STATUS_ICONS = { pending:'⏳', confirmed:'✅', preparing:'👨‍🍳', ready:'🔔', served:'🍽️', cancelled:'❌' }

export default function OrderStatus() {
  const { orderId } = useParams()
  const { t } = useTranslation()
  const [order, setOrder] = useState(null)

  useEffect(() => {
    // İlk yükleme
    supabase.from('orders')
      .select('*, order_items(*, menu_item:menu_items(name_ka,name_en,name_tr,name_ru)), table:tables(table_number,label)')
      .eq('id', orderId)
      .single()
      .then(({ data }) => setOrder(data))

    // Realtime izle
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`
      }, ({ new: updated }) => {
        setOrder(prev => prev ? { ...prev, ...updated } : updated)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [orderId])

  if (!order) return <div className="page-loading">{t('loading')}</div>

  const stepIdx = STATUS_STEPS.indexOf(order.status)
  const lang = 'en'

  return (
    <div className="order-status-page">
      <div className="order-status-card">
        <div className="order-icon">{STATUS_ICONS[order.status]}</div>
        <h2>{t(`status_${order.status}`)}</h2>
        <p className="order-num">{t('order_number')}{order.order_number}</p>

        {/* Progress bar */}
        {order.status !== 'cancelled' && (
          <div className="progress-track">
            {STATUS_STEPS.filter(s => s !== 'cancelled').map((step, i) => (
              <div key={step} className={`progress-step ${i <= stepIdx ? 'done' : ''}`}>
                <div className="step-dot" />
                <span>{t(`status_${step}`)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sipariş detayı */}
        <div className="order-items-list">
          {order.order_items?.map(oi => (
            <div key={oi.id} className="order-item-row">
              <span>{oi.quantity}× {oi.menu_item?.[`name_${lang}`] || oi.menu_item?.name_en}</span>
              <span>{(oi.unit_price * oi.quantity).toFixed(2)} ₾</span>
            </div>
          ))}
          <div className="order-item-row total">
            <span>{t('total')}</span>
            <span>{Number(order.total_price).toFixed(2)} ₾</span>
          </div>
        </div>
      </div>
    </div>
  )
}
