import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import QRCodeStyling from 'qr-code-styling'

/* ───────────────────────────────────────────────────────────
   magidaQR · QR Stüdyo  (qrmenum referans · yeşil tema #1D9E75)
   GEREKLİ: npm install qr-code-styling
   NOT (reis): kategori rotası placeholder — kendi route yapına
   göre aşağıdaki buildUrl.category'i bir satırda düzelt.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const BORDER = '#e8e8e4'
const LIGHT = '#f4f4f2'
const MUTED = '#888'

const DOT_STYLES = [
  { v: 'square', label: 'Kare' },
  { v: 'extra-rounded', label: 'Yuvarlak Köşe' },
  { v: 'dots', label: 'Nokta' },
  { v: 'classy', label: 'Klasik' },
  { v: 'classy-rounded', label: 'Klasik Yuvarlak' },
  { v: 'rounded', label: 'Çok Yuvarlak' },
]
const CORNER_STYLES = [
  { v: 'square', label: 'Kare' },
  { v: 'dot', label: 'Nokta' },
  { v: 'extra-rounded', label: 'Yuvarlak' },
]
const EC_LEVELS = [
  { v: 'L', label: 'Düşük (L)' },
  { v: 'M', label: 'Orta (M)' },
  { v: 'Q', label: 'Yüksek (Q) — logo için' },
  { v: 'H', label: 'En Yüksek (H)' },
]
const PRESETS = [
  { dark: '#000000', light: '#ffffff', label: 'Klasik' },
  { dark: GREEN, light: '#ffffff', label: 'Yeşil' },
  { dark: '#E8192C', light: '#ffffff', label: 'Kırmızı' },
  { dark: '#1a1a1a', light: '#f9f9f7', label: 'Koyu' },
]

const buildUrl = {
  home: (slug) => `${window.location.origin}/menu/${slug}`,
  table: (slug, id) => `${window.location.origin}/menu/${slug}/${id}`,
  // ↓ kategori rotanı kendine göre ayarla
  category: (slug, id) => `${window.location.origin}/menu/${slug}?cat=${id}`,
}

function slugify(s) {
  return (s || 'qr').toString().toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'qr'
}

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

/* küçük görsel ipuçları */
function DotPreview({ type, active }) {
  const radius = { square: 1, 'extra-rounded': 3, rounded: '50%', dots: '50%', classy: 2, 'classy-rounded': 3 }[type]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,5px)', gap: 2 }}>
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: radius, background: active ? GREEN : '#555' }} />
      ))}
    </div>
  )
}
function CornerPreview({ type, active }) {
  const radius = { square: 2, dot: '50%', 'extra-rounded': 7 }[type]
  return (
    <div style={{ width: 26, height: 26, border: `4px solid ${active ? GREEN : '#555'}`, borderRadius: radius }} />
  )
}

