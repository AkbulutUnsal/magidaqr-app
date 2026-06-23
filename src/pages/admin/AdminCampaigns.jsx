import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminCampaigns() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data } = await supabase.from('campaigns')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    setList(data || [])
  }

  async function save(form) {
    const payload = { ...form, restaurant_id: profile.restaurant_id,
      discount_percent: parseInt(form.discount_percent) || 0 }
    if (edit?.id) await supabase.from('campaigns').update(payload).eq('id', edit.id)
    else await supabase.from('campaigns').insert(payload)
    setShow(false); setEdit(null); load()
  }

  async function toggle(c) {
    await supabase.from('campaigns').update({ is_active: !c.is_active }).eq('id', c.id)
    load()
  }

  async function del(id) {
    if (!confirm('Kampanya silinsin mi?')) return
    await supabase.from('campaigns').delete().eq('id', id)
    load()
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Kampanyalar</h1>
        <button className="btn-primary" onClick={()=>{ setEdit(null); setShow(true) }}>+ Yeni Kampanya</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16,marginTop:16}}>
        {list.map(c => (
          <div key={c.id} style={{background:'#fff',border:'1px solid #eee',borderRadius:14,overflow:'hidden',
            opacity:c.is_active?1:0.55}}>
            {c.image_url
              ? <img src={c.image_url} alt="" style={{width:'100%',height:130,objectFit:'cover'}} />
              : <div style={{height:130,background:'linear-gradient(135deg,#1D9E75,#0F6E56)',display:'flex',
                  alignItems:'center',justifyContent:'center',color:'#fff',fontSize:32,fontWeight:900}}>
                  {c.discount_percent>0 ? `%${c.discount_percent}` : '🎉'}
                </div>}
            <div style={{padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                <h3 style={{fontSize:15,fontWeight:700,color:'#222'}}>{c.title_tr || c.title_en}</h3>
                {c.badge_text && <span style={{background:'#E8192C',color:'#fff',fontSize:10,fontWeight:700,
                  padding:'2px 8px',borderRadius:20,whiteSpace:'nowrap'}}>{c.badge_text}</span>}
              </div>
              <p style={{fontSize:12,color:'#888',marginTop:6,lineHeight:1.4}}>{c.description_tr || c.description_en}</p>
              {(c.starts_at || c.ends_at) && (
                <p style={{fontSize:11,color:'#bbb',marginTop:8}}>
                  {c.starts_at} → {c.ends_at || '∞'}
                </p>
              )}
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={()=>toggle(c)} style={{flex:1,padding:'7px',borderRadius:8,fontSize:12,fontWeight:600,
                  border:'1px solid #e8e8e4',background:c.is_active?'#e8f5ee':'#f5f5f3',
                  color:c.is_active?'#1D9E75':'#999',cursor:'pointer'}}>
                  {c.is_active?'✓ Aktif':'Pasif'}
                </button>
                <button onClick={()=>{ setEdit(c); setShow(true) }} style={{padding:'7px 12px',borderRadius:8,
                  border:'1px solid #e8e8e4',background:'#fff',cursor:'pointer'}}>✏️</button>
                <button onClick={()=>del(c.id)} style={{padding:'7px 12px',borderRadius:8,
                  border:'1px solid #fde0e0',background:'#fff',color:'#e8192c',cursor:'pointer'}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p style={{color:'#bbb',fontSize:13}}>Henüz kampanya yok.</p>}
      </div>

      {show && <CampaignModal item={edit} onSave={save} onClose={()=>{ setShow(false); setEdit(null) }} />}
    </div>
  )
}

function CampaignModal({ item, onSave, onClose }) {
  const [f, setF] = useState({
    title_ka:item?.title_ka||'', title_en:item?.title_en||'', title_tr:item?.title_tr||'', title_ru:item?.title_ru||'',
    description_ka:item?.description_ka||'', description_en:item?.description_en||'',
    description_tr:item?.description_tr||'', description_ru:item?.description_ru||'',
    image_url:item?.image_url||'', discount_percent:item?.discount_percent||'',
    badge_text:item?.badge_text||'', is_active:item?.is_active??true,
    starts_at:item?.starts_at||'', ends_at:item?.ends_at||'', sort_order:item?.sort_order||0
  })
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="modal-header">
          <h3>{item?'Kampanyayı Düzenle':'Yeni Kampanya'}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            {['tr','en','ka','ru'].map(l => (
              <div key={l} className="form-group">
                <label>Başlık ({l.toUpperCase()})</label>
                <input value={f[`title_${l}`]} onChange={e=>set(`title_${l}`,e.target.value)} />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label>Açıklama (TR)</label>
            <textarea value={f.description_tr} onChange={e=>set('description_tr',e.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label>Açıklama (EN)</label>
            <textarea value={f.description_en} onChange={e=>set('description_en',e.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label>Görsel URL</label>
            <input value={f.image_url} onChange={e=>set('image_url',e.target.value)} placeholder="https://..." />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>İndirim %</label>
              <input type="number" value={f.discount_percent} onChange={e=>set('discount_percent',e.target.value)} />
            </div>
            <div className="form-group">
              <label>Rozet Metni</label>
              <input value={f.badge_text} onChange={e=>set('badge_text',e.target.value)} placeholder="YENİ / FIRSAT" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Başlangıç</label>
              <input type="date" value={f.starts_at} onChange={e=>set('starts_at',e.target.value)} />
            </div>
            <div className="form-group">
              <label>Bitiş</label>
              <input type="date" value={f.ends_at} onChange={e=>set('ends_at',e.target.value)} />
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
