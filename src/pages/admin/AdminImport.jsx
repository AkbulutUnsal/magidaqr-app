import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Ürün Import / Export  (qrmenum referans · #1D9E75)
   xlsx tabanlı. GEREKLİ: npm install xlsx
   Şablon + Dışa Aktar + İçe Aktar (ön-izlemeli) + Rehber.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const BLUE = '#2563eb'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const ALL_LANGS = [['tr', 'Türkçe'], ['en', 'İngilizce'], ['ka', 'Gürcüce'], ['ru', 'Rusça']]
const slugify = s => (s || '').toString().toLowerCase().replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const norm = s => (s || '').toString().trim().toLowerCase()

export default function AdminImport() {
  const { profile } = useAuth()
  const [defaultLang, setDefaultLang] = useState('tr')
  const [secSupported, setSecSupported] = useState(false)
  const [itemCols, setItemCols] = useState(null)
  const [tplMode, setTplMode] = useState('all')   // default | all | select
  const [tplSel, setTplSel] = useState(['tr', 'en'])
  const [expMode, setExpMode] = useState('all')
  const [expSel, setExpSel] = useState(['tr', 'en'])
  const [preview, setPreview] = useState(null)     // { header, rows }
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [drag, setDrag] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) init() }, [profile?.restaurant_id])

  async function init() {
    const rid = profile.restaurant_id
    const { data: r } = await supabase.from('restaurants').select('default_language').eq('id', rid).single()
    if (r?.default_language) setDefaultLang(r.default_language)
    const sec = await supabase.from('menu_sections').select('id').limit(1)
    setSecSupported(!sec.error)
    const { data: it } = await supabase.from('menu_items').select('*').eq('restaurant_id', rid).limit(1)
    setItemCols(it?.[0] ? Object.keys(it[0]) : [])
  }

  const langsFor = (mode, sel) => mode === 'default' ? [defaultLang] : mode === 'all' ? ALL_LANGS.map(l => l[0]) : (sel.length ? sel : [defaultLang])

  // başlık kolonları
  function buildHeader(langs) {
    const h = ['Bölüm', 'Kategori']
    langs.forEach(l => h.push(`Ad (${l.toUpperCase()})`))
    langs.forEach(l => h.push(`Açıklama (${l.toUpperCase()})`))
    h.push('Fiyat')
    for (let i = 1; i <= 4; i++) { h.push(`Varyant${i} Etiket`, `Varyant${i} Fiyat`) }
    h.push('Kalori', 'Hazırlık (dk)', 'Vejetaryen', 'Vegan', 'Glutensiz', 'Acı', 'Outlets', 'Outlet Fiyat')
    return h
  }

  // ── ŞABLON ──
  function downloadTemplate() {
    const langs = langsFor(tplMode, tplSel)
    const header = buildHeader(langs)
    const ex = []
    const base = (bolum, kat, names, desc, price) => {
      const row = [bolum, kat]
      langs.forEach(l => row.push(names[l] || ''))
      langs.forEach(l => row.push(desc[l] || ''))
      row.push(price)
      for (let i = 0; i < 8; i++) row.push('')
      row.push('', '', '', '', '', '', '', '')
      return row
    }
    ex.push(base('Yiyecekler', 'Kahvaltı', { tr: 'Menemen', en: 'Menemen', ka: 'მენემენი', ru: 'Менемен' }, { tr: 'Domates, biber, yumurta', en: 'Tomato, pepper, eggs' }, 45))
    // varyantlı örnek
    const v = ['İçecekler', 'Soğuk İçecekler']
    const r2 = [v[0], v[1]]; langs.forEach(l => r2.push(l === 'tr' ? 'Limonata' : l === 'en' ? 'Lemonade' : '')); langs.forEach(() => r2.push('')); r2.push('')
    r2.push('30cl', '15', '50cl', '22', '', '', '', ''); r2.push('', '', '', '', '', '', '', '')
    ex.push(r2)
    // büfe / özellikli örnek
    const r3 = ['Yiyecekler', 'Tatlılar']; langs.forEach(l => r3.push(l === 'tr' ? 'Sütlaç' : l === 'en' ? 'Rice Pudding' : '')); langs.forEach(() => r3.push('')); r3.push('35')
    for (let i = 0; i < 8; i++) r3.push(''); r3.push('320', '10', '1', '0', '1', '0', '', ''); ex.push(r3)

    writeXlsx([header, ...ex], 'magidaqr_sablon.xlsx')
  }

  // ── DIŞA AKTAR ──
  async function exportProducts() {
    const langs = langsFor(expMode, expSel)
    const rid = profile.restaurant_id
    const { data: cats } = await supabase.from('menu_categories').select('*').eq('restaurant_id', rid)
    const catMap = {}; (cats || []).forEach(c => catMap[c.id] = c)
    let secMap = {}
    if (secSupported) { const { data: secs } = await supabase.from('menu_sections').select('*').eq('restaurant_id', rid); (secs || []).forEach(s => secMap[s.id] = s) }
    const { data: items } = await supabase.from('menu_items').select('*').eq('restaurant_id', rid).order('created_at')
    const nm = (o, f) => o ? (o[`${f}_tr`] || o[`${f}_en`] || o[`${f}_ka`] || '') : ''

    const header = buildHeader(langs)
    const rows = (items || []).map(it => {
      const cat = catMap[it.category_id]
      const sec = cat && secSupported ? secMap[cat.section_id] : null
      const row = [sec ? nm(sec, 'name') : '', cat ? nm(cat, 'name') : '']
      langs.forEach(l => row.push(it[`name_${l}`] || ''))
      langs.forEach(l => row.push(it[`description_${l}`] || ''))
      row.push(it.price ?? '')
      const vars = Array.isArray(it.variants) ? it.variants : []
      for (let i = 0; i < 4; i++) { row.push(vars[i]?.label || vars[i]?.name || '', vars[i]?.price ?? '') }
      row.push(it.calories ?? '', it.prep_time ?? '', boolCell(it.is_vegetarian), boolCell(it.is_vegan), boolCell(it.is_gluten_free), boolCell(it.is_spicy), '', '')
      return row
    })
    writeXlsx([header, ...rows], 'magidaqr_urunler.xlsx')
  }

  // ── İÇE AKTAR ──
  async function readFile(file) {
    if (!file) return
    setResult(null)
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).filter(r => r.some(c => String(c).trim()))
    if (rows.length < 2) { setResult({ ok: 0, err: ['Boş dosya'] }); return }
    setPreview({ header: rows[0].map(String), rows: rows.slice(1) })
  }

  async function doImport() {
    if (!preview) return
    setImporting(true)
    const { header, rows } = preview
    const col = name => header.findIndex(h => norm(h) === norm(name))
    const colByLang = (base, l) => col(`${base} (${l.toUpperCase()})`)
    const cell = (row, idx) => idx >= 0 ? String(row[idx] ?? '').trim() : ''
    const rid = profile.restaurant_id
    const langs = ALL_LANGS.map(l => l[0])

    // mevcut kategori/bölümler
    const { data: cats } = await supabase.from('menu_categories').select('*').eq('restaurant_id', rid)
    const catByName = {}; (cats || []).forEach(c => langs.forEach(l => { if (c[`name_${l}`]) catByName[norm(c[`name_${l}`])] = c }))
    let secByName = {}
    if (secSupported) { const { data: secs } = await supabase.from('menu_sections').select('*').eq('restaurant_id', rid); (secs || []).forEach(s => langs.forEach(l => { if (s[`name_${l}`]) secByName[norm(s[`name_${l}`])] = s })) }
    const hasSectionFk = (cats?.[0] && 'section_id' in cats[0]) || (cats || []).length === 0
    const has = c => itemCols && itemCols.includes(c)

    let ok = 0; const err = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const names = {}; langs.forEach(l => { const v = cell(row, colByLang('Ad', l)); if (v) names[l] = v })
      if (!names.tr && !names.en && !names.ka && !names.ru) continue
      const price = parseFloat(cell(row, col('Fiyat')).replace(',', '.'))
      const v1 = cell(row, col('Varyant1 Etiket'))
      if (isNaN(price) && !v1) { err.push(`Satır ${i + 2}: fiyat yok (varyant da yok)`); continue }

      // Bölüm
      let section = null
      const bolum = cell(row, col('Bölüm'))
      if (bolum && secSupported) {
        section = secByName[norm(bolum)]
        if (!section) {
          const { data: ns } = await supabase.from('menu_sections').insert({ restaurant_id: rid, name_tr: bolum, name_en: bolum, slug: slugify(bolum), is_active: true, sort_order: Object.keys(secByName).length }).select().single()
          if (ns) { section = ns; langs.forEach(l => { if (ns[`name_${l}`]) secByName[norm(ns[`name_${l}`])] = ns }) }
        }
      }
      // Kategori
      const katName = cell(row, col('Kategori')) || 'Genel'
      let cat = catByName[norm(katName)]
      if (!cat) {
        const payload = { restaurant_id: rid, name_tr: katName, name_en: katName, sort_order: Object.keys(catByName).length }
        if (hasSectionFk && section) payload.section_id = section.id
        const { data: nc } = await supabase.from('menu_categories').insert(payload).select().single()
        if (nc) { cat = nc; langs.forEach(l => { if (nc[`name_${l}`]) catByName[norm(nc[`name_${l}`])] = nc }) }
      } else if (hasSectionFk && section && !cat.section_id) {
        await supabase.from('menu_categories').update({ section_id: section.id }).eq('id', cat.id); cat.section_id = section.id
      }

      // Ürün
      const item = { restaurant_id: rid, price: isNaN(price) ? 0 : price, category_id: cat?.id || null }
      langs.forEach(l => { if (names[l]) item[`name_${l}`] = names[l] })
      langs.forEach(l => { const d = cell(row, colByLang('Açıklama', l)); if (d) item[`description_${l}`] = d })
      if (has('is_available')) item.is_available = true
      // opsiyonel kolonlar (sadece varsa)
      if (has('variants')) {
        const vs = []
        for (let n = 1; n <= 4; n++) { const lbl = cell(row, col(`Varyant${n} Etiket`)); const pr = cell(row, col(`Varyant${n} Fiyat`)); if (lbl) vs.push({ label: lbl, price: parseFloat(pr.replace(',', '.')) || 0 }) }
        if (vs.length) item.variants = vs
      }
      const feat = [['Kalori', 'calories', 'num'], ['Hazırlık (dk)', 'prep_time', 'num'], ['Vejetaryen', 'is_vegetarian', 'bool'], ['Vegan', 'is_vegan', 'bool'], ['Glutensiz', 'is_gluten_free', 'bool'], ['Acı', 'is_spicy', 'bool']]
      feat.forEach(([lbl, c, t]) => { if (has(c)) { const raw = cell(row, col(lbl)); if (raw !== '') item[c] = t === 'bool' ? (raw === '1' || norm(raw) === 'evet' || norm(raw) === 'true') : (parseFloat(raw) || 0) } })

      const { error } = await supabase.from('menu_items').insert(item)
      if (error) err.push(`Satır ${i + 2}: ${error.message}`); else ok++
    }
    setImporting(false); setPreview(null); setResult({ ok, err })
  }

  const tplLangs = useMemo(() => langsFor(tplMode, tplSel), [tplMode, tplSel, defaultLang])

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>Ürün Import / Export</h1>

      {/* Şablon + Dışa Aktar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>
        <Card iconBg="#e8f5ee" icon={<DocIcon />}>
          <h3 style={cardTitle}>Örnek Şablon</h3>
          <p style={cardDesc}>Boş şablon — 3 örnek satır (sabit fiyatlı + varyantlı + özellikli) içerir. Kolonlar: Bölüm, Kategori, ad/açıklama, fiyat, varyant, özellik.</p>
          <LangPick label="Diller" mode={tplMode} setMode={setTplMode} sel={tplSel} setSel={setTplSel} defaultLang={defaultLang} />
          <button onClick={downloadTemplate} style={btn(GREEN)}><DownIcon /> Şablonu İndir (.xlsx)</button>
        </Card>
        <Card iconBg="#e8eefe" icon={<DownBoxIcon />}>
          <h3 style={cardTitle}>Ürünleri Dışa Aktar</h3>
          <p style={cardDesc}>Mevcut tüm ürünleri Excel'e dök. Seçtiğin dillerde isim + açıklama, varyant ve özellikler dahil.</p>
          <LangPick label="Diller" mode={expMode} setMode={setExpMode} sel={expSel} setSel={setExpSel} defaultLang={defaultLang} />
          <button onClick={exportProducts} style={btn(BLUE)}><DownIcon /> Ürünleri İndir (.xlsx)</button>
        </Card>
      </div>

      {/* İçe Aktar */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <h3 style={{ ...cardTitle, marginBottom: 4 }}>Ürünleri İçe Aktar</h3>
        <p style={{ ...cardDesc, marginBottom: 16 }}>Şablona uygun Excel dosyasını yükle. Ürünler ön-izlemeden sonra aktarılır. Bölüm/Kategori adlarına göre eşleştirilir; yoksa otomatik oluşturulur.</p>

        {!preview ? (
          <label onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]) }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '40px 20px', border: `2px dashed ${drag ? GREEN : BORDER}`, borderRadius: 14, background: drag ? GREEN_BG : '#fafafa', cursor: 'pointer', textAlign: 'center' }}>
            <UpIcon />
            <p style={{ fontSize: 14, color: '#555' }}>Dosyayı buraya sürükle veya <span style={{ color: GREEN, fontWeight: 700 }}>seç</span></p>
            <p style={{ fontSize: 11.5, color: '#aaa' }}>Sadece .xlsx kabul edilir</p>
            <input type="file" accept=".xlsx,.xls" onChange={e => readFile(e.target.files[0])} style={{ display: 'none' }} />
          </label>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>Ön-izleme · {preview.rows.length} satır</p>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>İptal / başka dosya</button>
            </div>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'auto', maxHeight: 320 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: '#fafafa' }}>{preview.header.map((h, i) => <th key={i} style={{ ...th, position: 'sticky', top: 0, background: '#fafafa' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {preview.rows.slice(0, 30).map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>{preview.header.map((_, j) => <td key={j} style={{ padding: '7px 10px', color: '#555', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(r[j] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 30 && <p style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>İlk 30 satır gösteriliyor. Tümü aktarılacak.</p>}
            <button onClick={doImport} disabled={importing} style={{ ...btn(GREEN), marginTop: 14, width: 'auto', padding: '11px 24px' }}>{importing ? 'Aktarılıyor...' : `↑ Yükle ve Aktar (${preview.rows.length})`}</button>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16, background: '#fafafa', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>✓ {result.ok} ürün eklendi</p>
            {result.err.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: RED, marginBottom: 6 }}>{result.err.length} hata:</p>
                <ul style={{ fontSize: 12, color: '#888', paddingLeft: 18, maxHeight: 160, overflowY: 'auto', margin: 0 }}>{result.err.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Şablon Rehberi */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22 }}>
        <h3 style={{ ...cardTitle, marginBottom: 16 }}>Şablon Rehberi</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Guide k="Bölüm">Ana bölüm (örn: "Yiyecekler", "İçecekler"). Boş olabilir — kategori bölümsüz kalır.</Guide>
          <Guide k="Kategori">Bölümün alt kategorisi (örn: "Kahvaltı"). Mevcut adlarla eşleştirilir; yoksa yenisi oluşturulur.</Guide>
          <Guide k="Ad & Açıklama">Her dil için ayrı kolon. En az bir dilde ad zorunlu.</Guide>
          <Guide k="Fiyat">Tekli fiyat için doldur. Varyantlı ürünlerde boş bırakabilirsin.</Guide>
          <Guide k="Varyantlar">Etiket + Fiyat çiftleri (örn: "30cl" + "15"). En fazla 4 varyant. <i>(menu_items.variants kolonu gerekir)</i></Guide>
          <Guide k="Özellikler">Kalori, hazırlık süresi, vejetaryen/vegan/glutensiz/acı (1 = evet, 0 = hayır). <i>(ilgili kolonlar varsa yazılır)</i></Guide>
          <Guide k="Outlets / Override">Şablonda yer alır; çoklu outlet fiyatlandırması ileride bağlanacak (şu an içe aktarımda atlanır).</Guide>
        </div>
      </div>

      {itemCols !== null && (
        <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 14, lineHeight: 1.6 }}>
          <b>Not (reis):</b> Bu sayfa <code>xlsx</code> paketi kullanır → <code>npm install xlsx</code>. Varyant/özellik kolonları yalnızca <code>menu_items</code>'ta karşılığı varsa yazılır (algılanan: {(itemCols || []).filter(c => ['variants', 'calories', 'prep_time', 'is_vegetarian', 'is_vegan', 'is_gluten_free', 'is_spicy'].includes(c)).join(', ') || 'yok'}).
        </p>
      )}
    </div>
  )

  function writeXlsx(aoa, filename) {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ürünler')
    XLSX.writeFile(wb, filename)
  }
}
function boolCell(v) { return v === true ? '1' : v === false ? '0' : '' }

function Card({ icon, iconBg, children }) {
  return <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22 }}>
    <div style={{ width: 44, height: 44, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>{icon}</div>
    {children}
  </div>
}
function LangPick({ label, mode, setMode, sel, setSel, defaultLang }) {
  const toggle = l => setSel(sel.includes(l) ? sel.filter(x => x !== l) : [...sel, l])
  return (
    <div style={{ margin: '14px 0' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: mode === 'select' ? 10 : 0 }}>
        {[['default', `Varsayılan (${defaultLang.toUpperCase()})`], ['all', 'Tümü'], ['select', 'Seçili']].map(([v, lbl]) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', cursor: 'pointer' }}>
            <input type="radio" checked={mode === v} onChange={() => setMode(v)} style={{ accentColor: GREEN }} /> {lbl}
          </label>
        ))}
      </div>
      {mode === 'select' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_LANGS.map(([l, lbl]) => (
            <button key={l} onClick={() => toggle(l)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${sel.includes(l) ? GREEN : BORDER}`, background: sel.includes(l) ? GREEN_BG : '#fff', color: sel.includes(l) ? GREEN : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
          ))}
        </div>
      )}
    </div>
  )
}
function Guide({ k, children }) {
  return <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: GREEN, background: GREEN_BG, padding: '3px 9px', borderRadius: 6, minWidth: 60, textAlign: 'center' }}>{k}</span>
    <p style={{ fontSize: 13, color: '#555', lineHeight: 1.55 }}>{children}</p>
  </div>
}
const cardTitle = { fontSize: 16, fontWeight: 700, color: '#222', marginBottom: 6 }
const cardDesc = { fontSize: 13, color: '#888', lineHeight: 1.5 }
const th = { textAlign: 'left', padding: '9px 10px', fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.03em', whiteSpace: 'nowrap' }
function btn(color) { return { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px', background: color, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' } }
function DocIcon() { return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> }
function DownBoxIcon() { return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> }
function DownIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> }
function UpIcon() { return <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> }
