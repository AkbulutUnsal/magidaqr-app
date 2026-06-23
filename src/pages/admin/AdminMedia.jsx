import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminMedia() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data } = await supabase.from('media_library')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('created_at', { ascending:false })
    setList(data || [])
  }

  async function add() {
    if (!url) return
    await supabase.from('media_library').insert({
      restaurant_id: profile.restaurant_id, url, name: name || 'Görsel', type:'image'
    })
    setUrl(''); setName(''); load()
  }

  async function del(id) {
    if (!confirm('Görsel silinsin mi?')) return
    await supabase.from('media_library').delete().eq('id', id)
    load()
  }

  function copy(u) {
    navigator.clipboard.writeText(u)
    setCopied(u)
    setTimeout(()=>setCopied(null), 1500)
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Medya Kütüphanesi</h1>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:20}}>
        Görsel URL'lerini kaydedin, ürün/kampanya eklerken kopyalayıp kullanın.
      </p>

      <div style={{background:'#fff',border:'1px solid #eee',borderRadius:12,padding:18,marginBottom:24}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:2,minWidth:240}}>
            <label style={{fontSize:11,color:'#999',display:'block',marginBottom:4}}>Görsel URL</label>
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."
              style={{width:'100%',padding:'9px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
          </div>
          <div style={{flex:1,minWidth:140}}>
            <label style={{fontSize:11,color:'#999',display:'block',marginBottom:4}}>İsim (opsiyonel)</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Logo, Kapak..."
              style={{width:'100%',padding:'9px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
          </div>
          <button className="btn-primary" onClick={add} style={{padding:'10px 20px'}}>+ Ekle</button>
        </div>
        {url && (
          <div style={{marginTop:14,display:'flex',gap:12,alignItems:'center'}}>
            <span style={{fontSize:11,color:'#999'}}>Önizleme:</span>
            <img src={url} alt="" style={{height:60,borderRadius:8,border:'1px solid #eee',objectFit:'cover'}}
              onError={e=>{e.target.style.display='none'}} />
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:14}}>
        {list.map(m => (
          <div key={m.id} style={{background:'#fff',border:'1px solid #eee',borderRadius:12,overflow:'hidden'}}>
            <div style={{height:120,background:'#f5f5f3'}}>
              <img src={m.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}
                onError={e=>{e.target.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23eee%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23aaa%22 font-size=%2230%22%3E?%3C/text%3E%3C/svg%3E'}} />
            </div>
            <div style={{padding:'10px 12px'}}>
              <p style={{fontSize:12,fontWeight:600,color:'#333',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</p>
              <div style={{display:'flex',gap:6,marginTop:8}}>
                <button onClick={()=>copy(m.url)} style={{flex:1,padding:'6px',borderRadius:6,fontSize:11,fontWeight:600,
                  border:'1px solid #e8e8e4',background:copied===m.url?'#e8f5ee':'#fff',
                  color:copied===m.url?'#1D9E75':'#666',cursor:'pointer'}}>
                  {copied===m.url?'✓ Kopyalandı':'📋 Kopyala'}
                </button>
                <button onClick={()=>del(m.id)} style={{padding:'6px 10px',borderRadius:6,
                  border:'1px solid #fde0e0',background:'#fff',color:'#e8192c',cursor:'pointer'}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p style={{color:'#bbb',fontSize:13,gridColumn:'1/-1'}}>Henüz görsel yok.</p>}
      </div>
    </div>
  )
}
