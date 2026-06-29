import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import QRCodeStyling from 'qr-code-styling'

/* ───────────────────────────────────────────────────────────
   magidaQR · Masalar  (yeşil tema · #1D9E75)
   Fiziksel masa yönetimi + masa başına QR.
   QR Stüdyo (AdminQR) ile aynı qr-code-styling kütüphanesi.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

export default function AdminTables() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [tables, setTables] = useState([])
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [qrTarget, setQrTarget] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const [{ data: rest }, { data: tabs }] = await Promise.all([
      supabase.from('restaurants').select('*').eq('id', profile.restaurant_id).single(),
      supabase.from('tables').select('*').eq('restaurant_id', profile.restaurant_id).order('table_number'),
    ])
    setRestaurant(rest); setTables(tabs || [])
    setLoading(false)
  }

  const menuUrl = id => `${window.location.origin}/menu/${restaurant?.slug || 'main'}/${id}`

  async function addTable() {
    const nextNum = Math.max(0, ...tables.map(t => t.table_number || 0)) + 1
    const { data } = await supabase.from('tables').insert({ restaurant_id: profile.restaurant_id, table_number: nextNum, label: newLabel || `Masa ${nextNum}` }).select().single()
    if (data) setTables(prev => [...prev, data])
    setNewLabel('')
  }
  async function rename(id) {
    await supabase.from('tables').update({ label: editLabel || 'Masa' }).eq('id', id)
    setTables(prev => prev.map(t => t.id === id ? { ...t, label: editLabel || 'Masa' } : t))
    setEditingId(null)
  }
  async function deleteTable(id) {
    if (!confirm('Masa silinsin mi?')) return
    await supabase.from('tables').delete().eq('id', id)
    setTables(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Masalar</h1>
          <p style={{ fontSize: 13, color: MUTED }}>{tables.length} masa · her masanın kendi QR kodu ve menü linki var</p>
        </div>
        <Link to="/admin/qr" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: '#fff', color: '#444', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <QrIcon /> QR Stüdyo (toplu yazdır)
        </Link>
      </div>

      {/* Masa ekle */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTable()}
          placeholder="Masa etiketi (örn: Teras 3) — boş bırakırsan otomatik numaralanır"
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13 }} />
        <button onClick={addTable} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
          <PlusIcon /> Masa Ekle
        </button>
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
      ) : tables.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
          <p style={{ fontSize: 14 }}>Henüz masa yok. Yukarıdan ekle.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {tables.map(table => (
            <div key={table.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: GREEN_BG, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, flexShrink: 0 }}>{table.table_number}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === table.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && rename(table.id)}
                        style={{ flex: 1, minWidth: 0, padding: '5px 8px', border: `1px solid ${GREEN}`, borderRadius: 6, fontSize: 13 }} />
                      <button onClick={() => rename(table.id)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '0 8px', cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.label}</p>
                  )}
                  <p style={{ fontSize: 11, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/menu/…/{String(table.id).slice(0, 8)}…</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setQrTarget(table)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: GREEN_BG, color: GREEN, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><QrIcon /> QR</button>
                <button onClick={() => { setEditingId(table.id); setEditLabel(table.label || '') }} style={iconBtn} title="Yeniden adlandır"><EditIcon /></button>
                <button onClick={() => deleteTable(table.id)} style={{ ...iconBtn, color: RED }} title="Sil"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrTarget && restaurant && <QrModal table={qrTarget} url={menuUrl(qrTarget.id)} onClose={() => setQrTarget(null)} />}
    </div>
  )
}

function QrModal({ table, url, onClose }) {
  const ref = useRef(null)
  const qrRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    qrRef.current = new QRCodeStyling({
      width: 240, height: 240, data: url, margin: 6,
      dotsOptions: { color: GREEN, type: 'rounded' },
      cornersSquareOptions: { color: GREEN, type: 'extra-rounded' },
      cornersDotOptions: { color: GREEN },
      backgroundOptions: { color: '#ffffff' },
    })
    if (ref.current) { ref.current.innerHTML = ''; qrRef.current.append(ref.current) }
  }, [url])

  const download = ext => qrRef.current?.download({ name: `masa-${table.table_number}-qr`, extension: ext })
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 800 }}>Masa {table.table_number} · {table.label}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div ref={ref} style={{ borderRadius: 12, border: `1px solid ${BORDER}`, padding: 8 }} />
          <p style={{ fontSize: 11, color: '#aaa', wordBreak: 'break-all', textAlign: 'center' }}>{url}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
            <button onClick={() => download('png')} style={btnPrimary}>PNG indir</button>
            <button onClick={() => download('svg')} style={btnGhost}>SVG indir</button>
          </div>
          <button onClick={copy} style={{ ...btnGhost, width: '100%' }}>{copied ? '✓ Kopyalandı' : 'Menü linkini kopyala'}</button>
        </div>
      </div>
    </div>
  )
}

const iconBtn = { background: '#fff', border: `1px solid ${BORDER}`, cursor: 'pointer', color: '#999', padding: '7px 9px', borderRadius: 8 }
const btnPrimary = { padding: '10px', background: GREEN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { padding: '10px', background: '#fff', color: '#555', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
function PlusIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function QrIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" /></svg> }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
function TrashIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
