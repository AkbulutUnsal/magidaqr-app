import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import CartDrawer from '../../components/CartDrawer'

const LANG_FLAGS = { ka:'GE', en:'EN', tr:'TR', ru:'RU' }
const LANG_NAMES = { ka:'ქართული', en:'English', tr:'Türkçe', ru:'Русский' }
const FLAG_IMGS  = { ka:'https://flagcdn.com/w40/ge.png', en:'https://flagcdn.com/w40/gb.png', tr:'https://flagcdn.com/w40/tr.png', ru:'https://flagcdn.com/w40/ru.png' }

const CAT_ICONS = {
  main:    (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18"/><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><line x1="12" y1="3" x2="12" y2="1"/></svg>,
  salad:   (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"/><path d="M12 13V3"/><path d="M8 7c0-2 2-4 4-4s4 2 4 4"/></svg>,
  drink:   (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3H7l-2 7h14l-2-7z"/><path d="M5 10c0 6 3 9 7 9s7-3 7-9"/></svg>,
  dessert: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><path d="M12 3c2 0 5 1.5 5 5s-3 5-5 5-5-1.5-5-5 3-5 5-5z"/></svg>,
  soup:    (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c1 2 1 4 0 6"/><path d="M8 4c0 2 1 3 1 5"/><path d="M16 4c0 2-1 3-1 5"/><path d="M4 11h16"/><path d="M4 11c0 5 3.5 8 8 8s8-3 8-8"/></svg>,
  all:     (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18"/><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><line x1="12" y1="3" x2="12" y2="1"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/></svg>,
  default: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18"/><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><line x1="12" y1="3" x2="12" y2="1"/></svg>,
}

export default function MenuPage() {
  const { restaurantSlug, tableId } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = i18n.language

  const [restaurant, setRestaurant] = useState(null)
  const [tableInfo, setTableInfo]   = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems]           = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart]             = useState([])
  const [cartOpen, setCartOpen]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [callSent, setCallSent]     = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [scrolled, setScrolled]     = useState(false)
  const headerRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: rest } = await supabase.from('restaurants').select('*').eq('slug', restaurantSlug).single()
      if (!rest) return
      setRestaurant(rest)
      if (!['ka','en','tr','ru'].includes(lang)) i18n.changeLanguage(rest.default_lang)
      const { data: table } = await supabase.from('tables').select('*').eq('id', tableId).single()
      setTableInfo(table)
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', rest.id).eq('is_active', true).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', rest.id).order('sort_order')
      ])
      setCategories(cats || [])
      setItems(menuItems || [])
      setLoading(false)
    }
    load()
  }, [restaurantSlug, tableId])

  useEffect(() => {
    const el = document.getElementById('menu-scroll-container')
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 60)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading])

  const n = (obj, field='name') => obj?.[`${field}_${lang}`] || obj?.[`${field}_en`] || obj?.[`${field}_ka`] || ''

  const filteredItems = useMemo(() => items.filter(item => {
    const matchCat = !activeCategory || item.category_id === activeCategory
    return matchCat && item.is_available
  }), [items, activeCategory, lang])

  const featuredItems = useMemo(() => items.filter(i => i.is_featured && i.is_available), [items])

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id)
      if (ex) return prev.map(c => c.id === item.id ? {...c, qty: c.qty+1} : c)
      return [...prev, { ...item, qty: 1 }]
    })
    setDetailItem(null)
  }

  const cartCount = cart.reduce((s,c) => s+c.qty, 0)
  const cartTotal = cart.reduce((s,c) => s+c.price*c.qty, 0)

  const placeOrder = async (note) => {
    const { data: order, error } = await supabase.from('orders')
      .insert({ restaurant_id: restaurant.id, table_id: tableId, note, total_price: cartTotal, lang })
      .select().single()
    if (error || !order) return alert(t('error'))
    await supabase.from('order_items').insert(cart.map(c => ({ order_id: order.id, menu_item_id: c.id, quantity: c.qty, unit_price: c.price })))
    setCart([]); setCartOpen(false)
    navigate(`/order/${order.id}`)
  }

  const [sending, setSending] = useState(false)
  const sendCall = async (type) => {
    if (!restaurant || !tableId || callSent || sending) return
    setSending(true)
    setCallSent(type)
    try {
      await supabase.from('table_calls').insert({ 
        restaurant_id: restaurant.id, 
        table_id: tableId, 
        type,
        status: 'pending'
      })
    } catch(e) { console.error(e) }
    setSending(false)
    setTimeout(() => setCallSent(null), 5000)
  }

  const selectCategory = (id) => {
    setActiveCategory(id)
    setTimeout(() => {
      const el = id ? document.getElementById(`cat-${id}`) : document.getElementById('menu-start')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0a' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, border:'3px solid #333', borderTop:'3px solid #1D9E75', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color:'#555', fontSize:13 }}>Yükleniyor...</p>
      </div>
    </div>
  )

  const brand = restaurant?.brand_color || '#1D9E75'
  const WAITER = { ka:'გარსონი', en:'Call waiter', tr:'Garson çağır', ru:'Официант' }
  const BILL   = { ka:'ანგარიში', en:'Bill please',  tr:'Hesap iste',  ru:'Счёт' }

  return (
    <div style={{ maxWidth:480, margin:'0 auto', background:'#f8f7f5', minHeight:'100vh', fontFamily:'"Inter",system-ui,sans-serif', position:'relative' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes slideUpMenu { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        .item-card { transition: transform 0.18s ease, box-shadow 0.18s ease }
        .item-card:active { transform: scale(0.97) !important }
        .add-btn-anim:active { transform: scale(0.88) }
        .cat-scroll::-webkit-scrollbar { display:none }
        * { -webkit-tap-highlight-color: transparent }
      `}</style>

      {/* ── HERO HEADER ── */}
      <div ref={headerRef} style={{ position:'relative', height: restaurant?.cover_url ? 280 : 'auto' }}>
        {restaurant?.cover_url && (
          <>
            <img src={restaurant.cover_url} alt="cover"
              style={{ width:'100%', height:280, objectFit:'cover', display:'block' }} />
            {/* Gradient overlay */}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)' }} />
          </>
        )}

        {/* Sticky mini header — scrolled olunca çıkar */}
        {scrolled && (
          <div style={{ position:'fixed', top:0, left:'50%', transform:'translateX(-50%)',
            width:'100%', maxWidth:480, background:'rgba(255,255,255,0.97)',
            backdropFilter:'blur(12px)', borderBottom:'1px solid #ebebeb',
            padding:'10px 16px', display:'flex', alignItems:'center', gap:10,
            zIndex:40, animation:'fadeIn 0.2s ease', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt="logo" style={{ width:32, height:32, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
            )}
            <span style={{ fontWeight:700, fontSize:14, color:'#111', flex:1 }}>{n(restaurant)}</span>
            {tableInfo && (
              <span style={{ background:brand+'18', color:brand, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>
                #{tableInfo.table_number}
              </span>
            )}
            <LangBtn lang={lang} i18n={i18n} brand={brand} small />
          </div>
        )}

        {/* Ana header içeriği */}
        <div style={{ position: restaurant?.cover_url ? 'absolute' : 'relative',
          bottom: restaurant?.cover_url ? 0 : 'auto',
          left:0, right:0, padding:'14px 16px 16px',
          background: restaurant?.cover_url ? 'transparent' : '#fff',
          borderBottom: restaurant?.cover_url ? 'none' : '1px solid #ebebeb' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:12 }}>
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt="logo"
                style={{ width:54, height:54, borderRadius:14, objectFit:'cover',
                  border:'2.5px solid rgba(255,255,255,0.9)', flexShrink:0,
                  boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }} />
            ) : (
              <div style={{ width:54, height:54, borderRadius:14, background:brand,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }}>
                <span style={{ color:'#fff', fontSize:24, fontWeight:800 }}>{(n(restaurant)||'R')[0]}</span>
              </div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontSize:18, fontWeight:800, margin:0, lineHeight:1.2,
                color: restaurant?.cover_url ? '#fff' : '#111',
                textShadow: restaurant?.cover_url ? '0 1px 4px rgba(0,0,0,0.4)' : 'none' }}>
                {n(restaurant)}
              </h1>
              {restaurant?.address && (
                <p style={{ fontSize:11, margin:'3px 0 0',
                  color: restaurant?.cover_url ? 'rgba(255,255,255,0.8)' : '#999',
                  display:'flex', alignItems:'center', gap:3 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {restaurant.address}
                </p>
              )}
              {restaurant?.phone && (
                <p style={{ fontSize:11, margin:'2px 0 0',
                  color: restaurant?.cover_url ? 'rgba(255,255,255,0.75)' : '#999',
                  display:'flex', alignItems:'center', gap:3 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {restaurant.phone}
                </p>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
              <LangBtn lang={lang} i18n={i18n} brand={brand} />
              {tableInfo && (
                <div style={{ background: restaurant?.cover_url ? 'rgba(255,255,255,0.15)' : brand+'15',
                  backdropFilter: restaurant?.cover_url ? 'blur(8px)' : 'none',
                  border: `1px solid ${restaurant?.cover_url ? 'rgba(255,255,255,0.3)' : brand+'30'}`,
                  borderRadius:20, padding:'4px 10px', display:'flex', alignItems:'center', gap:4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke={restaurant?.cover_url ? '#fff' : brand} strokeWidth="2.5">
                    <rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 4 0v2"/>
                  </svg>
                  <span style={{ fontSize:11, fontWeight:800,
                    color: restaurant?.cover_url ? '#fff' : brand }}>
                    Masa <span style={{ fontSize:14 }}>{tableInfo.table_number}</span>
                    {tableInfo.label ? <span style={{ fontWeight:500, fontSize:10 }}> {tableInfo.label}</span> : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SCROLL CONTAINER ── */}
      <div id="menu-scroll-container" style={{ paddingBottom:140 }}>

        {/* Öne çıkan ürünler — yatay carousel */}
        {featuredItems.length > 0 && (
          <div style={{ padding:'20px 0 4px' }}>
            <h2 style={{ fontSize:14, fontWeight:700, color:'#111', padding:'0 16px', marginBottom:12,
              display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ background:brand, color:'#fff', fontSize:10, fontWeight:700,
                padding:'2px 8px', borderRadius:20 }}>★</span>
              {t('featured')}
            </h2>
            <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'0 16px 8px',
              scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
              {featuredItems.map(item => (
                <div key={item.id} className="item-card"
                  onClick={() => setDetailItem(item)}
                  style={{ flexShrink:0, width:160, background:'#fff', borderRadius:18,
                    overflow:'hidden', cursor:'pointer', boxShadow:'0 4px 16px rgba(0,0,0,0.08)',
                    animation:'fadeUp 0.4s ease' }}>
                  <div style={{ height:110, background:'#f0f0ee', position:'relative' }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={n(item)} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>🍽️</div>
                    }
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)' }} />
                    <div style={{ position:'absolute', bottom:8, left:10, right:10 }}>
                      <p style={{ fontSize:11, fontWeight:700, color:'#fff', margin:0, lineHeight:1.3 }}>{n(item)}</p>
                      <p style={{ fontSize:12, fontWeight:800, color:'#fff', margin:'2px 0 0' }}>{item.price} ₾</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menü başlangıcı */}
        <div id="menu-start" />

        {/* Kategoriler + ürünler */}
        <div style={{ padding:'12px 16px 0' }}>
          {categories.filter(cat => !activeCategory || cat.id === activeCategory).map(cat => {
            const catItems = filteredItems.filter(i => i.category_id === cat.id)
            if (catItems.length === 0) return null
            return (
              <div key={cat.id} id={`cat-${cat.id}`} style={{ marginBottom:28 }}>
                {/* Kategori başlığı */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:brand+'15',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(CAT_ICONS[cat.icon] || CAT_ICONS.default)(brand)}
                  </div>
                  <h2 style={{ fontSize:16, fontWeight:800, color:'#111', margin:0 }}>{n(cat)}</h2>
                </div>

                {/* Ürün listesi — tek sütun, daha büyük */}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {catItems.map((item, idx) => (
                    <div key={item.id} className="item-card"
                      onClick={() => setDetailItem(item)}
                      style={{ background:'#fff', borderRadius:18, overflow:'hidden', cursor:'pointer',
                        boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                        display:'flex', animation:`fadeUp 0.4s ease ${idx*0.05}s both` }}>
                      {/* Sol — görsel */}
                      <div style={{ width:110, minHeight:110, background:'#f4f4f2', overflow:'hidden', flexShrink:0 }}>
                        {item.image_url
                          ? <img src={item.image_url} alt={n(item)} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>🍽️</div>
                        }
                      </div>
                      {/* Sağ — bilgi + ekle */}
                      <div style={{ flex:1, padding:'12px 12px 12px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:0 }}>
                        <div>
                          <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 4px', color:'#111', lineHeight:1.3 }}>{n(item)}</h3>
                          {n(item,'description') && (
                            <p style={{ fontSize:11, color:'#999', margin:'0 0 8px', lineHeight:1.5,
                              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                              {n(item,'description')}
                            </p>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:16, fontWeight:800, color:brand }}>{item.price} ₾</span>
                            {item.calories && (
                              <span style={{ fontSize:10, color:'#bbb', display:'flex', alignItems:'center', gap:2 }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 2c0 6-8 8-8 14a8 8 0 0 0 16 0c0-6-8-8-8-14z"/></svg>
                                {item.calories} kcal
                              </span>
                            )}
                          </div>
                          <button className="add-btn-anim"
                            onClick={e => { e.stopPropagation(); addToCart(item) }}
                            style={{ width:32, height:32, borderRadius:10, background:brand, color:'#fff',
                              border:'none', fontSize:22, cursor:'pointer', display:'flex',
                              alignItems:'center', justifyContent:'center', lineHeight:1,
                              boxShadow:`0 3px 10px ${brand}60`, flexShrink:0 }}>
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* WiFi */}
        {restaurant?.wifi_password && (
          <div style={{ margin:'8px 16px 16px', background:'#fff', borderRadius:14, padding:'12px 16px',
            display:'flex', alignItems:'center', gap:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand} strokeWidth="1.8"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>
            <div>
              <p style={{ fontSize:10, color:'#aaa', margin:0 }}>WiFi</p>
              <p style={{ fontSize:13, fontWeight:700, color:'#111', margin:0 }}>{restaurant.wifi_password}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR ── */}
      <BottomBar
        brand={brand} callSent={callSent} sendCall={sendCall}
        cartCount={cartCount} cartTotal={cartTotal} setCartOpen={setCartOpen}
        categories={categories} activeCategory={activeCategory}
        selectCategory={selectCategory} n={n} t={t}
        waiterLabel={WAITER[lang]||WAITER.en} billLabel={BILL[lang]||BILL.en}
      />

      {/* ── ÜRÜN DETAY MODAL ── */}
      {detailItem && (
        <div onClick={() => setDetailItem(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:70,
            display:'flex', alignItems:'flex-end', backdropFilter:'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%',
              maxHeight:'88vh', overflow:'auto', animation:'slideUpMenu 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
            {detailItem.image_url ? (
              <div style={{ height:260, position:'relative', overflow:'hidden' }}>
                <img src={detailItem.image_url} alt={n(detailItem)} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)' }} />
                <button onClick={() => setDetailItem(null)}
                  style={{ position:'absolute', top:14, right:14, width:36, height:36,
                    background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)',
                    border:'1px solid rgba(255,255,255,0.2)', borderRadius:'50%',
                    color:'#fff', fontSize:16, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                {detailItem.is_featured && (
                  <div style={{ position:'absolute', top:14, left:14, background:brand,
                    color:'#fff', fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:20 }}>★ {t('featured')}</div>
                )}
              </div>
            ) : (
              <div style={{ padding:'16px 16px 0', display:'flex', justifyContent:'flex-end' }}>
                <button onClick={() => setDetailItem(null)}
                  style={{ background:'#f0f0ee', border:'none', borderRadius:'50%', width:34, height:34,
                    cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
            )}
            <div style={{ padding:'20px 20px 36px' }}>
              <h2 style={{ fontSize:22, fontWeight:800, margin:'0 0 8px', color:'#111', lineHeight:1.2 }}>{n(detailItem)}</h2>
              {n(detailItem,'description') && (
                <p style={{ fontSize:14, color:'#666', lineHeight:1.7, margin:'0 0 14px' }}>{n(detailItem,'description')}</p>
              )}
              <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
                {detailItem.calories && (
                  <span style={{ background:'#fff8ed', color:'#b45309', fontSize:12, fontWeight:600,
                    padding:'4px 12px', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 2c0 6-8 8-8 14a8 8 0 0 0 16 0c0-6-8-8-8-14z"/></svg>
                    {detailItem.calories} kcal
                  </span>
                )}
                {detailItem.allergens?.map(a => (
                  <span key={a} style={{ background:'#fef2f2', color:'#dc2626', fontSize:11,
                    fontWeight:600, padding:'4px 10px', borderRadius:20 }}>⚠ {a}</span>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                paddingTop:16, borderTop:'1px solid #f4f4f2' }}>
                <div>
                  <p style={{ fontSize:11, color:'#aaa', margin:0 }}>Fiyat</p>
                  <span style={{ fontSize:28, fontWeight:900, color:brand }}>{detailItem.price} ₾</span>
                </div>
                <button onClick={() => addToCart(detailItem)}
                  style={{ background:brand, color:'#fff', border:'none', padding:'14px 32px',
                    borderRadius:16, fontSize:16, fontWeight:800, cursor:'pointer',
                    boxShadow:`0 6px 20px ${brand}55`, letterSpacing:.3 }}>
                  + {t('add_to_cart')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cartOpen && <CartDrawer cart={cart} setCart={setCart} onClose={() => setCartOpen(false)} onOrder={placeOrder} />}
    </div>
  )
}

// ── LANG BUTTON ──
function LangBtn({ lang, i18n, brand, small }) {
  const [open, setOpen] = useState(false)
  const LANGS = [
    { code:'ka', img:'https://flagcdn.com/w40/ge.png', label:'ქართული' },
    { code:'en', img:'https://flagcdn.com/w40/gb.png', label:'English' },
    { code:'tr', img:'https://flagcdn.com/w40/tr.png', label:'Türkçe' },
    { code:'ru', img:'https://flagcdn.com/w40/ru.png', label:'Русский' },
  ]
  const cur = LANGS.find(l => l.code === lang) || LANGS[0]
  const sz = small ? 28 : 34

  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:sz, height:sz, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.6)',
          overflow:'hidden', padding:0, cursor:'pointer', background:'#fff',
          boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>
        <img src={cur.img} alt={cur.code} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:80 }} />
          <div style={{ position:'absolute', right:0, top:sz+8, background:'#fff',
            borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
            border:'1px solid #ebebeb', overflow:'hidden', zIndex:81, minWidth:155,
            animation:'scaleIn 0.18s ease' }}>
            {LANGS.map(({ code, img, label }) => (
              <button key={code} onClick={() => { i18n.changeLanguage(code); setOpen(false) }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10,
                  padding:'10px 14px', border:'none', cursor:'pointer',
                  background: lang===code ? brand+'12' : '#fff',
                  borderLeft: lang===code ? `3px solid ${brand}` : '3px solid transparent' }}>
                <img src={img} alt={code} style={{ width:22, height:16, objectFit:'cover', borderRadius:3 }} />
                <span style={{ fontSize:13, fontWeight:lang===code?700:400,
                  color:lang===code?brand:'#333' }}>{label}</span>
                {lang===code && <svg style={{ marginLeft:'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── BOTTOM BAR ──
function BottomBar({ brand, callSent, sendCall, cartCount, cartTotal, setCartOpen, categories, activeCategory, selectCategory, n, t, waiterLabel, billLabel }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <style>{`@keyframes slideUpMenu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)}
            style={{ position:'fixed', inset:0, zIndex:58, background:'rgba(0,0,0,0.35)', backdropFilter:'blur(3px)' }} />
          <div style={{ position:'fixed', bottom:82, left:'50%', transform:'translateX(-50%)',
            width:'calc(100% - 24px)', maxWidth:440, background:'#fff',
            borderRadius:24, zIndex:59, overflow:'hidden',
            boxShadow:'0 -4px 40px rgba(0,0,0,0.2)', animation:'slideUpMenu 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ padding:'12px 16px 8px', borderBottom:'1px solid #f4f4f2',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:14, fontWeight:800, color:'#111' }}>Kategoriler</span>
              <button onClick={() => setMenuOpen(false)}
                style={{ background:'#f4f4f2', border:'none', borderRadius:'50%', width:28, height:28,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>✕</button>
            </div>
            <button onClick={() => { selectCategory(null); setMenuOpen(false) }}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                border:'none', cursor:'pointer', background: !activeCategory ? brand+'10' : '#fff',
                borderLeft: !activeCategory ? `3px solid ${brand}` : '3px solid transparent' }}>
              <div style={{ width:36, height:36, borderRadius:10, background: !activeCategory ? brand : '#f4f4f2',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                {(CAT_ICONS.all)(!activeCategory ? '#fff' : brand)}
              </div>
              <span style={{ fontSize:14, fontWeight: !activeCategory?700:400, color: !activeCategory?brand:'#333' }}>Tümü</span>
              {!activeCategory && <svg style={{ marginLeft:'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            {categories.map(cat => {
              const isActive = activeCategory === cat.id
              return (
                <button key={cat.id} onClick={() => { selectCategory(cat.id); setMenuOpen(false) }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    border:'none', cursor:'pointer', borderTop:'1px solid #f8f8f8',
                    background: isActive ? brand+'10' : '#fff',
                    borderLeft: isActive ? `3px solid ${brand}` : '3px solid transparent' }}>
                  <div style={{ width:36, height:36, borderRadius:10, background: isActive ? brand : '#f4f4f2',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(CAT_ICONS[cat.icon] || CAT_ICONS.default)(isActive ? '#fff' : brand)}
                  </div>
                  <span style={{ fontSize:14, fontWeight:isActive?700:400, color:isActive?brand:'#333' }}>{n(cat)}</span>
                  {isActive && <svg style={{ marginLeft:'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
        width:'100%', maxWidth:480, background:'rgba(255,255,255,0.97)',
        backdropFilter:'blur(12px)', borderTop:'1px solid rgba(235,235,235,0.8)',
        zIndex:60, display:'flex', alignItems:'center',
        padding:'8px 12px 22px', gap:6,
        boxShadow:'0 -4px 24px rgba(0,0,0,0.1)' }}>

        {/* Garson */}
        <button onClick={(e) => { e.preventDefault(); !callSent && sendCall('waiter') }} disabled={!!callSent}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'8px 4px', borderRadius:14, border:'none', cursor:callSent?'default':'pointer',
            background:callSent==='waiter'?'#f4f4f4':'#E1F5EE',
            opacity:callSent&&callSent!=='waiter'?0.4:1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={callSent==='waiter'?'#ccc':brand} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize:9, fontWeight:700, color:callSent==='waiter'?'#ccc':'#0F6E56', whiteSpace:'nowrap' }}>
            {callSent==='waiter'?'✓ Tamam':waiterLabel}
          </span>
        </button>

        {/* Menü zil */}
        <button onClick={() => setMenuOpen(o => !o)}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            background:'transparent', border:'none', cursor:'pointer', padding:'0 4px', flexShrink:0 }}>
          <div style={{ width:50, height:50, borderRadius:'50%',
            background: menuOpen ? '#c41020' : '#E8192C',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 18px rgba(232,25,44,0.45)', border:'3px solid #fff',
            transition:'all 0.2s', transform: menuOpen ? 'scale(0.92)' : 'scale(1)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17h18"/><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/>
              <line x1="12" y1="3" x2="12" y2="1"/>
            </svg>
          </div>
          <span style={{ fontSize:9, fontWeight:800, color:'#E8192C' }}>Menü</span>
        </button>

        {/* Hesap */}
        <button onClick={(e) => { e.preventDefault(); !callSent && sendCall('bill') }} disabled={!!callSent}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'8px 4px', borderRadius:14, border:'none', cursor:callSent?'default':'pointer',
            background:callSent==='bill'?'#f4f4f4':'#FAEEDA',
            opacity:callSent&&callSent!=='bill'?0.4:1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={callSent==='bill'?'#ccc':'#BA7517'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <line x1="9" y1="7" x2="15" y2="7"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
            <line x1="9" y1="15" x2="12" y2="15"/>
          </svg>
          <span style={{ fontSize:9, fontWeight:700, color:callSent==='bill'?'#ccc':'#633806', whiteSpace:'nowrap' }}>
            {callSent==='bill'?'✓ Tamam':billLabel}
          </span>
        </button>

        {/* Sepet */}
        <button onClick={() => setCartOpen(true)}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'8px 4px', borderRadius:14, border:'none', cursor:'pointer',
            background:cartCount>0?brand:'#f4f4f4', position:'relative' }}>
          {cartCount > 0 && (
            <div style={{ position:'absolute', top:4, right:6, width:16, height:16,
              background:'#E8192C', borderRadius:'50%', fontSize:9, fontWeight:800,
              color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 2px 6px rgba(232,25,44,0.4)' }}>
              {cartCount}
            </div>
          )}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={cartCount>0?'#fff':'#999'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span style={{ fontSize:9, fontWeight:700, color:cartCount>0?'#fff':'#999', whiteSpace:'nowrap' }}>
            {cartCount>0?`${cartTotal.toFixed(0)} ₾`:'Sepet'}
          </span>
        </button>
      </div>
    </>
  )
}
