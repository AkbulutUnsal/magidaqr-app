import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

export default function InfoPageView() {
  const { restaurantSlug, tableId, pageSlug } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const lang = i18n.language || 'ka'

  const [page, setPage] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: rest } = await supabase.from('restaurants').select('*').eq('slug', restaurantSlug).single()
      if (!rest) { setLoading(false); return }
      setRestaurant(rest)
      const { data: p } = await supabase.from('info_pages')
        .select('*').eq('restaurant_id', rest.id).eq('slug', pageSlug).eq('is_published', true).maybeSingle()
      setPage(p)
      setLoading(false)
    }
    load()
  }, [restaurantSlug, pageSlug])

  const brand = restaurant?.brand_color || '#1D9E75'
  const n = (obj, field) => obj?.[`${field}_${lang}`] || obj?.[`${field}_en`] || obj?.[`${field}_ka`] || ''

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#f8f7f5'}}>
      <div style={{width:32,height:32,border:'3px solid #e8e8e4',borderTop:`3px solid ${brand}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#f8f7f5',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{maxWidth:480,margin:'0 auto'}}>
        {/* Header */}
        <div style={{background:'#fff',padding:'16px',display:'flex',alignItems:'center',gap:12,
          borderBottom:'1px solid #ebebeb',position:'sticky',top:0,zIndex:10}}>
          <button onClick={()=>navigate(`/menu/${restaurantSlug}/${tableId}`)}
            style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span style={{fontSize:16,fontWeight:700,color:'#111'}}>
            {page ? n(page,'title') : 'Sayfa'}
          </span>
        </div>

        {/* İçerik */}
        <div style={{padding:'24px 20px 60px'}}>
          {page ? (
            <div style={{fontSize:15,color:'#444',lineHeight:1.8,whiteSpace:'pre-wrap'}}>
              {n(page,'content') || 'İçerik henüz eklenmemiş.'}
            </div>
          ) : (
            <div style={{textAlign:'center',padding:'60px 20px',color:'#bbb'}}>
              <div style={{fontSize:40,marginBottom:12}}>📄</div>
              <p style={{fontSize:15}}>Sayfa bulunamadı</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
