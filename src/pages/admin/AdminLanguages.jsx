import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const LANGS = [
  { code:'ka', name:'ქართული (Gürcüce)', flag:'🇬🇪' },
  { code:'en', name:'English', flag:'🇬🇧' },
  { code:'tr', name:'Türkçe', flag:'🇹🇷' },
  { code:'ru', name:'Русский', flag:'🇷🇺' },
]

export default function AdminLanguages() {
  const { profile } = useAuth()
  const [enabled, setEnabled] = useState(['ka','en'])
  const [defaultLang, setDefaultLang] = useState('ka')
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: r } = await supabase.from('restaurants')
      .select('enabled_languages, default_language').eq('id', profile.restaurant_id).single()
    if (r?.enabled_languages) setEnabled(r.enabled_languages)
    if (r?.default_language) setDefaultLang(r.default_language)
  }

  async function save() {
    await supabase.from('restaurants')
      .update({ enabled_languages: enabled, default_language: defaultLang })
      .eq('id', profile.restaurant_id)
    setSaved(true); setTimeout(()=>setSaved(false), 2000)
  }

  function toggle(code) {
    setEnabled(prev => prev.includes(code)
      ? prev.filter(c=>c!==code)
      : [...prev, code])
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Diller & Çeviriler</h1>
        <button className="btn-primary" onClick={save}>{saved?'✓ Kaydedildi':'Kaydet'}</button>
      </div>
      <p style={{color:'#888',fontSize:13,marginBottom:20}}>Menüde gösterilecek dilleri ve varsayılan dili seçin.</p>

      <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:20,maxWidth:520}}>
        {LANGS.map(l => {
          const isOn = enabled.includes(l.code)
          const isDefault = defaultLang === l.code
          return (
            <div key={l.code} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',
              borderBottom:'1px solid #f4f4f2'}}>
              <span style={{fontSize:26}}>{l.flag}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:14,fontWeight:600,color:'#222'}}>{l.name}</p>
                <p style={{fontSize:11,color:'#bbb'}}>{l.code.toUpperCase()}</p>
              </div>
              {isOn && (
                <button onClick={()=>setDefaultLang(l.code)}
                  style={{padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',
                    border:'1px solid '+(isDefault?'#1D9E75':'#e8e8e4'),
                    background:isDefault?'#e8f5ee':'#fff',color:isDefault?'#1D9E75':'#999'}}>
                  {isDefault?'★ Varsayılan':'Varsayılan yap'}
                </button>
              )}
              <button onClick={()=>toggle(l.code)}
                style={{width:46,height:26,borderRadius:20,border:'none',cursor:'pointer',position:'relative',
                  background:isOn?'#1D9E75':'#ddd',transition:'background .2s'}}>
                <span style={{position:'absolute',top:3,left:isOn?23:3,width:20,height:20,borderRadius:'50%',
                  background:'#fff',transition:'left .2s'}} />
              </button>
            </div>
          )
        })}
      </div>

      <div style={{marginTop:20,padding:16,background:'#fff8e8',border:'1px solid #ffe9b8',borderRadius:12,maxWidth:520}}>
        <p style={{fontSize:12,color:'#8a6d1a'}}>
          💡 Ürün ve kategori çevirilerini "Ürünler" ve "Kategoriler" sayfalarından her dil için ayrı girebilirsiniz.
        </p>
      </div>
    </div>
  )
}
