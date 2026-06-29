/* magidaQR · Panel Footer — AdminLayout içinde <Outlet/> altına koy */

const GREEN = '#1D9E75'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#999'

const PHONE = '+90 532 317 00 56'
const PHONE_RAW = '+905323170056'
const WA = 'https://wa.me/905323170056'
const SITE = 'https://magidaqr.ge'

export default function AdminFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '18px 28px', marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      {/* sol: logo + telif */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, fontSize: 15 }}>
          <span style={{ color: GREEN }}>magida</span><span style={{ color: RED }}>QR</span>
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>© {new Date().getFullYear()} magidaQR · Tüm hakları <b style={{ color: '#777' }}>Qorely</b>'e aittir.</span>
      </div>

      {/* sağ: yardım & destek */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', fontSize: 12.5 }}>
        <span style={{ color: '#bbb', fontWeight: 600 }}>Yardım & Destek:</span>
        <a href={SITE} target="_blank" rel="noreferrer" style={link}>
          <GlobeIcon /> magidaqr.ge
        </a>
        <a href={`tel:${PHONE_RAW}`} style={link}>
          <PhoneIcon /> {PHONE}
        </a>
        <a href={WA} target="_blank" rel="noreferrer" style={{ ...link, color: GREEN }}>
          <WaIcon /> WhatsApp
        </a>
      </div>
    </footer>
  )
}

const link = { display: 'flex', alignItems: 'center', gap: 6, color: '#777', textDecoration: 'none', fontWeight: 600 }
function GlobeIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg> }
function PhoneIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg> }
function WaIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.26-.1-.45-.15-.64.15-.2.3-.74.94-.9 1.13-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.34.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.64-1.55-.88-2.12-.23-.55-.46-.48-.64-.49h-.55c-.2 0-.5.07-.76.37-.26.3-1 .98-1 2.38s1.02 2.76 1.17 2.95c.15.2 2 3.05 4.85 4.28.68.3 1.2.47 1.62.6.68.22 1.3.19 1.78.11.54-.08 1.7-.7 1.93-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.55-.34zM12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.45A10 10 0 1 0 12 2z" /></svg> }
