import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function CartDrawer({ cart, setCart, onClose, onOrder }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)

  const changeQty = (id, delta) => {
    setCart(prev => prev
      .map(c => c.id === id ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0)
    )
  }

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-drawer" onClick={e => e.stopPropagation()}>
        <div className="cart-header">
          <h2>{t('your_order')}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cart-items">
          {cart.map(item => (
            <div key={item.id} className="cart-item-row">
              <div className="ci-info">
                <span className="ci-name">{item.name_en || item.name_ka}</span>
                <span className="ci-price">{(item.price * item.qty).toFixed(2)} ₾</span>
              </div>
              <div className="ci-qty">
                <button onClick={() => changeQty(item.id, -1)}>−</button>
                <span>{item.qty}</span>
                <button onClick={() => changeQty(item.id, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>

        <textarea
          className="cart-note"
          placeholder={t('order_note_placeholder')}
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
        />

        <div className="cart-footer">
          <div className="cart-total">
            <span>{t('total')}</span>
            <span>{total.toFixed(2)} ₾</span>
          </div>
          <button className="btn-primary btn-full" onClick={() => onOrder(note)}>
            {t('place_order')}
          </button>
        </div>
      </div>
    </div>
  )
}
