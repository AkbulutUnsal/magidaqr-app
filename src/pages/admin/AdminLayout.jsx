import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
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

// ── Nav structure ──
const NAV = [
  { section: null, items: [
    { to:'/admin',             label:'Dashboard',       Icon:HomeIcon,     end:true },
    { to:'/admin/analytics',   label:'Analitik',        Icon:ChartIcon },
    { to:'/admin/orders',      label:'Siparişler',      Icon:ReceiptIcon, dot:true },
    { to:'/admin/mutfak',      label:'Mutfak',          Icon:ChefIcon, dot:true },
    { to:'/admin/garson',      label:'Garson',          Icon:BellIcon, dot:true },
    { to:'/admin/qr',          label:'QR Stüdyo',       Icon:QrIcon },
    { to:'/admin/ai',          label:'AI Asistan',      Icon:AIIcon, dot:true },
  ]},
  { section:'MENÜ İÇERİK', items: [
    { to:'/admin/hero-cards',  label:'Ana Sayfa Kartları', Icon:CardIcon },
    { to:'/admin/sections',    label:'Bölümler',         Icon:GridIcon },
    { to:'/admin/categories',  label:'Kategoriler',      Icon:FolderIcon },
    { to:'/admin/menu',        label:'Ürünler',          Icon:DishIcon },
    { to:'/admin/bulk-price',  label:'Toplu Fiyat',      Icon:TagIcon },
    { to:'/admin/import',      label:'Import / Export',  Icon:UploadIcon },
  ]},
  { section:'YAPILANDIRMA', items: [
    { to:'/admin/outlets',     label:'Outletler',        Icon:MapPinIcon },
    { to:'/admin/delivery',    label:'Paket Servisi',    Icon:PackageIcon },
    { to:'/admin/languages',   label:'Diller & Çeviriler',Icon:GlobeIcon },
    { to:'/admin/allergens',   label:'Alerjenler',       Icon:AlertIcon },
  ]},
  { section:'PAZARLAMA', items: [
    { to:'/admin/media',       label:'Medya',            Icon:ImageIcon },
    { to:'/admin/social',      label:'Sosyal Medya',     Icon:ShareIcon },
    { to:'/admin/info-pages',  label:'Bilgi Sayfaları',  Icon:InfoIcon },
    { to:'/admin/campaigns',   label:'Kampanyalar',      Icon:MegaphoneIcon },
    { to:'/admin/survey',      label:'Anket',            Icon:ClipboardIcon },
  ]},
  { section:'YÖNETİM', items: [
    { to:'/admin/tables',      label:'Masalar',          Icon:TableIcon },
    { to:'/admin/staff',       label:'Personel',         Icon:UsersIcon },
    { to:'/admin/reports',     label:'Raporlar',         Icon:ReportIcon },
    { to:'/admin/settings',    label:'Ayarlar',          Icon:CogIcon },
  ]},
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mini, setMini] = useState(false)

  const out = async () => { await signOut(); navigate('/login') }
  const isSA = profile?.role === 'super_admin'

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
              {g.section && !mini && (
                <p style={{fontSize:10,fontWeight:700,color:'#bbb',letterSpacing:'0.07em',textTransform:'uppercase',padding:'0 6px',marginBottom:3}}>
                  {g.section}
                </p>
              )}
              {g.items.map(item=>(
                <NavLink key={item.to} to={item.to} end={item.end}
                  title={mini ? item.label : undefined}
                  className={({isActive})=>`nl${isActive?' on':''}`}
                  style={{justifyContent:mini?'center':'flex-start'}}>
                  <item.Icon />
                  {!mini && <span style={{flex:1}}>{item.label}</span>}
                  {!mini && item.dot && <span style={{width:7,height:7,borderRadius:'50%',background:'#1D9E75',flexShrink:0}}/>}
                </NavLink>
              ))}
            </div>
          ))}

          {isSA && (
            <div style={{marginBottom:14}}>
              {!mini && <p style={{fontSize:10,fontWeight:700,color:'#bbb',letterSpacing:'0.07em',textTransform:'uppercase',padding:'0 6px',marginBottom:3}}>SUPER ADMIN</p>}
              <NavLink to="/super" title={mini?'Firmalar':undefined}
                className={({isActive})=>`nl${isActive?' on':''}`}
                style={{justifyContent:mini?'center':'flex-start'}}>
                <ShieldIcon />
                {!mini && 'Firma Yönetimi'}
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
              <button onClick={out} title="Çıkış" style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',padding:2,flexShrink:0}}>
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
            <span style={{fontSize:12,color:'#bbb'}}>Hızlı ara...</span>
            <span style={{marginLeft:'auto',fontSize:9,color:'#ccc',background:'#eee',padding:'1px 4px',borderRadius:4}}>⌘K</span>
          </div>
          <a href="/menu/main/c4efa2ba-fc1c-43e5-980b-b57257b27147" target="_blank"
            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:'#1D9E75',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600,textDecoration:'none'}}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Menüyü Gör
          </a>
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
