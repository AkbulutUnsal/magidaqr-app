import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminImport() {
  const { profile } = useAuth()
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  // ── EXPORT ──
  async function exportCSV() {
    const { data: items } = await supabase.from('menu_items')
      .select('name_ka,name_en,name_tr,name_ru,description_en,price,category:menu_categories(name_en)')
      .eq('restaurant_id', profile.restaurant_id)

    const header = ['name_ka','name_en','name_tr','name_ru','description_en','price','category']
    const rows = (items||[]).map(i => [
      i.name_ka, i.name_en, i.name_tr, i.name_ru, i.description_en, i.price, i.category?.name_en
    ].map(v => `"${(v??'').toString().replace(/"/g,'""')}"`).join(','))

    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'menu_export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── IMPORT ──
  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setResult(null)

    const text = await file.text()
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l=>l.trim())
    if (lines.length < 2) { setResult({ ok:0, err:['Boş dosya'] }); setImporting(false); return }

    const header = parseRow(lines[0])
    const idx = (name) => header.indexOf(name)

    // Kategorileri çek (eşleştirme için)
    const { data: cats } = await supabase.from('menu_categories')
      .select('id,name_en').eq('restaurant_id', profile.restaurant_id)
    const catMap = {}
    ;(cats||[]).forEach(c => { catMap[(c.name_en||'').toLowerCase()] = c.id })

    let ok = 0
    const errors = []

    for (let i=1; i<lines.length; i++) {
      const row = parseRow(lines[i])
      const name_en = row[idx('name_en')]
      const price = parseFloat(row[idx('price')])
      if (!name_en || isNaN(price)) { errors.push(`Satır ${i+1}: isim/fiyat eksik`); continue }

      const catName = (row[idx('category')]||'').toLowerCase()
      const payload = {
        restaurant_id: profile.restaurant_id,
        name_ka: row[idx('name_ka')] || '',
        name_en, name_tr: row[idx('name_tr')] || '',
        name_ru: row[idx('name_ru')] || '',
        description_en: row[idx('description_en')] || '',
        price,
        category_id: catMap[catName] || null,
        is_available: true
      }
      const { error } = await supabase.from('menu_items').insert(payload)
      if (error) errors.push(`Satır ${i+1}: ${error.message}`)
      else ok++
    }

    setResult({ ok, err: errors })
    setImporting(false)
    e.target.value = ''
  }

  function parseRow(line) {
    const out = []; let cur = ''; let q = false
    for (let ch of line) {
      if (ch === '"') q = !q
      else if (ch === ',' && !q) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map(s => s.replace(/^"|"$/g,'').replace(/""/g,'"').trim())
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Import / Export</h1>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,maxWidth:760}}>
        {/* Export */}
        <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:24}}>
          <div style={{fontSize:32,marginBottom:8}}>📤</div>
          <h3 style={{fontSize:16,fontWeight:700,color:'#222',marginBottom:6}}>Dışa Aktar</h3>
          <p style={{fontSize:13,color:'#888',marginBottom:16,lineHeight:1.5}}>
            Tüm ürünlerini CSV olarak indir. Excel'de açıp düzenleyebilirsin.
          </p>
          <button className="btn-primary" onClick={exportCSV} style={{width:'100%'}}>
            CSV İndir
          </button>
        </div>

        {/* Import */}
        <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:24}}>
          <div style={{fontSize:32,marginBottom:8}}>📥</div>
          <h3 style={{fontSize:16,fontWeight:700,color:'#222',marginBottom:6}}>İçe Aktar</h3>
          <p style={{fontSize:13,color:'#888',marginBottom:16,lineHeight:1.5}}>
            CSV yükle, ürünler eklensin. Başlıklar: name_en, price, category...
          </p>
          <label style={{display:'block',width:'100%',padding:'10px',borderRadius:8,
            background:importing?'#f0f0ee':'#1D9E75',color:importing?'#999':'#fff',
            textAlign:'center',fontWeight:600,fontSize:14,cursor:importing?'default':'pointer'}}>
            {importing?'Yükleniyor...':'CSV Seç'}
            <input type="file" accept=".csv" onChange={handleFile} disabled={importing} style={{display:'none'}} />
          </label>
        </div>
      </div>

      {result && (
        <div style={{marginTop:20,maxWidth:760,background:'#fff',border:'1px solid #eee',borderRadius:12,padding:18}}>
          <p style={{fontSize:14,fontWeight:700,color:'#1D9E75'}}>✓ {result.ok} ürün eklendi</p>
          {result.err.length > 0 && (
            <div style={{marginTop:10}}>
              <p style={{fontSize:12,fontWeight:600,color:'#e8192c',marginBottom:6}}>{result.err.length} hata:</p>
              <ul style={{fontSize:12,color:'#888',paddingLeft:18,maxHeight:160,overflowY:'auto'}}>
                {result.err.map((e,i)=><li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div style={{marginTop:20,padding:14,background:'#fff8e8',border:'1px solid #ffe9b8',borderRadius:12,maxWidth:760}}>
        <p style={{fontSize:12,color:'#8a6d1a',lineHeight:1.5}}>
          💡 En kolay yöntem: Önce "CSV İndir" ile mevcut formatı al, Excel'de düzenle/ekle, sonra "CSV Seç" ile geri yükle.
          Kategori eşleştirmesi İngilizce kategori adına (name_en) göre yapılır.
        </p>
      </div>
    </div>
  )
}
