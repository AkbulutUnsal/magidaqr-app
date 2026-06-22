import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'

export default function AdminTables() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [tables, setTables] = useState([])
  const [restaurant, setRestaurant] = useState(null)
  const [newLabel, setNewLabel] = useState('')
  const [qrTarget, setQrTarget] = useState(null)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: rest } = await supabase.from('restaurants').select('*').eq('id', profile.restaurant_id).single()
    const { data: tabs } = await supabase.from('tables').select('*').eq('restaurant_id', profile.restaurant_id).order('table_number')
    setRestaurant(rest)
    setTables(tabs || [])
  }

  async function addTable() {
    const nextNum = (tables[tables.length - 1]?.table_number || 0) + 1
    await supabase.from('tables').insert({
      restaurant_id: profile.restaurant_id,
      table_number: nextNum,
      label: newLabel || `Masa ${nextNum}`
    })
    setNewLabel('')
    load()
  }

  async function deleteTable(id) {
    if (!confirm('Masayı sil?')) return
    await supabase.from('tables').delete().eq('id', id)
    load()
  }

  const menuUrl = (tableId) =>
    `${window.location.origin}/menu/${restaurant?.slug}/${tableId}`

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">{t('tables')}</h1>
      </div>

      <div className="table-add-form">
        <input
          placeholder="Masa etiketi (örn: Teras 3)"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTable()}
        />
        <button className="btn-primary" onClick={addTable}>+ Masa ekle</button>
      </div>

      <div className="tables-grid">
        {tables.map(table => (
          <div key={table.id} className="table-card">
            <div className="tc-num">{table.table_number}</div>
            <div className="tc-label">{table.label}</div>
            <div className="tc-url" title={menuUrl(table.id)}>
              /menu/.../{table.id.slice(0,8)}…
            </div>
            <div className="tc-actions">
              <button className="icon-btn" onClick={() => setQrTarget(table)}>📱 QR</button>
              <button className="icon-btn danger" onClick={() => deleteTable(table.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* QR Modal */}
      {qrTarget && restaurant && (
        <div className="modal-overlay" onClick={() => setQrTarget(null)}>
          <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Masa {qrTarget.table_number} — {qrTarget.label}</h3>
              <button onClick={() => setQrTarget(null)}>✕</button>
            </div>
            <div className="qr-body">
              <QRCodeSVG
                value={menuUrl(qrTarget.id)}
                size={240}
                level="H"
                includeMargin
              />
              <p className="qr-url">{menuUrl(qrTarget.id)}</p>
              <button
                className="btn-primary"
                onClick={() => {
                  const svg = document.querySelector('.qr-modal svg')
                  if (!svg) return
                  const blob = new Blob([svg.outerHTML], { type:'image/svg+xml' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `qr-masa-${qrTarget.table_number}.svg`
                  a.click()
                }}
              >⬇️ SVG indir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
