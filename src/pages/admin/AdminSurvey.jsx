import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/* ───────────────────────────────────────────────────────────
   magidaQR · Memnuniyet Raporu (Anket)  (qrmenum referans · #1D9E75)
   surveys'in her satırı = bir soru (çok-soru desteği).
   Soru bazlı ortalama: survey_responses.survey_id varsa kullanılır.
─────────────────────────────────────────────────────────── */

const GREEN = '#1D9E75'
const BORDER = '#e8e8e4'
const MUTED = '#888'
const LINK_FIELDS = ['survey_id', 'question_id', 'survey_question_id']
const READ_FIELDS = ['is_read', 'read', 'seen']

export default function AdminSurvey() {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const lang = (i18n.language || 'tr').slice(0, 2)
  const [questions, setQuestions] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('report') // report | responses
  const [manage, setManage] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    setLoading(true)
    const rid = profile.restaurant_id
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('surveys').select('*').eq('restaurant_id', rid).order('created_at'),
      supabase.from('survey_responses').select('*').eq('restaurant_id', rid).order('created_at', { ascending: false }).limit(300),
    ])
    setQuestions(s || [])
    setResponses(r || [])
    setLoading(false)
  }

  const dispQ = q => q?.[`question_${lang}`] || q?.question_tr || q?.question_en || q?.question_ka || '(soru)'
  const linkField = LINK_FIELDS.find(k => k in (responses[0] || {})) || null
  const readField = READ_FIELDS.find(k => k in (responses[0] || {})) || null

  const ratings = responses.filter(r => r.rating).map(r => Number(r.rating))
  const overall = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0
  const unread = readField ? responses.filter(r => !r[readField]).length : null
  const anketAktif = questions.some(q => q.is_active !== false) && questions.length > 0

  // soru bazlı ortalamalar
  const perQuestion = useMemo(() => {
    if (linkField && questions.length) {
      return questions.map(q => {
        const rs = responses.filter(r => r[linkField] === q.id && r.rating).map(r => Number(r.rating))
        return { label: dispQ(q), avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0, count: rs.length }
      })
    }
    // bağ yoksa: tek genel bar
    return [{ label: 'Genel memnuniyet', avg: overall, count: ratings.length, _overall: true }]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, responses, linkField, lang])

  async function toggleActive() {
    const next = !anketAktif
    setQuestions(prev => prev.map(q => ({ ...q, is_active: next })))
    for (const q of questions) await supabase.from('surveys').update({ is_active: next }).eq('id', q.id)
  }
  async function markAllRead() {
    if (!readField) return
    setResponses(prev => prev.map(r => ({ ...r, [readField]: true })))
    await supabase.from('survey_responses').update({ [readField]: true }).eq('restaurant_id', profile.restaurant_id)
  }

  const comments = responses.filter(r => r.comment)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Memnuniyet Raporu</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#444', background: '#fff', cursor: 'pointer' }}>
            <input type="checkbox" checked={anketAktif} onChange={toggleActive} disabled={questions.length === 0} style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }} /> Anket aktif
          </label>
          <button onClick={() => setManage(true)} style={btnGhost}><EditIcon /> Soruları Yönet</button>
          <button onClick={() => setView(v => v === 'report' ? 'responses' : 'report')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,158,117,.3)' }}>
            💬 {view === 'report' ? `Yanıtlar (${responses.length})` : 'Rapora dön'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 56, textAlign: 'center', color: '#bbb' }}>Yükleniyor...</div>
      ) : view === 'responses' ? (
        <ResponsesView comments={comments} readField={readField} unread={unread} markAllRead={markAllRead} />
      ) : (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 20 }}>
            <Kpi big={ratings.length ? overall.toFixed(1) : '—'} label="Genel Ortalama" sub="5 üzerinden" green />
            <Kpi big={responses.length} label="Toplam Yanıt" />
            <Kpi big={unread == null ? '—' : unread} label="Okunmamış" />
          </div>

          {/* Soru bazlı ortalamalar */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Soru Bazlı Ortalamalar</p>
            {questions.length === 0 ? (
              <p style={{ fontSize: 13, color: '#bbb' }}>Henüz soru yok. "Soruları Yönet" ile ekle.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {perQuestion.map((p, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{p.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>{p.count ? p.avg.toFixed(1) : '—'}</span>
                    </div>
                    <div style={{ height: 10, background: '#f0f0ee', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(p.avg / 5) * 100}%`, height: '100%', background: GREEN, borderRadius: 6, transition: 'width .3s' }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>{p.count} yanıt</p>
                  </div>
                ))}
                {perQuestion[0]?._overall && questions.length > 1 && (
                  <p style={{ fontSize: 11.5, color: '#bbb' }}>
                    <b>Not (reis):</b> Soru bazlı ortalama için <code>survey_responses</code>'a <code>survey_id</code> kolonu eklersen her soru ayrı hesaplanır.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {manage && <QuestionsModal questions={questions} restaurantId={profile.restaurant_id} onClose={() => setManage(false)} onSaved={() => { setManage(false); load() }} />}
    </div>
  )
}

function ResponsesView({ comments, readField, unread, markAllRead }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 700 }}>Yorumlu Yanıtlar <span style={{ color: '#aaa', fontWeight: 600 }}>({comments.length})</span></p>
        {readField && unread > 0 && <button onClick={markAllRead} style={btnGhost}>Tümünü okundu işaretle ({unread})</button>}
      </div>
      {comments.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 48, textAlign: 'center', color: '#bbb', fontSize: 14 }}>Henüz yorumlu yanıt yok.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {comments.map(r => (
            <div key={r.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: '#f59e0b', fontSize: 14, letterSpacing: 1 }}>{'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))}</span>
                <span style={{ fontSize: 11, color: '#bbb' }}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
              </div>
              <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Soruları Yönet ── */
function QuestionsModal({ questions, restaurantId, onClose, onSaved }) {
  const [qs, setQs] = useState(questions.map(q => ({ id: q.id, question_tr: q.question_tr || '', question_en: q.question_en || '', question_ka: q.question_ka || '', question_ru: q.question_ru || '' })))
  const [removed, setRemoved] = useState([])
  const [saving, setSaving] = useState(false)

  const add = () => setQs(p => [...p, { question_tr: '', question_en: '', question_ka: '', question_ru: '' }])
  const setQ = (i, l, v) => setQs(p => p.map((q, idx) => idx === i ? { ...q, [`question_${l}`]: v } : q))
  const remove = i => { const q = qs[i]; if (q.id) setRemoved(r => [...r, q.id]); setQs(p => p.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true)
    for (const id of removed) await supabase.from('surveys').delete().eq('id', id)
    for (const q of qs) {
      if (!q.question_tr && !q.question_en) continue
      const payload = { question_tr: q.question_tr, question_en: q.question_en, question_ka: q.question_ka, question_ru: q.question_ru, restaurant_id: restaurantId, is_active: true }
      if (q.id) await supabase.from('surveys').update(payload).eq('id', q.id)
      else await supabase.from('surveys').insert(payload)
    }
    setSaving(false); onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>Anket Soruları</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
          {qs.length === 0 && <p style={{ fontSize: 13, color: '#bbb' }}>Henüz soru yok. "+ Soru Ekle" ile başla.</p>}
          {qs.map((q, i) => (
            <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Soru {i + 1}</span>
                <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E8192C', fontSize: 12, fontWeight: 600 }}>Sil</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {['tr', 'en', 'ka', 'ru'].map(l => (
                  <input key={l} value={q[`question_${l}`]} onChange={e => setQ(i, l, e.target.value)} placeholder={l === 'tr' ? 'Soru (TR)' : l.toUpperCase()}
                    style={{ width: '100%', padding: '9px 11px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, boxSizing: 'border-box' }} />
                ))}
              </div>
            </div>
          ))}
          <button onClick={add} style={{ alignSelf: 'flex-start', background: 'none', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '9px 16px', color: GREEN, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Soru Ekle</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' }}>İptal</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 22px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}

function Kpi({ big, label, sub, green }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 38, fontWeight: 900, color: green ? GREEN : '#111' }}>{big}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginTop: 2 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}
const btnGhost = { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: '#fff', color: '#444', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
function EditIcon() { return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg> }
