import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminBulkPrice() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [filterCat, setFilterCat] = useState('')
  const [edited, setEdited] = useState({})   // { itemId: newPrice }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // toplu işlem
  const [bulkMode, setBulkMode] = useState('percent') // percent | amount
  const [bulkVal, setBulkVal] = useState('')

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: c } = await supabase.from('menu_categories')
      .select('id,name_tr,name_en').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    const { data: i } = await supabase.from('menu_items')
      .select('id,name_tr,name_en,name_ka,price,category_id').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    setCats(c || [])
    setItems(i || [])
    setEdited({})
  }

  const shown = filterCat ? items.filter(i=>i.category_id===filterCat) : items

  function setPrice(id, val) {
    setEdited(prev => ({ ...prev, [id]: val }))
  }

  function applyBulk() {
    if (!bulkVal) return
    const v = parseFloat(bulkVal)
    if (isNaN(v)) return
    const next = { ...edited }
    shown.forEach(it => {
      const cur = parseFloat(edited[it.id] ?? it.price) || 0
      let np = bulkMode === 'percent' ? cur * (1 + v/100) : cur + v
      next[it.id] = Math.max(0, Math.round(np*100)/100)
    })
    setEdited(next)
    setBulkVal('')
  }

  async function saveAll() {
    setSaving(true)
    const updates = Object.entries(edited).filter(([id, val]) => {
      const orig = items.find(i=>i.id===id)
      return orig && parseFloat(val) !== parseFloat(orig.price)
    })
    for (const [id, val] of updates) {
      await supabase.from('menu_items').update({ price: parseFloat(val) }).eq('id', id)
    }
    setSaving(false)
    setSaved(true); setTimeout(()=>setSaved(false), 2000)
    load()
  }

  const changeCount = Object.entries(edited).filter(([id,val]) => {
    const orig = items.find(i=>i.id===id)
    return orig && parseFloat(val) !== parseFloat(orig.price)
  }).length

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Toplu Fiyat Güncelleme</h1>
        <button className="btn-primary" onClick={saveAll} disabled={changeCount===0||saving}
          style={{opacity:changeCount===0?0.5:1}}>
          {saving?'Kaydediliyor...':saved?'✓ Kaydedildi':`Kaydet (${changeCount})`}
        </button>
      </div>

      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end',marginBottom:20,
        background:'#fff',border:'1px solid #eee',borderRadius:12,padding:16}}>
        <div>
          <label style={{fontSize:11,color:'#999',display:'block',marginBottom:4}}>Kategori filtresi</label>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
            style={{padding:'9px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13,minWidth:160}}>
            <option value="">Tümü ({items.length})</option>
            {cats.map(c=><option key={c.id} value={c.id}>{c.name_tr||c.name_en}</option>)}
          </select>
        </div>
        <div style={{borderLeft:'1px solid #eee',paddingLeft:12,display:'flex',gap:8,alignItems:'flex-end'}}>
          <div>
            <label style={{fontSize:11,color:'#999',display:'block',marginBottom:4}}>Toplu uygula</label>
            <select value={bulkMode} onChange={e=>setBulkMode(e.target.value)}
              style={{padding:'9px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}}>
              <option value="percent">Yüzde (%)</option>
              <option value="amount">Tutar (₾)</option>
            </select>
          </div>
          <input type="number" value={bulkVal} onChange={e=>setBulkVal(e.target.value)}
            placeholder={bulkMode==='percent'?'+10 / -5':'+2 / -1'}
            style={{width:110,padding:'9px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
          <button onClick={applyBulk} style={{padding:'9px 16px',borderRadius:8,border:'1px solid #1D9E75',
            background:'#e8f5ee',color:'#1D9E75',fontWeight:600,fontSize:13,cursor:'pointer'}}>
            Uygula
          </button>
        </div>
      </div>

      <div style={{background:'#fff',border:'1px solid #eee',borderRadius:12,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#f9f9f7',fontSize:11,color:'#999',textAlign:'left'}}>
              <th style={{padding:'10px 16px'}}>ÜRÜN</th>
              <th style={{padding:'10px 16px',width:120}}>ESKİ FİYAT</th>
              <th style={{padding:'10px 16px',width:140}}>YENİ FİYAT</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(it => {
              const newP = edited[it.id]
              const changed = newP !== undefined && parseFloat(newP) !== parseFloat(it.price)
              return (
                <tr key={it.id} style={{borderTop:'1px solid #f4f4f2',background:changed?'#fffbe8':'#fff'}}>
                  <td style={{padding:'10px 16px',fontSize:13,color:'#333'}}>{it.name_tr||it.name_en||it.name_ka}</td>
                  <td style={{padding:'10px 16px',fontSize:13,color:'#999'}}>{Number(it.price).toFixed(2)} ₾</td>
                  <td style={{padding:'10px 16px'}}>
                    <input type="number" step="0.01" value={newP ?? it.price}
                      onChange={e=>setPrice(it.id, e.target.value)}
                      style={{width:90,padding:'6px 10px',border:`1px solid ${changed?'#1D9E75':'#e8e8e4'}`,
                        borderRadius:6,fontSize:13,fontWeight:changed?700:400,
                        color:changed?'#1D9E75':'#333'}} />
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr><td colSpan={3} style={{padding:30,textAlign:'center',color:'#bbb',fontSize:13}}>Ürün yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
