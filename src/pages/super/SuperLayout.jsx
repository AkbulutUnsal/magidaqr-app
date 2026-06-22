import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function SuperLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'Inter,system-ui,sans-serif',background:'#f5f5f3'}}>
      <style>{`.snl{display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:500;color:#6b6b63;text-decoration:none;transition:all .15s}.snl:hover{background:#f0f0ee;color:#111}.snl.on{background:#e8f5ee;color:#1D9E75;font-weight:700}`}</style>

      <aside style={{width:220,background:'#fff',borderRight:'1px solid #e8e8e4',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px',borderBottom:'1px solid #f0f0ee'}}>
          <span style={{fontSize:17,fontWeight:900}}>magida<span style={{color:'#1D9E75'}}>QR</span></span>
          <div style={{marginTop:4,display:'inline-flex',alignItems:'center',gap:4,background:'#fef3c7',color:'#92400e',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20}}>
            ⚡ SUPER ADMIN
          </div>
        </div>
        <nav style={{flex:1,padding:'12px 8px'}}>
          {[
            {to:'/super',          label:'Firmalar',     end:true, icon:'🏢'},
            {to:'/super/plans',    label:'Paketler',     icon:'📦'},
            {to:'/super/stats',    label:'İstatistik',   icon:'📊'},
          ].map(item=>(
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({isActive})=>`snl${isActive?' on':''}`}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
          <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid #f0f0ee'}}>
            <NavLink to="/admin" className="snl">⬅ Admin Paneli</NavLink>
          </div>
        </nav>
        <div style={{padding:'12px',borderTop:'1px solid #f0f0ee',fontSize:12,color:'#aaa'}}>
          {profile?.full_name} · super_admin
        </div>
      </aside>

      <main style={{flex:1,overflowY:'auto',padding:'24px'}}>
        <Outlet />
      </main>
    </div>
  )
}
