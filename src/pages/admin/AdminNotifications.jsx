import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · SMS Bildirimleri (Faz 4a)  ·  /admin/bildirimler
   Her restoran kendi SMS sağlayıcı hesabını bağlar, kendi kredisinden gönderir.
   Sağlayıcı + kimlik + olay anahtarları + şablonlar + test + gönderim kaydı.
   Şema: sms_settings, sms_templates, sms_log · Gönderim: send-sms Edge Function.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const GREEN_BG = '#e8f5ee'
const RED = '#E8192C'
const BORDER = '#e8e8e4'
const MUTED = '#888'

const PROVIDERS = [
  { key: 'netgsm',    name: 'NetGSM',      hint: 'Türkiye · usercode + şifre + başlık' },
  { key: 'smsoffice', name: 'SMSOffice.ge', hint: 'Gürcistan · API key + gönderen adı' },
  { key: 'twilio',    name: 'Twilio',      hint: 'Global · Account SID + Auth Token + numara' },
  { key: 'custom',    name: 'Özel HTTP',   hint: 'Diğer sağlayıcılar · URL + parametre eşlemesi' },
]

// sağlayıcıya göre alan etiketleri
const FIELDS = {
  netgsm:    { api_user: 'Kullanıcı kodu (usercode)', api_secret: 'Şifre', api_key: null, sender: 'Mesaj başlığı' },
  smsoffice: { api_user: null, api_secret: null, api_key: 'API Key', sender: 'Gönderen adı' },
  twilio:    { api_user: 'Account SID', api_secret: null, api_key: 'Auth Token', sender: 'Gönderen numara (+995…)' },
  custom:    { api_user: null, api_secret: null, api_key: 'API Key (varsa)', sender: 'Gönderen adı' },
}

const EVENTS = [
  { key: 'order_received', flag: 'on_order_received', label: 'Sipariş alındı',  desc: 'Müşteriye sipariş onayı' },
  { key: 'order_ready',    flag: 'on_order_ready',    label: 'Sipariş hazır',   desc: 'Hazır olunca bilgilendir' },
  { key: 'loyalty_earned', flag: 'on_loyalty_earned', label: 'Puan kazanıldı',  desc: 'Sadakat puanı bildirimi' },
  { key: 'reward_ready',   flag: 'on_reward_ready',   label: 'Ödül hazır',      desc: 'Damga dolunca haber ver' },
]
const LANGS = [['tr', 'TR'], ['en', 'EN'], ['ka', 'KA'], ['ru', 'RU']]
const VARS = ['{{restoran}}', '{{isim}}', '{{masa}}', '{{tutar}}', '{{siparis_no}}', '{{puan}}', '{{toplam_puan}}', '{{damga}}', '{{odul}}']