export default function AdminQR() {
  const [restaurant, setRestaurant] = useState(null)
  const [tables, setTables] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // hedef
  const [targetUrl, setTargetUrl] = useState('')
  const [targetLabel, setTargetLabel] = useState('Ana Sayfa')
  const [showMore, setShowMore] = useState(false)

  // stil
  const [fgColor, setFgColor] = useState('#111111')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [dotType, setDotType] = useState('extra-rounded')
  const [cornerType, setCornerType] = useState('extra-rounded')
  const [ecLevel, setEcLevel] = useState('Q')
  const [sizePx, setSizePx] = useState(600)

  // logo
  const [logoMode, setLogoMode] = useState('none') // business | custom | none
  const [logoData, setLogoData] = useState(null)
  const [businessLogo, setBusinessLogo] = useState(null)
  const [logoSize, setLogoSize] = useState(0.4)
  const [logoMargin, setLogoMargin] = useState(6)

  // çıktı
  const [adet, setAdet] = useState(1)
  const [sutun, setSutun] = useState(2)
  const [busy, setBusy] = useState('')

  const previewRef = useRef(null)
  const qrRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: rest } = await supabase.from('restaurants').select('*').limit(1).single()
    setRestaurant(rest)
    if (rest) {
      setTargetUrl(buildUrl.home(rest.slug))
      const logo = rest.logo_url || rest.logo || rest.image_url || null
      setBusinessLogo(logo)
      const { data: t } = await supabase.from('tables').select('*').eq('restaurant_id', rest.id).order('table_number')
      setTables(t || [])
      const { data: c } = await supabase.from('menu_categories').select('*').eq('restaurant_id', rest.id).order('name')
      setCategories(c || [])
    }
    setLoading(false)
  }

  function optionsForSize(px) {
    const opts = {
      width: px,
      height: px,
      type: 'canvas',
      data: targetUrl || (restaurant ? buildUrl.home(restaurant.slug) : 'https://magidaqr.ge'),
      margin: 10,
      qrOptions: { errorCorrectionLevel: ecLevel },
      dotsOptions: { color: fgColor, type: dotType },
      cornersSquareOptions: { color: fgColor, type: cornerType },
      cornersDotOptions: { color: fgColor },
      backgroundOptions: { color: bgColor },
    }
    const activeLogo = logoMode === 'business' ? businessLogo : logoMode === 'custom' ? logoData : null
    if (activeLogo) {
      opts.image = activeLogo
      opts.imageOptions = { crossOrigin: 'anonymous', margin: logoMargin, imageSize: logoSize, hideBackgroundDots: true }
    }
    return opts
  }

  // önizleme örneğini oluştur
  useEffect(() => {
    if (loading) return
    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(optionsForSize(256))
      if (previewRef.current) {
        previewRef.current.innerHTML = ''
        qrRef.current.append(previewRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // değişikliklerde güncelle
  useEffect(() => {
    if (qrRef.current) qrRef.current.update(optionsForSize(256))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUrl, fgColor, bgColor, dotType, cornerType, ecLevel, logoMode, logoData, businessLogo, logoSize, logoMargin])

  function pickPreset(p) { setFgColor(p.dark); setBgColor(p.light) }

  function setTarget(url, label) { setTargetUrl(url); setTargetLabel(label) }

  function onCustomLogo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => { setLogoData(r.result); setLogoMode('custom') }
    r.readAsDataURL(f)
  }

  async function exportQR(extension) {
    try {
      setBusy(extension)
      const inst = new QRCodeStyling({ ...optionsForSize(sizePx), type: extension === 'svg' ? 'svg' : 'canvas' })
      await inst.download({ name: `qr-${slugify(targetLabel)}`, extension })
    } catch (err) {
      console.error(err); alert('İndirme sırasında hata oluştu.')
    } finally { setBusy('') }
  }

  async function dataUrlFor(url) {
    const inst = new QRCodeStyling({ ...optionsForSize(sizePx), data: url, type: 'canvas' })
    const blob = await inst.getRawData('png')
    return blobToDataURL(blob)
  }

  function printGrid(items, cols) {
    const w = window.open('', '_blank')
    if (!w) { alert('Pop-up engellendi. Tarayıcıdan izin ver.'); return }
    const cells = items.map(it =>
      `<div class="cell"><img src="${it.url}"/>${it.label ? `<div class="lbl">${it.label}</div>` : ''}</div>`
    ).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>magidaQR · Yazdır</title>
      <style>
        @page { margin: 12mm; }
        body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; }
        .grid { display:grid; grid-template-columns: repeat(${cols}, 1fr); gap: 18px; }
        .cell { text-align:center; page-break-inside: avoid; border:1px solid #eee; border-radius:12px; padding:14px; }
        .cell img { width:100%; height:auto; max-width:240px; }
        .lbl { margin-top:8px; font-size:14px; font-weight:700; color:#111; }
      </style></head><body><div class="grid">${cells}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
      </body></html>`)
    w.document.close()
  }

  async function printCopies() {
    try {
      setBusy('print')
      const url = await dataUrlFor(targetUrl)
      const items = Array.from({ length: Math.max(1, adet) }).map(() => ({ url, label: targetLabel }))
      printGrid(items, sutun)
    } catch (err) { console.error(err); alert('Yazdırma hazırlanamadı.') }
    finally { setBusy('') }
  }

  async function printAllTables() {
    if (!restaurant || tables.length === 0) return
    try {
      setBusy('printall')
      const items = []
      for (const t of tables) {
        const url = await dataUrlFor(buildUrl.table(restaurant.slug, t.id))
        items.push({ url, label: `Masa ${t.table_number}` })
      }
      printGrid(items, sutun)
    } catch (err) { console.error(err); alert('Yazdırma hazırlanamadı.') }
    finally { setBusy('') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 64, color: '#aaa' }}>Yükleniyor...</div>

  const card = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 16 }
  const cardHead = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }
  const cardIcon = { width: 32, height: 32, borderRadius: 9, background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const cardTitle = { fontSize: 15, fontWeight: 700 }
  const miniLabel = { fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>QR Stüdyo</h1>
          <p style={{ fontSize: 13, color: MUTED }}>Logolu, özel renkli QR kodları üret ve indir</p>
        </div>
        {restaurant && (
          <a href={buildUrl.home(restaurant.slug)} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#333', textDecoration: 'none', background: '#fff' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            Menüyü Gör
          </a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 22, alignItems: 'start' }}>
        {/* SOL: kontroller */}
        <div>
          {/* Hedef URL */}
          <div style={card}>
            <div style={cardHead}>
              <div style={cardIcon}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              </div>
              <span style={cardTitle}>Hedef URL</span>
            </div>
            <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontFamily: 'monospace', color: '#222', boxSizing: 'border-box' }} />

            <p style={{ ...miniLabel, marginTop: 16 }}>Hızlı Seçim</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {restaurant && (
                <Chip active={targetLabel === 'Ana Sayfa'} onClick={() => setTarget(buildUrl.home(restaurant.slug), 'Ana Sayfa')}>Ana Sayfa</Chip>
              )}
              {tables.slice(0, 3).map(t => (
                <Chip key={t.id} active={targetLabel === `Masa ${t.table_number}`} onClick={() => setTarget(buildUrl.table(restaurant.slug, t.id), `Masa ${t.table_number}`)}>Masa {t.table_number}</Chip>
              ))}
            </div>

            {(tables.length > 0 || categories.length > 0) && (
              <>
                <button onClick={() => setShowMore(s => !s)}
                  style={{ marginTop: 14, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#555', padding: '4px 0' }}>
                  Diğer hedefler — kategori & masa
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {showMore && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {categories.length > 0 && (
                      <div>
                        <p style={miniLabel}>Kategoriler</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {categories.map(c => (
                            <Chip key={c.id} active={targetLabel === c.name} onClick={() => setTarget(buildUrl.category(restaurant.slug, c.id), c.name)}>{c.name}</Chip>
                          ))}
                        </div>
                      </div>
                    )}
                    {tables.length > 0 && (
                      <div>
                        <p style={miniLabel}>Tüm Masalar</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {tables.map(t => (
                            <Chip key={t.id} active={targetLabel === `Masa ${t.table_number}`} onClick={() => setTarget(buildUrl.table(restaurant.slug, t.id), `Masa ${t.table_number}`)}>Masa {t.table_number}</Chip>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Renkler */}
          <div style={card}>
            <div style={cardHead}>
              <div style={cardIcon}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" /></svg>
              </div>
              <span style={cardTitle}>Renkler</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ColorField label="Ön Renk" value={fgColor} onChange={setFgColor} />
              <ColorField label="Arka Plan" value={bgColor} onChange={setBgColor} />
            </div>
            <p style={{ ...miniLabel, marginTop: 16 }}>Hazır Temalar</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => pickPreset(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: `1.5px solid ${fgColor === p.dark ? GREEN : BORDER}`, borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: fgColor === p.dark ? GREEN_BG : '#fff', color: fgColor === p.dark ? GREEN : '#333' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: p.dark, border: '1px solid #ddd' }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desen */}
          <div style={card}>
            <div style={cardHead}>
              <div style={cardIcon}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
              </div>
              <span style={cardTitle}>Desen</span>
            </div>

            <p style={miniLabel}>Nokta Stili</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
              {DOT_STYLES.map(d => (
                <StyleTile key={d.v} active={dotType === d.v} onClick={() => setDotType(d.v)} label={d.label}>
                  <DotPreview type={d.v} active={dotType === d.v} />
                </StyleTile>
              ))}
            </div>

            <p style={miniLabel}>Köşe Stili</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {CORNER_STYLES.map(c => (
                <StyleTile key={c.v} active={cornerType === c.v} onClick={() => setCornerType(c.v)} label={c.label}>
                  <CornerPreview type={c.v} active={cornerType === c.v} />
                </StyleTile>
              ))}
            </div>
          </div>

          {/* Detay */}
          <div style={card}>
            <div style={cardHead}>
              <div style={cardIcon}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <span style={cardTitle}>Detay</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={miniLabel}>Hata Düzeltme</label>
                <select value={ecLevel} onChange={e => setEcLevel(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                  {EC_LEVELS.map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label style={miniLabel}>Boyut (px)</label>
                <input type="number" min={200} max={2000} step={50} value={sizePx}
                  onChange={e => setSizePx(Math.max(200, Math.min(2000, Number(e.target.value) || 600)))}
                  style={{ width: '100%', padding: '11px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          {/* Merkez Logo */}
          <div style={card}>
            <div style={cardHead}>
              <div style={cardIcon}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>
              </div>
              <span style={cardTitle}>Merkez Logo</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <LogoTab active={logoMode === 'business'} disabled={!businessLogo} onClick={() => businessLogo && setLogoMode('business')}>İşletme Logosu</LogoTab>
              <LogoTab active={logoMode === 'custom'} onClick={() => fileInputRef.current?.click()}>Yükle</LogoTab>
              <LogoTab active={logoMode === 'none'} onClick={() => setLogoMode('none')}>Logosuz</LogoTab>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onCustomLogo} style={{ display: 'none' }} />

            {logoMode !== 'none' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <Slider label="Logo Boyutu" value={logoSize} min={0.2} max={0.55} step={0.05} onChange={setLogoSize} fmt={v => `${Math.round(v * 100)}%`} />
                <Slider label="Logo Padding" value={logoMargin} min={0} max={20} step={1} onChange={setLogoMargin} fmt={v => `${v}px`} />
              </div>
            )}
            {logoMode === 'business' && !businessLogo && (
              <p style={{ fontSize: 12, color: '#c0392b', marginTop: 4 }}>İşletme logosu bulunamadı (restaurants.logo_url boş).</p>
            )}
          </div>
        </div>

        {/* SAĞ: önizleme + çıktı (sticky) */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={card}>
            <div style={cardHead}>
              <div style={cardIcon}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v.01M21 14v.01M14 21v.01" /></svg>
              </div>
              <span style={cardTitle}>Canlı Önizleme</span>
            </div>
            <div style={{ background: bgColor, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 288 }}>
              <div ref={previewRef} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', marginTop: 10 }}>{targetLabel}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button onClick={() => exportQR('png')} disabled={!!busy}
                style={{ padding: '11px 0', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
                <DownloadIcon /> {busy === 'png' ? '...' : 'PNG İndir'}
              </button>
              <button onClick={() => exportQR('svg')} disabled={!!busy}
                style={{ padding: '11px 0', background: '#1f2937', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7 }}>
                <DownloadIcon /> {busy === 'svg' ? '...' : 'SVG İndir'}
              </button>
            </div>

            <div style={{ height: 1, background: BORDER, margin: '18px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={miniLabel}>Adet</label>
                <input type="number" min={1} max={60} value={adet} onChange={e => setAdet(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={miniLabel}>Sütun</label>
                <select value={sutun} onChange={e => setSutun(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} sütun</option>)}
                </select>
              </div>
            </div>

            <button onClick={printCopies} disabled={!!busy}
              style={{ width: '100%', padding: '12px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <PrintIcon /> {busy === 'print' ? 'Hazırlanıyor...' : 'Yazdır'}
            </button>

            {tables.length > 0 && (
              <button onClick={printAllTables} disabled={!!busy}
                style={{ width: '100%', padding: '11px 0', marginTop: 10, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <PrintIcon color={GREEN} /> {busy === 'printall' ? 'Hazırlanıyor...' : `Tüm Masaları Yazdır (${tables.length})`}
              </button>
            )}

            <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>QR'ı telefon kamerası ile test ettikten sonra bas.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── küçük bileşenler ── */
function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${active ? GREEN : BORDER}`, background: active ? GREEN_BG : '#fff', color: active ? GREEN : '#444', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}
function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 8 }}>{label}</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: value, border: '1px solid #ddd', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#444' }}>{value}</span>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }} />
      </label>
    </div>
  )
}
function StyleTile({ children, active, onClick, label }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 6px', border: `1.5px solid ${active ? GREEN : BORDER}`, borderRadius: 12, background: active ? GREEN_BG : '#fff', cursor: 'pointer' }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>{children}</div>
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? GREEN : '#555' }}>{label}</span>
    </button>
  )
}
function LogoTab({ children, active, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '11px 6px', border: `1.5px solid ${active ? GREEN : BORDER}`, borderRadius: 10, background: active ? GREEN_BG : '#fff', color: disabled ? '#bbb' : active ? GREEN : '#444', fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  )
}
function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</label>
        <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: GREEN, cursor: 'pointer' }} />
    </div>
  )
}
function DownloadIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
}
function PrintIcon({ color = '#fff' }) {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}
