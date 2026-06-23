import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminOutlets() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data } = await supabase.from('outlets')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('created_at')
    setList(data || [])
  }

  async function save(form) {
    const payload = { ...form, restaurant_id: profile.restaurant_id,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null }
    if (edit?.id) await supabase.from('outlets').update(payload).eq('id', edit.id)
    else await supabase.from('outlets').insert(payload)
    setShow(false); setEdit(null); load()
  }

  async function toggle(o) {
    await supabase.from('outlets').update({ is_active: !o.is_active }).eq('id', o.id)
    load()
  }

  async function del(id) {
    if (!confirm('Şube silinsin mi?')) return
    await supabase.from('outlets').delete().eq('id', id)
    load()
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Outletler / Şubeler</h1>
        <button className="btn-primary" onClick={()=>{ setEdit(null); setShow(true) }}>+ Yeni Şube</button>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:20}}>Birden fazla lokasyonunuz varsa şubelerinizi yönetin.</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
        {list.map(o => (
          <div key={o.id} style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:18,
            opacity:o.is_active?1:0.55}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:'#222'}}>📍 {o.name}</h3>
              <button onClick={()=>toggle(o)} style={{padding:'3px 10px',borderRadius:6,fontSize:11,fontWeight:600,
                border:'1px solid #e8e8e4',background:o.is_active?'#e8f5ee':'#f5f5f3',
                color:o.is_active?'#1D9E75':'#999',cursor:'pointer'}}>
                {o.is_active?'Aktif':'Pasif'}
              </button>
            </div>
            {o.address && <p style={{fontSize:13,color:'#888',marginTop:8,lineHeight:1.4}}>{o.address}</p>}
            {o.phone && <p style={{fontSize:13,color:'#666',marginTop:6}}>📞 {o.phone}</p>}
            {(o.lat && o.lng) && (
              <a href={`https://maps.google.com/?q=${o.lat},${o.lng}`} target="_blank" rel="noreferrer"
                style={{fontSize:12,color:'#1D9E75',marginTop:6,display:'inline-block',textDecoration:'none'}}>
                🗺️ Haritada gör
              </a>
            )}
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={()=>{ setEdit(o); setShow(true) }} style={{flex:1,padding:'7px',borderRadius:8,
                border:'1px solid #e8e8e4',background:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>✏️ Düzenle</button>
              <button onClick={()=>del(o.id)} style={{padding:'7px 12px',borderRadius:8,
                border:'1px solid #fde0e0',background:'#fff',color:'#e8192c',cursor:'pointer'}}>🗑️</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p style={{color:'#bbb',fontSize:13}}>Henüz şube yok.</p>}
      </div>

      {show && <OutletModal item={edit} onSave={save} onClose={()=>{ setShow(false); setEdit(null) }} />}
    </div>
  )
}

function OutletModal({ item, onSave, onClose }) {
  const [f, setF] = useState({
    name:item?.name||'', address:item?.address||'', phone:item?.phone||'',
    lat:item?.lat||'', lng:item?.lng||'', is_active:item?.is_active??true
  })
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item?'Şubeyi Düzenle':'Yeni Şube'}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Şube Adı</label>
            <input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="Merkez Şube" />
          </div>
          <div className="form-group">
            <label>Adres</label>
            <textarea value={f.address} onChange={e=>set('address',e.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label>Telefon</label>
            <input value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="+995 555 000 000" />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Enlem (lat)</label>
              <input value={f.lat} onChange={e=>set('lat',e.target.value)} placeholder="41.7151" />
            </div>
            <div className="form-group">
              <label>Boylam (lng)</label>
              <input value={f.lng} onChange={e=>set('lng',e.target.value)} placeholder="44.8271" />
            </div>
          </div>
          <div className="form-checks">
            <label><input type="checkbox" checked={f.is_active} onChange={e=>set('is_active',e.target.checked)} /> Aktif</label>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={()=>onSave(f)}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}
