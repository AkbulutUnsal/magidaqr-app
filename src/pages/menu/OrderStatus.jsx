import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

const STATUS_STEPS = ['pending','confirmed','preparing','ready','served']
const STATUS_ICONS = { pending:'⏳', confirmed:'✅', preparing:'👨‍🍳', ready:'🔔', served:'🍽️', cancelled:'❌' }

const STATUS_LABELS = {
  pending:    { ka:'მოლოდინი',   en:'Pending',     tr:'Bekliyor',      ru:'Ожидание' },
  confirmed:  { ka:'დადასტურდა', en:'Confirmed',   tr:'Onaylandı',     ru:'Принят' },
  preparing:  { ka:'მზადდება',  en:'Preparing',   tr:'Hazırlanıyor',  ru:'Готовится' },
  ready:      { ka:'მზადაა',    en:'Ready',       tr:'Hazır',         ru:'Готово' },
  served:     { ka:'მიტანილია', en:'Served',      tr:'Servis edildi', ru:'Подано' },
  cancelled:  { ka:'გაუქმდა',   en:'Cancelled',   tr:'İptal',         ru:'Отменён' },
}

export default function OrderStatus() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const lang = i18n.language || 'en'

  const [order, setOrder] = useState(null)
  const [waiterSent, setWaiterSent] = useState(false)
  const [billSent, setBillSent] = useState(false)
  const [restaurant, setRestaurant] = useState(null)
  const [survey, setSurvey] = useState(null)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [surveyDone, setSurveyDone] = useState(false)

  useEffect(() => {
    supabase.from('orders')
      .select('*, order_items(*, menu_item:menu_items(name_ka,name_en,name_tr,name_ru)), table:tables(table_number,label), restaurant:restaurants(*)')
      .eq('id', orderId).single()
      .then(({ data }) => {
        setOrder(data)
        setRestaurant(data?.restaurant)
        if (data?.restaurant?.id) {
          supabase.from('surveys').select('*')
            .eq('restaurant_id', data.restaurant.id).eq('is_active', true)
            .order('created_at', { ascending:false }).limit(1).maybeSingle()
            .then(({ data: s }) => setSurvey(s))
        }
      })

    const channel = supabase.channel(`order-${orderId}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders', filter:`id=eq.${orderId}` },
        ({ new: updated }) => setOrder(prev => prev ? { ...prev, ...updated } : updated))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [orderId])

  const sendCall = async (type) => {
    if (!restaurant || !order?.table_id) return
    if (type === 'waiter' && waiterSent) return
    if (type === 'bill' && billSent) return
    if (type === 'waiter') setWaiterSent(true)
    if (type === 'bill') setBillSent(true)
    await supabase.from('table_calls').insert({
      restaurant_id: restaurant.id,
      table_id: order.table_id,
      type,
      status: 'open'
    })
    setTimeout(() => {
      if (type === 'waiter') setWaiterSent(false)
      if (type === 'bill') setBillSent(false)
    }, 5000)
  }

  async function submitSurvey() {
    if (!rating || !restaurant) return
    await supabase.from('survey_responses').insert({
      survey_id: survey?.id || null,
      restaurant_id: restaurant.id,
      rating,
      comment: comment.trim() || null,
      table_id: order?.table_id || null
    })
    setSurveyDone(true)
  }

  if (!order) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#f8f7f5'}}>
      <div style={{width:32,height:32,border:'3px solid #e8e8e4',borderTop:'3px solid #1D9E75',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const stepIdx   = STATUS_STEPS.indexOf(order.status)
  const isServed  = order.status === 'served'
  const isCancelled = order.status === 'cancelled'
  const brand     = restaurant?.brand_color || '#1D9E75'
  const n = (obj, field='name') => obj?.[`${field}_${lang}`] || obj?.[`${field}_en`] || obj?.[`${field}_ka`] || ''

  const WAITER = { ka:'გარსონი', en:'Call waiter', tr:'Garson çağır', ru:'Официант' }
  const BILL   = { ka:'ანგარიში', en:'Bill please', tr:'Hesap iste',   ru:'Счёт' }

  return (
    <div style={{minHeight:'100vh',background:'#f8f7f5',fontFamily:'Inter,system-ui,sans-serif',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px 100px'}}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} @keyframes pop{0%{transform:scale(0.8)}60%{transform:scale(1.1)}100%{transform:scale(1)}}`}</style>

      <div style={{width:'100%',maxWidth:420}}>

        {/* Status card */}
        <div style={{background:'#fff',borderRadius:20,padding:'28px 24px',marginBottom:16,
          boxShadow:'0 4px 24px rgba(0,0,0,.08)',animation:'fadeUp .3s ease',textAlign:'center'}}>

          {/* Icon */}
          <div style={{fontSize:52,marginBottom:12,animation:'pop .4s ease'}}>{STATUS_ICONS[order.status]}</div>

          {/* Status label */}
          <h2 style={{fontSize:22,fontWeight:800,marginBottom:6,color: isServed?brand : isCancelled?'#ef4444':'#111'}}>
            {STATUS_LABELS[order.status]?.[lang] || order.status}
          </h2>

          {order.table && (
            <p style={{fontSize:13,color:'#aaa',marginBottom:16}}>
              Masa {order.table.table_number}{order.table.label ? ` — ${order.table.label}` : ''}
            </p>
          )}

          {/* Progress steps */}
          {!isCancelled && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:0,marginBottom:20}}>
              {STATUS_STEPS.filter(s=>s!=='cancelled').map((step,i) => {
                const done = i <= stepIdx
                const active = i === stepIdx
                return (
                  <div key={step} style={{display:'flex',alignItems:'center'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <div style={{width:active?32:22,height:active?32:22,borderRadius:'50%',
                        background: done ? brand : '#e8e8e4',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        transition:'all .3s',boxShadow: active ? `0 0 0 4px ${brand}25` : 'none'}}>
                        {done && <svg width={active?14:10} height={active?14:10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span style={{fontSize:9,color:done?brand:'#bbb',fontWeight:done?700:400,whiteSpace:'nowrap'}}>
                        {STATUS_LABELS[step]?.[lang]}
                      </span>
                    </div>
                    {i < STATUS_STEPS.filter(s=>s!=='cancelled').length-1 && (
                      <div style={{width:24,height:2,background:i<stepIdx?brand:'#e8e8e4',transition:'background .3s',marginBottom:16,flexShrink:0}}/>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Served message */}
          {isServed && (
            <div style={{background:brand+'12',border:`1px solid ${brand}30`,borderRadius:12,padding:'12px 16px',marginBottom:0}}>
              <p style={{fontSize:14,color:brand,fontWeight:600}}>
                🎉 {lang==='ka'?'გემრიელად მიირთვით!':lang==='tr'?'Afiyet olsun!':lang==='ru'?'Приятного аппетита!':'Enjoy your meal!'}
              </p>
            </div>
          )}
        </div>

        {/* Sipariş detayı */}
        <div style={{background:'#fff',borderRadius:16,padding:'18px 20px',marginBottom:16,boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
          <h3 style={{fontSize:13,fontWeight:700,marginBottom:12,color:'#333'}}>
            {lang==='tr'?'Sipariş Detayı':lang==='ka'?'შეკვეთის დეტალი':'Order Details'}
          </h3>
          {order.order_items?.map(oi => (
            <div key={oi.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #f4f4f2'}}>
              <span style={{fontSize:13,color:'#333'}}>{oi.quantity}× {n(oi.menu_item)}</span>
              <span style={{fontSize:13,fontWeight:600,color:'#555'}}>{(oi.unit_price*oi.quantity).toFixed(2)} ₾</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',paddingTop:10,marginTop:4}}>
            <span style={{fontSize:14,fontWeight:700}}>Toplam</span>
            <span style={{fontSize:16,fontWeight:800,color:brand}}>{Number(order.total_price).toFixed(2)} ₾</span>
          </div>
        </div>

        {/* Aksiyon butonları — servis edildikten sonra */}
        {isServed && (
          <div style={{display:'flex',flexDirection:'column',gap:10,animation:'fadeUp .3s ease'}}>
            {/* Garson çağır */}
            <button onClick={()=>sendCall('waiter')} disabled={waiterSent}
              style={{padding:'14px',background:waiterSent?'#e0e0e0':brand,color:'#fff',border:'none',
                borderRadius:14,fontSize:14,fontWeight:700,cursor:waiterSent?'default':'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                boxShadow:waiterSent?'none':`0 4px 16px ${brand}40`,transition:'all .2s'}}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {waiterSent ? '✓ Gönderildi!' : (WAITER[lang]||WAITER.en)}
            </button>

            {/* Hesap iste */}
            <button onClick={()=>sendCall('bill')} disabled={billSent}
              style={{padding:'14px',background:billSent?'#e0e0e0':'#f59e0b',color:'#fff',border:'none',
                borderRadius:14,fontSize:14,fontWeight:700,cursor:waiterSent?'default':'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                boxShadow:billSent?'none':'0 4px 16px rgba(245,158,11,.4)',transition:'all .2s'}}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/>
              </svg>
              {billSent ? '✓ Gönderildi!' : (BILL[lang]||BILL.en)}
            </button>

            {/* Yeni sipariş */}
            <button onClick={()=>navigate(`/menu/${restaurant?.slug}/${order.table_id}`)}
              style={{padding:'14px',background:'transparent',color:'#666',border:'1.5px solid #e8e8e4',
                borderRadius:14,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor=brand;e.currentTarget.style.color=brand}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#e8e8e4';e.currentTarget.style.color='#666'}}>
              + {lang==='tr'?'Yeni Sipariş Ver':lang==='ka'?'ახალი შეკვეთა':'New Order'}
            </button>

            {/* Anket / Değerlendirme */}
            <div style={{background:'#fff',borderRadius:16,padding:'20px',marginTop:4,
              boxShadow:'0 2px 12px rgba(0,0,0,.06)',textAlign:'center'}}>
              {surveyDone ? (
                <div style={{padding:'8px 0'}}>
                  <div style={{fontSize:32,marginBottom:6}}>🙏</div>
                  <p style={{fontSize:14,fontWeight:600,color:brand}}>
                    {lang==='tr'?'Değerlendirmeniz için teşekkürler!':
                     lang==='ka'?'მადლობა შეფასებისთვის!':
                     lang==='ru'?'Спасибо за отзыв!':'Thanks for your feedback!'}
                  </p>
                </div>
              ) : (
                <>
                  <p style={{fontSize:14,fontWeight:700,color:'#333',marginBottom:14}}>
                    {survey ? n(survey,'question') :
                     (lang==='tr'?'Deneyiminizi değerlendirin':
                      lang==='ka'?'შეაფასეთ თქვენი გამოცდილება':
                      lang==='ru'?'Оцените ваш опыт':'Rate your experience')}
                  </p>
                  <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:14}}>
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={()=>setRating(star)}
                        onMouseEnter={()=>setHover(star)} onMouseLeave={()=>setHover(0)}
                        style={{background:'none',border:'none',cursor:'pointer',fontSize:34,padding:0,
                          color:(hover||rating)>=star?'#f59e0b':'#e0e0e0',transition:'color .15s'}}>
                        ★
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <div style={{animation:'fadeUp .3s ease'}}>
                      <textarea value={comment} onChange={e=>setComment(e.target.value)}
                        placeholder={lang==='tr'?'Yorumunuz (opsiyonel)':lang==='ka'?'კომენტარი (არასავალდებულო)':lang==='ru'?'Комментарий (необязательно)':'Comment (optional)'}
                        rows={2} style={{width:'100%',padding:'10px 12px',border:'1px solid #e8e8e4',
                          borderRadius:10,fontSize:13,resize:'none',fontFamily:'inherit',marginBottom:10,
                          boxSizing:'border-box'}} />
                      <button onClick={submitSurvey}
                        style={{width:'100%',padding:'12px',background:brand,color:'#fff',border:'none',
                          borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                        {lang==='tr'?'Gönder':lang==='ka'?'გაგზავნა':lang==='ru'?'Отправить':'Submit'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Beklenirken de garson çağır butonu */}
        {!isServed && !isCancelled && (
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>sendCall('waiter')} disabled={waiterSent}
              style={{flex:1,padding:'12px',background:'#fff',color:waiterSent?'#aaa':brand,
                border:`1.5px solid ${waiterSent?'#e0e0e0':brand+'40'}`,borderRadius:12,
                fontSize:13,fontWeight:600,cursor:waiterSent?'default':'pointer'}}>
              {waiterSent?'✓ Gönderildi':(WAITER[lang]||WAITER.en)}
            </button>
            <button onClick={()=>sendCall('bill')} disabled={billSent}
              style={{flex:1,padding:'12px',background:'#fff',color:billSent?'#aaa':'#f59e0b',
                border:`1.5px solid ${billSent?'#e0e0e0':'#f59e0b40'}`,borderRadius:12,
                fontSize:13,fontWeight:600,cursor:billSent?'default':'pointer'}}>
              {billSent?'✓ Gönderildi':(BILL[lang]||BILL.en)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
