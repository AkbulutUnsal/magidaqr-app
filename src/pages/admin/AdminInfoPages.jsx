import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const PRESETS = [
  { slug:'about', title_tr:'Hakkımızda', title_en:'About Us', title_ka:'ჩვენ შესახებ', title_ru:'О нас' },
  { slug:'privacy', title_tr:'Gizlilik Politikası', title_en:'Privacy Policy', title_ka:'კონფიდენციალურობა', title_ru:'Конфиденциальность' },
  { slug:'terms', title_tr:'Kullanım Koşulları', title_en:'Terms', title_ka:'წესები', title_ru:'Условия' },
  { slug:'contact', title_tr:'İletişim', title_en:'Contact', title_ka:'კონტაქტი', title_ru:'Контакты' },
]

export default function AdminInfoPages() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [edit, setEdit] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data } = await supabase.from('info_pages')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    setList(data || [])
  }

  async function save(form) {
    const payload = { ...form, restaurant_id: profile.restaurant_id }
    if (edit?.id) await supabase.from('info_pages').update(payload).eq('id', edit.id)
    else await supabase.from('info_pages').insert(payload)
    setShow(false); setEdit(null); load()
  }

  async function addPreset(p) {
    await supabase.from('info_pages').insert({
      restaurant_id: profile.restaurant_id, slug:p.slug,
      title_tr:p.title_tr, title_en:p.title_en, title_ka:p.title_ka, title_ru:p.title_ru,
      is_published:true, sort_order:list.length
    })
    load()
  }

  async function togglePublish(p) {
    await supabase.from('info_pages').update({ is_published: !p.is_published }).eq('id', p.id)
    load()
  }

  async function del(id) {
    if (!confirm('Sayfa silinsin mi?')) return
    await supabase.from('info_pages').delete().eq('id', id)
    load()
  }

  const existing = new Set(list.map(p => p.slug))

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Bilgi Sayfaları</h1>
        <button className="btn-primary" onClick={()=>{ setEdit(null); setShow(true) }}>+ Özel Sayfa</button>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:16}}>Hakkımızda, gizlilik, iletişim gibi sayfaları yönetin.</p>

      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:24}}>
        {PRESETS.filter(p=>!existing.has(p.slug)).map(p => (
          <button key={p.slug} onClick={()=>addPreset(p)}
            style={{padding:'8px 14px',borderRadius:10,border:'1px dashed #1D9E75',background:'#e8f5ee',
              color:'#1D9E75',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            + {p.title_tr}
          </button>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {list.map(p => (
          <div key={p.id} style={{background:'#fff',border:'1px solid #eee',borderRadius:12,padding:'14px 18px',
            display:'flex',alignItems:'center',gap:14}}>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:700,color:'#222'}}>{p.title_tr || p.title_en}
                <span style={{fontSize:11,color:'#bbb',fontWeight:400,marginLeft:8}}>/{p.slug}</span>
              </p>
              <p style={{fontSize:12,color:'#aaa',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {(p.content_tr || p.content_en || 'İçerik boş').slice(0,60)}
              </p>
            </div>
            <button onClick={()=>togglePublish(p)} style={{padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,
              border:'1px solid #e8e8e4',background:p.is_published?'#e8f5ee':'#f5f5f3',
              color:p.is_published?'#1D9E75':'#999',cursor:'pointer'}}>
              {p.is_published?'✓ Yayında':'Taslak'}
            </button>
            <button onClick={()=>{ setEdit(p); setShow(true) }} style={{background:'none',border:'none',cursor:'pointer',fontSize:16}}>✏️</button>
            <button onClick={()=>del(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',fontSize:16}}>🗑️</button>
          </div>
        ))}
        {list.length === 0 && <p style={{color:'#bbb',fontSize:13}}>Henüz sayfa yok.</p>}
      </div>

      {show && <InfoModal item={edit} onSave={save} onClose={()=>{ setShow(false); setEdit(null) }} />}
    </div>
  )
}

function InfoModal({ item, onSave, onClose }) {
  const [f, setF] = useState({
    slug:item?.slug||'', title_ka:item?.title_ka||'', title_en:item?.title_en||'',
    title_tr:item?.title_tr||'', title_ru:item?.title_ru||'',
    content_ka:item?.content_ka||'', content_en:item?.content_en||'',
    content_tr:item?.content_tr||'', content_ru:item?.content_ru||'',
    is_published:item?.is_published??true, sort_order:item?.sort_order||0
  })
  const [lang, setLang] = useState('tr')
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:640}}>
        <div className="modal-header">
          <h3>{item?'Sayfayı Düzenle':'Yeni Sayfa'}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Slug (URL)</label>
            <input value={f.slug} onChange={e=>set('slug',e.target.value)} placeholder="about" />
          </div>
          <div style={{display:'flex',gap:4,marginBottom:12}}>
            {['tr','en','ka','ru'].map(l => (
              <button key={l} onClick={()=>setLang(l)}
                style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:700,cursor:'pointer',
                  background:lang===l?'#1D9E75':'#f0f0ee',color:lang===l?'#fff':'#888'}}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="form-group">
            <label>Başlık ({lang.toUpperCase()})</label>
            <input value={f[`title_${lang}`]} onChange={e=>set(`title_${lang}`,e.target.value)} />
          </div>
          <div className="form-group">
            <label>İçerik ({lang.toUpperCase()})</label>
            <textarea value={f[`content_${lang}`]} onChange={e=>set(`content_${lang}`,e.target.value)} rows={8} />
          </div>
          <div className="form-checks">
            <label><input type="checkbox" checked={f.is_published} onChange={e=>set('is_published',e.target.checked)} /> Yayında</label>
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
