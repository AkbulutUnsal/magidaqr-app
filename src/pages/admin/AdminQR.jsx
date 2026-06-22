import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'

export default function AdminQR() {
  const [tables, setTables] = useState([])
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [qrColor, setQrColor] = useState('#000000')
  const [qrBg, setQrBg] = useState('#ffffff')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: rest } = await supabase.from('restaurants').select('*').limit(1).single()
    setRestaurant(rest)
    if (rest) {
      const { data: t } = await supabase.from('tables').select('*').eq('restaurant_id', rest.id).order('table_number')
      setTables(t || [])
      if (t?.length > 0) setSelected(t[0])
    }
    setLoading(false)
  }

  function downloadQR() {
    if (!selected) return
    const canvas = document.getElementById('qr-canvas')?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-masa-${selected.table_number}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const menuUrl = restaurant && selected
    ? `${window.location.origin}/menu/${restaurant.slug}/${selected.id}`
    : ''

  if (loading) return <div style={{textAlign:'center',padding:64,color:'#aaa'}}>Yükleniyor...</div>

  return (
    <div style={{maxWidth:960,margin:'0 auto'}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>QR Stüdyo</h1>
        <p style={{fontSize:13,color:'#aaa'}}>Her masa için QR kod oluştur ve indir</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:20,alignItems:'start'}}>

        {/* Masa listesi */}
        <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid #f0f0ee',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,fontWeight:700}}>Masalar</span>
            <span style={{fontSize:11,color:'#aaa'}}>{tables.length}</span>
          </div>
          <div style={{maxHeight:460,overflowY:'auto'}}>
            {tables.map(t=>(
              <button key={t.id} onClick={()=>setSelected(t)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 16px',border:'none',
                  background:selected?.id===t.id?'#e8f5ee':'transparent',cursor:'pointer',textAlign:'left',
                  borderLeft:`3px solid ${selected?.id===t.id?'#1D9E75':'transparent'}`,transition:'all .12s'}}>
                <div style={{width:32,height:32,borderRadius:8,background:selected?.id===t.id?'#1D9E75':'#f4f4f2',
                  color:selected?.id===t.id?'#fff':'#666',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:12,fontWeight:700,flexShrink:0}}>
                  {t.table_number}
                </div>
                <div>
                  <p style={{fontSize:12,fontWeight:600,color:selected?.id===t.id?'#1D9E75':'#111'}}>Masa {t.table_number}</p>
                  {t.label && <p style={{fontSize:10,color:'#aaa'}}>{t.label}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* QR Preview */}
        {selected && menuUrl ? (
          <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:28}}>
            <div style={{display:'flex',gap:40,alignItems:'flex-start',flexWrap:'wrap'}}>
              {/* QR */}
              <div style={{textAlign:'center'}}>
                <div id="qr-canvas" style={{display:'inline-block',background:qrBg,padding:16,borderRadius:12,border:'1px solid #e8e8e4',boxShadow:'0 4px 16px rgba(0,0,0,.06)'}}>
                  <QRCodeCanvas
                    value={menuUrl}
                    size={220}
                    fgColor={qrColor}
                    bgColor={qrBg}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p style={{fontSize:12,fontWeight:600,marginTop:10}}>Masa {selected.table_number}</p>
                {selected.label && <p style={{fontSize:11,color:'#aaa'}}>{selected.label}</p>}
                <p style={{fontSize:9,color:'#ccc',marginTop:6,fontFamily:'monospace',wordBreak:'break-all',maxWidth:250}}>{menuUrl}</p>
              </div>

              {/* Controls */}
              <div style={{flex:1,minWidth:180}}>
                <h3 style={{fontSize:14,fontWeight:700,marginBottom:18}}>Özelleştir</h3>

                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>QR Rengi</label>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <input type="color" value={qrColor} onChange={e=>setQrColor(e.target.value)}
                      style={{width:40,height:36,border:'1px solid #e8e8e4',borderRadius:8,cursor:'pointer',padding:2,background:'#fff'}}/>
                    <span style={{fontSize:12,color:'#666',fontFamily:'monospace'}}>{qrColor}</span>
                  </div>
                </div>

                <div style={{marginBottom:20}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>Arka Plan</label>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <input type="color" value={qrBg} onChange={e=>setQrBg(e.target.value)}
                      style={{width:40,height:36,border:'1px solid #e8e8e4',borderRadius:8,cursor:'pointer',padding:2,background:'#fff'}}/>
                    <span style={{fontSize:12,color:'#666',fontFamily:'monospace'}}>{qrBg}</span>
                  </div>
                </div>

                {/* Hazır temalar */}
                <div style={{marginBottom:24}}>
                  <p style={{fontSize:12,fontWeight:600,color:'#666',marginBottom:8}}>Hazır Temalar</p>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {[
                      {dark:'#000000',light:'#ffffff',label:'Klasik'},
                      {dark:'#1D9E75',light:'#ffffff',label:'Yeşil'},
                      {dark:'#E8192C',light:'#ffffff',label:'Kırmızı'},
                      {dark:'#1a1a1a',light:'#f9f9f7',label:'Koyu'},
                    ].map((c,i)=>(
                      <button key={i} onClick={()=>{setQrColor(c.dark);setQrBg(c.light)}}
                        style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',border:`1.5px solid ${qrColor===c.dark?'#1D9E75':'#e8e8e4'}`,borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,
                          background:qrColor===c.dark?'#e8f5ee':'#fff',color:qrColor===c.dark?'#1D9E75':'#333',transition:'all .15s'}}>
                        <div style={{width:10,height:10,borderRadius:'50%',background:c.dark}}/>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={downloadQR}
                  style={{padding:'11px 24px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 12px rgba(29,158,117,.3)'}}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  PNG İndir
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{background:'#fff',border:'1px solid #e8e8e4',borderRadius:12,padding:48,textAlign:'center',color:'#ccc'}}>
            <p style={{fontSize:48,marginBottom:12}}>🖨️</p>
            <p style={{fontSize:14}}>Soldaki listeden masa seçin</p>
          </div>
        )}
      </div>
    </div>
  )
}
