import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { setManualLanguage } from '../../i18n/langPreference'
import AdminFooter from '../../components/AdminFooter'

// ── Icons ──
const HomeIcon    = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const ChartIcon   = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
const QrIcon      = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
const AIIcon      = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>
const ReceiptIcon = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/></svg>
const CardIcon    = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
const GridIcon    = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
const FolderIcon  = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
const DishIcon    = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18"/><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><line x1="12" y1="3" x2="12" y2="1"/></svg>
const TagIcon     = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
const UploadIcon  = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const MapPinIcon  = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
const PackageIcon = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
const GlobeIcon   = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
const AlertIcon   = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const ImageIcon   = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
const ShareIcon   = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
const InfoIcon    = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const MegaphoneIcon=()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
const ClipboardIcon=()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
const TableIcon   = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 4 0v2"/></svg>
const UsersIcon   = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const ReportIcon  = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
const CogIcon     = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
const ShieldIcon  = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const ChefIcon    = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>
const BellIcon    = ()=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
const LockIcon    = ()=><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

// ── Nav structure ──
const NAV = [
  { sectionKey: null, items: [
    { to:'/admin',             labelKey:'dashboard',         Icon:HomeIcon,     end:true },
    { to:'/admin/analytics',   labelKey:'nav_analytics',     Icon:ChartIcon, restricted:true },
    { to:'/admin/orders',      labelKey:'orders',            Icon:ReceiptIcon, dot:true, restricted:true },
    { to:'/admin/mutfak',      labelKey:'nav_kitchen',       Icon:ChefIcon, dot:true, restricted:true },
    { to:'/admin/garson',      labelKey:'nav_waiter',        Icon:BellIcon, dot:true, restricted:true },
    { to:'/admin/qr',          labelKey:'nav_qr_studio',     Icon:QrIcon },
    { to:'/admin/ai',          labelKey:'nav_ai_assistant',  Icon:AIIcon, dot:true, restricted:true },
  ]},
  { sectionKey:'section_menu_content', items: [
    { to:'/admin/hero-cards',  labelKey:'nav_hero_cards',    Icon:CardIcon, restricted:true },
    { to:'/admin/sections',    labelKey:'nav_sections',      Icon:GridIcon, restricted:true },
    { to:'/admin/categories',  labelKey:'categories',        Icon:FolderIcon },
    { to:'/admin/menu',        labelKey:'items',             Icon:DishIcon },
    { to:'/admin/bulk-price',  labelKey:'nav_bulk_price',    Icon:TagIcon, restricted:true },
    { to:'/admin/import',      labelKey:'nav_import_export', Icon:UploadIcon, restricted:true },
  ]},
  { sectionKey:'section_configuration', items: [
    { to:'/admin/outlets',     labelKey:'nav_outlets',       Icon:MapPinIcon, restricted:true },
    { to:'/admin/delivery',    labelKey:'nav_delivery',      Icon:PackageIcon, restricted:true },
    { to:'/admin/languages',   labelKey:'nav_languages',     Icon:GlobeIcon, restricted:true },
    { to:'/admin/allergens',   labelKey:'nav_allergens',     Icon:AlertIcon },
  ]},
  { sectionKey:'section_marketing', items: [
    { to:'/admin/media',       labelKey:'nav_media',         Icon:ImageIcon, restricted:true },
    { to:'/admin/social',      labelKey:'nav_social',        Icon:ShareIcon, restricted:true },
    { to:'/admin/info-pages',  labelKey:'nav_info_pages',    Icon:InfoIcon, restricted:true },
    { to:'/admin/campaigns',   labelKey:'nav_campaigns',     Icon:MegaphoneIcon, restricted:true },
    { to:'/admin/survey',      labelKey:'nav_survey',        Icon:ClipboardIcon, restricted:true },
  ]},
  { sectionKey:'section_management', items: [
    { to:'/admin/tables',      labelKey:'tables',            Icon:TableIcon },
    { to:'/admin/staff',       labelKey:'staff',             Icon:UsersIcon, restricted:true },
    { to:'/admin/reports',     labelKey:'reports',           Icon:ReportIcon, restricted:true },
    { to:'/admin/settings',    labelKey:'settings',          Icon:CogIcon },
  ]},
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [mini, setMini] = useState(false)
  const [menuUrl, setMenuUrl] = useState(null)
  const [tenantPlan, setTenantPlan] = useState(null)
  const [lockMsg, setLockMsg] = useState(null)

  useEffect(() => {
    if (!profile?.restaurant_id) return
    let active = true
    ;(async () => {
      const [{ data: rest }, { data: tbl }] = await Promise.all([
        supabase.from('restaurants').select('slug').eq('id', profile.restaurant_id).single(),
        supabase.from('tables').select('id').eq('restaurant_id', profile.restaurant_id).order('table_number').limit(1),
      ])
      if (!active) return
      if (rest?.slug && tbl?.[0]?.id) setMenuUrl(`/menu/${rest.slug}/${tbl[0].id}`)
    })()
    return () => { active = false }
  }, [profile?.restaurant_id])

  useEffect(() => {
    if (!profile?.tenant_id) return
    let active = true
    supabase.from('tenants').select('plan').eq('id', profile.tenant_id).single().then(({ data }) => {
      if (active) setTenantPlan(data?.plan || null)
    })
    return () => { active = false }
  }, [profile?.tenant_id])

  function showLockMsg() {
    setLockMsg(t('feature_locked_msg'))
    clearTimeout(showLockMsg._t)
    showLockMsg._t = setTimeout(() => setLockMsg(null), 3200)
  }

  const out = async () => { await signOut(); navigate('/login') }
  const isSA = profile?.role === 'super_admin'
  const isLocked = (item) => item.restricted && tenantPlan === 'basic' && !isSA

  return (
    <div style={{display:'flex',height:'100vh',background:'#f5f5f3',fontFamily:'Inter,system-ui,sans-serif',fontSize:14}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        .nl{display:flex;align-items:center;gap:9px;padding:6px 10px;border-radius:8px;font-size:12.5px;font-weight:500;color:#6b6b63;text-decoration:none;transition:all .15s;white-space:nowrap;position:relative}
        .nl:hover{background:#f0f0ee;color:#111}
        .nl.on{background:#e8f5ee;color:#1D9E75;font-weight:700}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:4px}
      `}</style>

      {/* Sidebar */}
      <aside style={{width:mini?52:220,flexShrink:0,background:'#fff',borderRight:'1px solid #e8e8e4',display:'flex',flexDirection:'column',transition:'width .2s',overflow:'hidden'}}>
        {/* Logo */}
        <div style={{padding:'14px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #f0f0ee',minHeight:52,flexShrink:0}}>
          {!mini && <span style={{fontSize:16,fontWeight:900}}><span style={{color:'#1D9E75'}}>magida</span><span style={{color:'#E8192C'}}>QR</span></span>}
          <button onClick={()=>setMini(m=>!m)} style={{background:'none',border:'none',cursor:'pointer',color:'#bbb',padding:4,borderRadius:6,display:'flex',alignItems:'center',marginLeft:mini?'auto':0,flexShrink:0}}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* Nav */}
        <nav style={{flex:1,overflowY:'auto',padding:'8px 6px'}}>
          {NAV.map((g,gi)=>(
            <div key={gi} style={{marginBottom:14}}>
              {g.sectionKey && !mini && (
                <p style={{fontSize:10,fontWeight:700,color:'#bbb',letterSpacing:'0.07em',textTransform:'uppercase',padding:'0 6px',marginBottom:3}}>
                  {t(g.sectionKey)}
                </p>
              )}
              {g.items.map(item=>{
                const locked = isLocked(item)
                if (locked) {
                  return (
                    <button key={item.to} onClick={showLockMsg}
                      title={mini ? t(item.labelKey) : undefined}
                      className="nl"
                      style={{justifyContent:mini?'center':'flex-start', opacity:.45, cursor:'pointer', background:'none', border:'none', width:'100%', textAlign:'left'}}>
                      <item.Icon />
                      {!mini && <span style={{flex:1}}>{t(item.labelKey)}</span>}
                      {!mini && <LockIcon />}
                    </button>
                  )
                }
                return (
                  <NavLink key={item.to} to={item.to} end={item.end}
                    title={mini ? t(item.labelKey) : undefined}
                    className={({isActive})=>`nl${isActive?' on':''}`}
                    style={{justifyContent:mini?'center':'flex-start'}}>
                    <item.Icon />
                    {!mini && <span style={{flex:1}}>{t(item.labelKey)}</span>}
                    {!mini && item.dot && <span style={{width:7,height:7,borderRadius:'50%',background:'#1D9E75',flexShrink:0}}/>}
                  </NavLink>
                )
              })}
            </div>
          ))}

          {lockMsg && (
            <div style={{position:'fixed',bottom:70,left:'50%',transform:'translateX(-50%)',background:'#111',color:'#fff',
              borderRadius:12,padding:'10px 18px',fontSize:12.5,fontWeight:600,boxShadow:'0 8px 30px rgba(0,0,0,.3)',
              zIndex:200,whiteSpace:'nowrap'}}>
              🔒 {lockMsg}
            </div>
          )}

          {isSA && (
            <div style={{marginBottom:14}}>
              {!mini && <p style={{fontSize:10,fontWeight:700,color:'#bbb',letterSpacing:'0.07em',textTransform:'uppercase',padding:'0 6px',marginBottom:3}}>{t('section_super_admin')}</p>}
              <NavLink to="/super" title={mini?t('nav_company_management'):undefined}
                className={({isActive})=>`nl${isActive?' on':''}`}
                style={{justifyContent:mini?'center':'flex-start'}}>
                <ShieldIcon />
                {!mini && t('nav_company_management')}
              </NavLink>
            </div>
          )}
        </nav>

        {/* User */}
        <div style={{padding:'8px 6px',borderTop:'1px solid #f0f0ee',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px',borderRadius:8,background:'#f9f9f7'}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:'#1D9E75',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>
              {(profile?.full_name||'A')[0].toUpperCase()}
            </div>
            {!mini && <>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:11,fontWeight:600,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.full_name||'Admin'}</p>
                <p style={{fontSize:9,color:'#aaa'}}>{profile?.role}</p>
              </div>
              <button onClick={out} title={t('logout')} style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',padding:2,flexShrink:0}}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Topbar */}
        <header style={{background:'#fff',borderBottom:'1px solid #e8e8e4',padding:'0 24px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{background:'#f5f5f3',border:'1px solid #e8e8e4',borderRadius:8,padding:'6px 14px',display:'flex',alignItems:'center',gap:8,width:200,cursor:'text'}}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{fontSize:12,color:'#bbb'}}>{t('quick_search')}</span>
            <span style={{marginLeft:'auto',fontSize:9,color:'#ccc',background:'#eee',padding:'1px 4px',borderRadius:4}}>⌘K</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <AdminLangSwitcher i18n={i18n} />
            {menuUrl ? (
              <a href={menuUrl} target="_blank"
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:'#1D9E75',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600,textDecoration:'none'}}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {t('view_menu')}
              </a>
            ) : (
              <span title={profile?.role === 'super_admin' ? undefined : 'Önce bir masa ekleyin'}
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:'#e8e8e4',color:'#aaa',borderRadius:8,fontSize:12,fontWeight:600}}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {t('view_menu')}
              </span>
            )}
          </div>
        </header>
        <main style={{flex:1,overflowY:'auto',padding:'20px',display:'flex',flexDirection:'column'}}>
          <div style={{flex:1}}>
            <Outlet />
          </div>
          <AdminFooter />
        </main>
      </div>
    </div>
  )
}

// ── Admin dil switcher ──
function AdminLangSwitcher({ i18n }) {
  const [open, setOpen] = useState(false)
  const LANGS = [
    { code:'tr', img:'https://flagcdn.com/w40/tr.png', label:'Türkçe' },
    { code:'en', img:'https://flagcdn.com/w40/gb.png', label:'English' },
    { code:'ka', img:'https://flagcdn.com/w40/ge.png', label:'ქართული' },
    { code:'ru', img:'https://flagcdn.com/w40/ru.png', label:'Русский' },
  ]
  const cur = LANGS.find(l => l.code === i18n.language) || LANGS[0]

  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'#f5f5f3',
          border:'1px solid #e8e8e4', borderRadius:8, cursor:'pointer' }}>
        <img src={cur.img} alt={cur.code} style={{ width:18, height:13, objectFit:'cover', borderRadius:2 }} />
        <span style={{ fontSize:12, fontWeight:600, color:'#444' }}>{cur.code.toUpperCase()}</span>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:90 }} />
          <div style={{ position:'absolute', right:0, top:36, background:'#fff', border:'1px solid #e8e8e4',
            borderRadius:10, boxShadow:'0 8px 28px rgba(0,0,0,.12)', overflow:'hidden', zIndex:91, minWidth:145 }}>
            {LANGS.map(({ code, img, label }) => (
              <button key={code} onClick={() => { setManualLanguage(i18n, code); setOpen(false) }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
                  border:'none', cursor:'pointer', background: i18n.language===code ? '#e8f5ee' : '#fff' }}>
                <img src={img} alt={code} style={{ width:18, height:13, objectFit:'cover', borderRadius:2 }} />
                <span style={{ fontSize:12.5, fontWeight: i18n.language===code?700:500,
                  color: i18n.language===code?'#1D9E75':'#333' }}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
