import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const COMMON = [
  { icon:'🥜', en:'Peanuts', tr:'Yer fıstığı', ka:'არაქისი', ru:'Арахис' },
  { icon:'🌰', en:'Nuts', tr:'Kuruyemiş', ka:'თხილეული', ru:'Орехи' },
  { icon:'🥛', en:'Milk', tr:'Süt', ka:'რძე', ru:'Молоко' },
  { icon:'🥚', en:'Eggs', tr:'Yumurta', ka:'კვერცხი', ru:'Яйца' },
  { icon:'🌾', en:'Gluten', tr:'Gluten', ka:'გლუტენი', ru:'Глютен' },
  { icon:'🐟', en:'Fish', tr:'Balık', ka:'თევზი', ru:'Рыба' },
  { icon:'🦐', en:'Shellfish', tr:'Kabuklu deniz', ka:'კიბოსნაირები', ru:'Моллюски' },
  { icon:'🫘', en:'Soy', tr:'Soya', ka:'სოია', ru:'Соя' },
]

export default function AdminAllergens() {
  const { profile } = useAuth()
  const [list, setList] = useState([])
  const [form, setForm] = useState({ icon:'⚠️', name_ka:'', name_en:'', name_tr:'', name_ru:'' })

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data } = await supabase.from('allergens')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('created_at')
    setList(data || [])
  }

  async function add(payload) {
    const body = payload || form
    if (!body.name_en && !body.name_tr) return
    await supabase.from('allergens').insert({ ...body, restaurant_id: profile.restaurant_id })
    setForm({ icon:'⚠️', name_ka:'', name_en:'', name_tr:'', name_ru:'' })
    load()
  }

  async function quickAdd(c) {
    await add({ icon:c.icon, name_ka:c.ka, name_en:c.en, name_tr:c.tr, name_ru:c.ru })
  }

  async function del(id) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('allergens').delete().eq('id', id)
    load()
  }

  const existing = new Set(list.map(a => a.name_en))

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Alerjenler</h1>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:20}}>Ürünlerde gösterilecek alerjen etiketlerini yönetin.</p>

      <div style={{background:'#fff',border:'1px solid #eee',borderRadius:12,padding:18,marginBottom:20}}>
        <p style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:12}}>HIZLI EKLE</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {COMMON.map(c => (
            <button key={c.en} onClick={()=>quickAdd(c)} disabled={existing.has(c.en)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:10,
                border:'1px solid #e8e8e4',background:existing.has(c.en)?'#f0f0ee':'#fff',
                cursor:existing.has(c.en)?'default':'pointer',opacity:existing.has(c.en)?0.5:1,
                fontSize:13,fontWeight:600,color:'#333'}}>
              <span style={{fontSize:16}}>{c.icon}</span> {c.tr}
              {existing.has(c.en) && ' ✓'}
            </button>
          ))}
        </div>
      </div>

      <div style={{background:'#fff',border:'1px solid #eee',borderRadius:12,padding:18,marginBottom:20}}>
        <p style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:12}}>ÖZEL ALERJEN EKLE</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{width:60}}>
            <label style={{fontSize:11,color:'#999',display:'block',marginBottom:4}}>İkon</label>
            <input value={form.icon} onChange={e=>setForm(p=>({...p,icon:e.target.value}))}
              style={{width:'100%',padding:'8px',border:'1px solid #e8e8e4',borderRadius:8,textAlign:'center',fontSize:16}} />
          </div>
          {['tr','en','ka','ru'].map(l => (
            <div key={l} style={{flex:1,minWidth:120}}>
              <label style={{fontSize:11,color:'#999',display:'block',marginBottom:4}}>İsim ({l.toUpperCase()})</label>
              <input value={form[`name_${l}`]} onChange={e=>setForm(p=>({...p,[`name_${l}`]:e.target.value}))}
                style={{width:'100%',padding:'8px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
            </div>
          ))}
          <button className="btn-primary" onClick={()=>add()} style={{padding:'9px 18px'}}>+ Ekle</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
        {list.map(a => (
          <div key={a.id} style={{background:'#fff',border:'1px solid #eee',borderRadius:12,padding:'14px 16px',
            display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:24}}>{a.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:600,color:'#222'}}>{a.name_tr || a.name_en}</p>
              <p style={{fontSize:11,color:'#aaa'}}>{a.name_en}</p>
            </div>
            <button onClick={()=>del(a.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',fontSize:16}}>🗑️</button>
          </div>
        ))}
        {list.length === 0 && <p style={{color:'#bbb',fontSize:13,gridColumn:'1/-1'}}>Henüz alerjen yok.</p>}
      </div>
    </div>
  )
}
