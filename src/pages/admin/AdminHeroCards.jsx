import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminHeroCards() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data } = await supabase.from('hero_cards')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    setList(data || [])
  }

  async function save(form) {
    const payload = { ...form, restaurant_id: profile.restaurant_id }
    if (edit?.id) await supabase.from('hero_cards').update(payload).eq('id', edit.id)
    else await supabase.from('hero_cards').insert(payload)
    setShow(false); setEdit(null); load()
  }

  async function toggle(c) {
    await supabase.from('hero_cards').update({ is_active: !c.is_active }).eq('id', c.id)
    load()
  }

  async function move(c, dir) {
    const idx = list.findIndex(x=>x.id===c.id)
    const swap = list[idx+dir]
    if (!swap) return
    await supabase.from('hero_cards').update({ sort_order: swap.sort_order }).eq('id', c.id)
    await supabase.from('hero_cards').update({ sort_order: c.sort_order }).eq('id', swap.id)
    load()
  }

  async function del(id) {
    if (!confirm('Kart silinsin mi?')) return
    await supabase.from('hero_cards').delete().eq('id', id)
    load()
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Ana Sayfa Kartları</h1>
        <button className="btn-primary" onClick={()=>{ setEdit(null); setShow(true) }}>+ Yeni Kart</button>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:20}}>
        Menü ana sayfasının üstünde gösterilecek tanıtım kartları (slider).
      </p>

      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {list.map((c,i) => (
          <div key={c.id} style={{background:'#fff',border:'1px solid #eee',borderRadius:14,overflow:'hidden',
            display:'flex',opacity:c.is_active?1:0.55}}>
            <div style={{width:120,flexShrink:0,background:'#f5f5f3'}}>
              {c.image_url
                ? <img src={c.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                : <div style={{width:'100%',height:'100%',minHeight:90,display:'flex',alignItems:'center',
                    justifyContent:'center',color:'#ccc',fontSize:28}}>🖼️</div>}
            </div>
            <div style={{flex:1,padding:'14px 18px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <p style={{fontSize:15,fontWeight:700,color:'#222'}}>{c.title_tr || c.title_en || '(başlıksız)'}</p>
              <p style={{fontSize:12,color:'#888',marginTop:2}}>{c.subtitle_tr || c.subtitle_en}</p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'0 14px'}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <button onClick={()=>move(c,-1)} disabled={i===0} style={{border:'1px solid #e8e8e4',
                  background:'#fff',borderRadius:6,padding:'2px 8px',cursor:i===0?'default':'pointer',opacity:i===0?0.3:1}}>▲</button>
                <button onClick={()=>move(c,1)} disabled={i===list.length-1} style={{border:'1px solid #e8e8e4',
                  background:'#fff',borderRadius:6,padding:'2px 8px',cursor:i===list.length-1?'default':'pointer',opacity:i===list.length-1?0.3:1}}>▼</button>
              </div>
              <button onClick={()=>toggle(c)} style={{padding:'7px 12px',borderRadius:8,fontSize:12,fontWeight:600,
                border:'1px solid #e8e8e4',background:c.is_active?'#e8f5ee':'#f5f5f3',
                color:c.is_active?'#1D9E75':'#999',cursor:'pointer'}}>
                {c.is_active?'✓':'○'}
              </button>
              <button onClick={()=>{ setEdit(c); setShow(true) }} style={{background:'none',border:'none',cursor:'pointer',fontSize:16}}>✏️</button>
              <button onClick={()=>del(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',fontSize:16}}>🗑️</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p style={{color:'#bbb',fontSize:13}}>Henüz kart yok.</p>}
      </div>

      {show && <HeroModal item={edit} onSave={save} onClose={()=>{ setShow(false); setEdit(null) }} />}
    </div>
  )
}

function HeroModal({ item, onSave, onClose }) {
  const [f, setF] = useState({
    title_ka:item?.title_ka||'', title_en:item?.title_en||'', title_tr:item?.title_tr||'', title_ru:item?.title_ru||'',
    subtitle_ka:item?.subtitle_ka||'', subtitle_en:item?.subtitle_en||'',
    subtitle_tr:item?.subtitle_tr||'', subtitle_ru:item?.subtitle_ru||'',
    image_url:item?.image_url||'', link_url:item?.link_url||'',
    is_active:item?.is_active??true, sort_order:item?.sort_order||0
  })
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="modal-header">
          <h3>{item?'Kartı Düzenle':'Yeni Kart'}</h3>
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
          <div className="form-row">
            {['tr','en','ka','ru'].map(l => (
              <div key={l} className="form-group">
                <label>Alt Başlık ({l.toUpperCase()})</label>
                <input value={f[`subtitle_${l}`]} onChange={e=>set(`subtitle_${l}`,e.target.value)} />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label>Görsel URL</label>
            <input value={f.image_url} onChange={e=>set('image_url',e.target.value)} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Bağlantı URL (opsiyonel)</label>
            <input value={f.link_url} onChange={e=>set('link_url',e.target.value)} placeholder="#kategori veya https://..." />
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
