import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Diller & Çeviriler  (qrmenum referans · #1D9E75)
   Diller: enabled_languages + default_language (mevcut kolonlar)
   UI Çevirileri: i18n paketinden okur, JSON dışa aktarır.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const ALL_LANGS = [
  { code: 'ka', name: 'ქართული', tr: 'Gürcüce', flag: 'GE' },
  { code: 'en', name: 'English', tr: 'İngilizce', flag: 'GB' },
  { code: 'tr', name: 'Türkçe', tr: 'Türkçe', flag: 'TR' },
  { code: 'ru', name: 'Русский', tr: 'Rusça', flag: 'RU' },
]
const GARSON_FIELDS = ['waiter_translation', 'waiter_translate_help', 'garson_translation', 'waiter_help']

const flatten = (obj, p = '', out = {}) => {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = p ? `${p}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}
const unflatten = flat => {
  const out = {}
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.'); let cur = out
    parts.forEach((p, i) => { if (i === parts.length - 1) cur[p] = v; else { cur[p] = cur[p] || {}; cur = cur[p] } })
  }
  return out
}

export default function AdminLanguages() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [enabled, setEnabled] = useState(['ka', 'en'])
  const [defaultLang, setDefaultLang] = useState('ka')
  const [garson, setGarson] = useState(false)
  const [tab, setTab] = useState('langs')
  const [flash, setFlash] = useState('')
  const [addPick, setAddPick] = useState('')

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: r } = await supabase.from('restaurants').select('*').eq('id', profile.restaurant_id).single()
    setRestaurant(r || {})
    if (r?.enabled_languages?.length) setEnabled(r.enabled_languages)
    if (r?.default_language) setDefaultLang(r.default_language)
    const gf = GARSON_FIELDS.find(k => r && k in r)
    if (gf) setGarson(!!r[gf])
  }

  const garsonField = restaurant ? GARSON_FIELDS.find(k => k in restaurant) : null

  async function persist(nextEnabled, nextDefault, nextGarson) {
    const payload = { enabled_languages: nextEnabled, default_language: nextDefault }
    if (garsonField) payload[garsonField] = nextGarson
    await supabase.from('restaurants').update(payload).eq('id', profile.restaurant_id)
    setFlash('✓ Kaydedildi'); setTimeout(() => setFlash(''), 1600)
  }

  function addLang() {
    if (!addPick || enabled.includes(addPick)) return
    const next = [...enabled, addPick]
    setEnabled(next); setAddPick(''); persist(next, defaultLang, garson)
  }
  function removeLang(code) {
    if (code === defaultLang) return
    const next = enabled.filter(c => c !== code)
    setEnabled(next); persist(next, defaultLang, garson)
  }
  function makeDefault(code) {
    setDefaultLang(code); persist(enabled, code, garson)
  }
  function toggleGarson() {
    const v = !garson; setGarson(v); persist(enabled, defaultLang, v)
  }

  // UI çevirileri sayımı
  const uiBundle = useMemo(() => {
    try { return flatten(i18n.getResourceBundle(defaultLang, 'translation') || i18n.getResourceBundle(i18n.language, 'translation') || {}) }
    catch { return {} }
  }, [i18n, defaultLang])
  const uiCount = Object.keys(uiBundle).length

  const activeLangObjs = ALL_LANGS.filter(l => enabled.includes(l.code))
  const addable = ALL_LANGS.filter(l => !enabled.includes(l.code))

  const TABS = [['langs', 'Diller', enabled.length], ['ui', 'UI Çevirileri', uiCount], ['search', 'Arama Önerileri', null]]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Diller & Çeviriler</h1>
          <p style={{ fontSize: 13, color: MUTED }}>Menü dilleri ve UI metinleri tek yerde</p>
        </div>
        {flash && <span style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>{flash}</span>}
      </div>

      {/* sekmeler */}
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${BORDER}`, margin: '20px 0 22px' }}>
        {TABS.map(([k, lbl, n]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: tab === k ? GREEN : '#999', borderBottom: `2px solid ${tab === k ? GREEN : 'transparent'}`, marginBottom: -1 }}>
            {lbl} {n != null && <span style={{ fontSize: 12, color: '#bbb', fontWeight: 600 }}>({n})</span>}
          </button>
        ))}
      </div>

      {/* ════ Diller ════ */}
      {tab === 'langs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Garson çeviri yardımı */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>💬</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Garson Çeviri Yardımı</p>
              <p style={{ fontSize: 12.5, color: '#888', lineHeight: 1.6 }}>Yabancı dil seçen müşteri ürün detayında <b>"Garsona Göster"</b> butonu görür — tıklayınca ürün adı + açıklaması hem kendi dilinde hem menü varsayılanında çıkar.</p>
            </div>
            <button onClick={toggleGarson} disabled={!garsonField} title={garsonField ? '' : 'Kolon gerekli'}
              style={{ width: 46, height: 26, borderRadius: 20, border: 'none', cursor: garsonField ? 'pointer' : 'default', position: 'relative', background: garson ? GREEN : '#d8d8d4', flexShrink: 0, opacity: garsonField ? 1 : 0.5 }}>
              <span style={{ position: 'absolute', top: 3, left: garson ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </button>
          </div>

          {/* Aktif Diller */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Aktif Diller</p>
            <p style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Menüde görünen diller</p>
            {activeLangObjs.map(l => {
              const isDefault = defaultLang === l.code
              return (
                <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: `1px solid #f4f4f2` }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#bbb', width: 26 }}>{l.flag}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>{l.name}</span>
                    <span style={{ fontSize: 12, color: '#bbb', marginLeft: 6 }}>{l.code}</span>
                    {isDefault && <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: GREEN_BG, color: GREEN, letterSpacing: '.03em' }}>VARSAYILAN</span>}
                  </div>
                  {isDefault ? (
                    <span style={{ fontSize: 12, color: '#ccc' }}>Varsayılan dil silinemez</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => alert('AI ile otomatik çeviri yakında — AI eklentisi gerektirir.')}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', border: `1px solid ${BORDER}`, borderRadius: 8, background: '#fff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✦ AI ile Oluştur</button>
                      <button onClick={() => makeDefault(l.code)} style={{ padding: '6px 11px', border: `1px solid ${BORDER}`, borderRadius: 8, background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Varsayılan yap</button>
                      <button onClick={() => removeLang(l.code)} style={{ padding: '6px 8px', border: 'none', background: 'none', color: RED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Kaldır</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Dil Ekle */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Dil Ekle</p>
            <p style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>Mevcut dillerden seçimini yap</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <select value={addPick} onChange={e => setAddPick(e.target.value)} disabled={!addable.length}
                style={{ flex: 1, maxWidth: 240, padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                <option value="">{addable.length ? 'Dil seç...' : 'Tüm diller ekli'}</option>
                {addable.map(l => <option key={l.code} value={l.code}>{l.name} ({l.tr})</option>)}
              </select>
              <button onClick={addLang} disabled={!addPick}
                style={{ padding: '10px 24px', background: addPick ? GREEN : '#d8d8d4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: addPick ? 'pointer' : 'default' }}>Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ UI Çevirileri ════ */}
      {tab === 'ui' && <UiTranslations i18n={i18n} defaultLang={defaultLang} activeLangs={activeLangObjs} bundle={uiBundle} />}

      {/* ════ Arama Önerileri ════ */}
      {tab === 'search' && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#444', marginBottom: 6 }}>Arama Önerileri</p>
          <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
            Müşteri arama kutusundaki hazır öneri çipleri (ör. "pizza", "kahve") dile göre tutulur.
            Bunu panelden yönetmek için <code>search_suggestions</code> adında bir tablo (restaurant_id, lang, term) açabiliriz —
            söyle, editörünü ekleyeyim reis.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── UI çeviri editörü (i18n tabanlı) ── */
function UiTranslations({ i18n, defaultLang, activeLangs, bundle }) {
  const targets = activeLangs.filter(l => l.code !== defaultLang)
  const [target, setTarget] = useState(targets[0]?.code || '')
  const [edits, setEdits] = useState({})
  const [q, setQ] = useState('')
  const [flash, setFlash] = useState('')

  const targetBundle = useMemo(() => {
    try { return flatten(i18n.getResourceBundle(target, 'translation') || {}) } catch { return {} }
  }, [i18n, target])

  const keys = useMemo(() => {
    const all = Object.keys(bundle)
    return q ? all.filter(k => k.toLowerCase().includes(q.toLowerCase()) || String(bundle[k]).toLowerCase().includes(q.toLowerCase())) : all
  }, [bundle, q])

  if (Object.keys(bundle).length === 0) {
    return (
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, textAlign: 'center', color: '#888' }}>
        <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
          i18n paketi okunamadı (namespace "translation" bekleniyor). Arayüz metinleri <code>src/i18n</code> dosyalarından yönetiliyor. Namespace farklıysa söyle reis, ona göre bağlarım.
        </p>
      </div>
    )
  }

  const val = k => edits[target]?.[k] ?? targetBundle[k] ?? ''
  const setVal = (k, v) => setEdits(p => ({ ...p, [target]: { ...(p[target] || {}), [k]: v } }))

  function exportJson() {
    const merged = { ...targetBundle, ...(edits[target] || {}) }
    const json = JSON.stringify(unflatten(merged), null, 2)
    navigator.clipboard.writeText(json)
    setFlash('✓ JSON panoya kopyalandı'); setTimeout(() => setFlash(''), 2000)
  }
  function applySession() {
    const merged = { ...targetBundle, ...(edits[target] || {}) }
    i18n.addResourceBundle(target, 'translation', unflatten(merged), true, true)
    setFlash('✓ Bu oturuma uygulandı (kalıcı için JSON\'u dosyana yapıştır)'); setTimeout(() => setFlash(''), 3000)
  }

  if (!target) return <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, textAlign: 'center', color: '#888' }}>Çeviri için en az bir ek dil etkinleştir.</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Dil:</span>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            {targets.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Metin ara..." style={{ flex: 1, minWidth: 180, padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13 }} />
        <button onClick={applySession} style={{ padding: '9px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff', color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Önizle (oturum)</button>
        <button onClick={exportJson} style={{ padding: '9px 16px', border: 'none', borderRadius: 10, background: GREEN, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>JSON Dışa Aktar</button>
      </div>
      {flash && <p style={{ fontSize: 12, color: GREEN, fontWeight: 600, marginBottom: 10 }}>{flash}</p>}

      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 0, background: '#fafafa', borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          <span>Anahtar</span><span>{defaultLang.toUpperCase()} (kaynak)</span><span>{target.toUpperCase()} (çeviri)</span>
        </div>
        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          {keys.map(k => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 12, alignItems: 'center', padding: '8px 16px', borderTop: `1px solid #f4f4f2` }}>
              <span style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span>
              <span style={{ fontSize: 12.5, color: '#555' }}>{String(bundle[k])}</span>
              <input value={val(k)} onChange={e => setVal(k, e.target.value)} placeholder="—"
                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12.5, boxSizing: 'border-box' }} />
            </div>
          ))}
          {keys.length === 0 && <p style={{ padding: 24, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Eşleşme yok.</p>}
        </div>
      </div>
    </div>
  )
}