const DEFAULTS = {
  enabled: false, provider: 'netgsm', sender_id: '', api_user: '', api_key: '', api_secret: '',
  extra: {}, on_order_received: false, on_order_ready: false, on_loyalty_earned: false, on_reward_ready: false,
}
const fmtDate = ts => ts ? new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function AdminNotifications() {
  const { profile } = useAuth()
  const [s, setS] = useState(DEFAULTS)
  const [templates, setTemplates] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('settings')   // settings | templates | log
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('magidaQR test mesajı')
  const [testResult, setTestResult] = useState(null)
  const [tplLang, setTplLang] = useState('tr')
  const ridRef = useRef(profile?.restaurant_id)
  useEffect(() => { ridRef.current = profile?.restaurant_id }, [profile?.restaurant_id])

  async function load() {
    const rid = ridRef.current; if (!rid) return
    const [{ data: st }, { data: tpl }, { data: lg }] = await Promise.all([
      supabase.from('sms_settings').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('sms_templates').select('*').eq('restaurant_id', rid),
      supabase.from('sms_log').select('*').eq('restaurant_id', rid).order('created_at', { ascending: false }).limit(50),
    ])
    if (st) setS({ ...DEFAULTS, ...st, extra: st.extra || {} })
    setTemplates(tpl || [])
    setLog(lg || [])
    setLoading(false)
  }
  useEffect(() => { if (profile?.restaurant_id) load() /* eslint-disable-next-line */ }, [profile?.restaurant_id])

  const set = (k, v) => { setS(p => ({ ...p, [k]: v })); setSaved(false) }
  const setExtra = (k, v) => { setS(p => ({ ...p, extra: { ...(p.extra || {}), [k]: v } })); setSaved(false) }

  async function save() {
    const rid = ridRef.current; if (!rid) return
    setSaving(true)
    const payload = {
      restaurant_id: rid, enabled: s.enabled, provider: s.provider, sender_id: s.sender_id,
      api_user: s.api_user, api_key: s.api_key, api_secret: s.api_secret, extra: s.extra || {},
      on_order_received: s.on_order_received, on_order_ready: s.on_order_ready,
      on_loyalty_earned: s.on_loyalty_earned, on_reward_ready: s.on_reward_ready,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('sms_settings').upsert(payload, { onConflict: 'restaurant_id' })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    else alert('Kaydedilemedi: ' + error.message)
  }

  async function saveTemplate(event, lang, body) {
    const rid = ridRef.current
    await supabase.from('sms_templates').upsert(
      { restaurant_id: rid, event, lang, body }, { onConflict: 'restaurant_id,event,lang' })
    load()
  }

  async function sendTest() {
    const rid = ridRef.current
    setTestResult({ pending: true })
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { restaurant_id: rid, phone: testPhone, body: testMsg },
      })
      if (error) setTestResult({ ok: false, msg: error.message })
      else setTestResult({ ok: !!data?.ok, msg: data?.detail || data?.error || 'Gönderildi' })
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) })
    }
    load()
  }

  const f = FIELDS[s.provider] || FIELDS.netgsm
  const inp = { width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none' }
  const lbl = { fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 5 }
  const tplOf = (ev, lg) => templates.find(t => t.event === ev && t.lang === lg)?.body || ''

  if (loading) return <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor…</div>

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>SMS Bildirimleri</h1>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: s.enabled ? GREEN : '#aaa', background: s.enabled ? GREEN_BG : '#f4f4f2', padding: '4px 11px', borderRadius: 20 }}>
          {s.enabled ? '● Aktif' : '○ Kapalı'}
        </span>
      </div>
      <p style={{ fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.6 }}>
        Kendi SMS sağlayıcı hesabını bağla — mesajlar senin kredinden, senin gönderen adınla gider.
      </p>

      {/* sekmeler */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['settings', '⚙️ Ayarlar'], ['templates', '✏️ Şablonlar'], ['log', '🕘 Kayıtlar']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${tab === k ? GREEN : BORDER}`, background: tab === k ? GREEN : '#fff', color: tab === k ? '#fff' : '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ana anahtar */}
          <Card>
            <label style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!s.enabled} onChange={e => set('enabled', e.target.checked)} style={{ width: 19, height: 19 }} />
              <span>
                <span style={{ fontSize: 15, fontWeight: 700, display: 'block' }}>SMS gönderimi aktif</span>
                <span style={{ fontSize: 12, color: MUTED }}>Kapalıyken hiçbir mesaj gönderilmez</span>
              </span>
            </label>
          </Card>

          {/* sağlayıcı */}
          <Card title="Sağlayıcı">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 9, marginBottom: 16 }}>
              {PROVIDERS.map(p => (
                <button key={p.key} onClick={() => set('provider', p.key)}
                  style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 11, border: `1.5px solid ${s.provider === p.key ? GREEN : BORDER}`, background: s.provider === p.key ? GREEN_BG : '#fff', cursor: 'pointer' }}>
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: s.provider === p.key ? GREEN : '#333' }}>{p.name}</p>
                  <p style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{p.hint}</p>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={lbl}>{f.sender}</label>
                <input value={s.sender_id || ''} onChange={e => set('sender_id', e.target.value)} style={inp} /></div>
              {f.api_user && <div><label style={lbl}>{f.api_user}</label>
                <input value={s.api_user || ''} onChange={e => set('api_user', e.target.value)} style={inp} /></div>}
              {f.api_key && <div><label style={lbl}>{f.api_key}</label>
                <input type="password" value={s.api_key || ''} onChange={e => set('api_key', e.target.value)} style={inp} autoComplete="new-password" /></div>}
              {f.api_secret && <div><label style={lbl}>{f.api_secret}</label>
                <input type="password" value={s.api_secret || ''} onChange={e => set('api_secret', e.target.value)} style={inp} autoComplete="new-password" /></div>}

              {s.provider === 'custom' && (
                <>
                  <div><label style={lbl}>İstek URL'si</label>
                    <input value={s.extra?.url || ''} onChange={e => setExtra('url', e.target.value)} style={inp} placeholder="https://saglayici.com/api/send" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div><label style={lbl}>Method</label>
                      <select value={s.extra?.method || 'GET'} onChange={e => setExtra('method', e.target.value)} style={inp}>
                        <option>GET</option><option>POST</option>
                      </select></div>
                    <div><label style={lbl}>Telefon param</label>
                      <input value={s.extra?.phone_param || ''} onChange={e => setExtra('phone_param', e.target.value)} style={inp} placeholder="phone" /></div>
                    <div><label style={lbl}>Mesaj param</label>
                      <input value={s.extra?.text_param || ''} onChange={e => setExtra('text_param', e.target.value)} style={inp} placeholder="message" /></div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* olaylar */}
          <Card title="Hangi durumlarda SMS gitsin?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {EVENTS.map(ev => (
                <label key={ev.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid #f4f4f2', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!s[ev.flag]} onChange={e => set(ev.flag, e.target.checked)} style={{ width: 18, height: 18 }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{ev.label}</span>
                    <span style={{ fontSize: 11.5, color: MUTED }}>{ev.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 12, lineHeight: 1.6 }}>
              Not: Olay bağlantıları bir sonraki adımda devreye girecek. Şimdilik ayarları kaydedip test gönderimi yapabilirsin.
            </p>
          </Card>

          {/* kaydet */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={save} disabled={saving}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 11, padding: '13px 26px', fontSize: 14.5, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {saved && <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>✓ Kaydedildi</span>}
          </div>

          {/* test */}
          <Card title="Test gönderimi">
            <div style={{ display: 'grid', gap: 10 }}>
              <div><label style={lbl}>Test numarası</label>
                <input value={testPhone} onChange={e => setTestPhone(e.target.value)} style={inp} placeholder="+995 5xx xx xx xx" /></div>
              <div><label style={lbl}>Mesaj</label>
                <input value={testMsg} onChange={e => setTestMsg(e.target.value)} style={inp} /></div>
              <button onClick={sendTest} disabled={!testPhone || !s.enabled}
                style={{ background: (!testPhone || !s.enabled) ? '#cbd5d0' : '#333', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: (!testPhone || !s.enabled) ? 'not-allowed' : 'pointer' }}>
                📤 Test SMS gönder
              </button>
              {!s.enabled && <p style={{ fontSize: 11.5, color: '#c2410c' }}>Test için önce "SMS gönderimi aktif" olmalı ve ayarlar kaydedilmeli.</p>}
              {testResult && (
                <div style={{ background: testResult.pending ? '#f8f8f6' : testResult.ok ? GREEN_BG : '#fef2f2', border: `1px solid ${testResult.pending ? BORDER : testResult.ok ? GREEN : RED}`, borderRadius: 10, padding: '10px 13px' }}>
                  <p style={{ fontSize: 12.5, color: testResult.pending ? MUTED : testResult.ok ? '#0f5c40' : '#991b1b', wordBreak: 'break-word' }}>
                    {testResult.pending ? 'Gönderiliyor…' : (testResult.ok ? '✓ ' : '✕ ') + testResult.msg}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'templates' && (
        <div>
          <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
            {LANGS.map(([k, l]) => (
              <button key={k} onClick={() => setTplLang(k)}
                style={{ padding: '7px 15px', borderRadius: 20, border: `1px solid ${tplLang === k ? GREEN : BORDER}`, background: tplLang === k ? GREEN : '#fff', color: tplLang === k ? '#fff' : '#555', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          <div style={{ background: '#fafafa', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>
            <p style={{ fontSize: 11.5, color: MUTED, marginBottom: 6 }}>Kullanılabilir değişkenler:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {VARS.map(v => <code key={v} style={{ fontSize: 11, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 5, padding: '2px 6px', color: '#555' }}>{v}</code>)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {EVENTS.map(ev => (
              <TemplateEditor key={ev.key} label={ev.label} value={tplOf(ev.key, tplLang)}
                onSave={body => saveTemplate(ev.key, tplLang, body)} />
            ))}
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          {log.length === 0 ? (
            <p style={{ padding: '44px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Henüz gönderim yok.</p>
          ) : log.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 15px', borderTop: i ? '1px solid #f4f4f2' : 'none' }}>
              <span style={{ fontSize: 15 }}>{l.status === 'sent' ? '✅' : '❌'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: '#222', wordBreak: 'break-word' }}>{l.body}</p>
                <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{l.phone} · {l.event} · {fmtDate(l.created_at)}</p>
                {l.error && <p style={{ fontSize: 11, color: RED, marginTop: 3, wordBreak: 'break-word' }}>{l.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateEditor({ label, value, onSave }) {
  const [v, setV] = useState(value)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setV(value); setDirty(false) }, [value])
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 13, padding: 15 }}>
      <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 9 }}>{label}</p>
      <textarea value={v} onChange={e => { setV(e.target.value); setDirty(true) }} rows={2}
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#bbb' }}>{v.length} karakter{v.length > 160 ? ` · ${Math.ceil(v.length / 160)} SMS` : ''}</span>
        <button onClick={() => { onSave(v); setDirty(false) }} disabled={!dirty}
          style={{ marginLeft: 'auto', background: dirty ? GREEN : '#f0f0ee', color: dirty ? '#fff' : '#bbb', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: dirty ? 'pointer' : 'default' }}>Kaydet</button>
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
      {title && <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>{title}</p>}
      {children}
    </div>
  )
}
