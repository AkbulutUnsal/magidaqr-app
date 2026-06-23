import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminSurvey() {
  const { profile } = useAuth()
  const [survey, setSurvey] = useState(null)
  const [responses, setResponses] = useState([])
  const [tab, setTab] = useState('responses')
  const [q, setQ] = useState({ question_ka:'', question_en:'', question_tr:'', question_ru:'' })
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: s } = await supabase.from('surveys')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('created_at', { ascending:false }).limit(1).maybeSingle()
    if (s) {
      setSurvey(s)
      setQ({ question_ka:s.question_ka||'', question_en:s.question_en||'',
             question_tr:s.question_tr||'', question_ru:s.question_ru||'' })
    }
    const { data: r } = await supabase.from('survey_responses')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('created_at', { ascending:false }).limit(100)
    setResponses(r || [])
  }

  async function saveQuestion() {
    const payload = { ...q, restaurant_id: profile.restaurant_id, is_active:true }
    if (survey?.id) await supabase.from('surveys').update(payload).eq('id', survey.id)
    else await supabase.from('surveys').insert(payload)
    setSaved(true); setTimeout(()=>setSaved(false), 2000)
    load()
  }

  const set = (k,v) => setQ(p=>({...p,[k]:v}))

  // istatistikler
  const ratings = responses.filter(r=>r.rating).map(r=>r.rating)
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '—'
  const dist = [5,4,3,2,1].map(star => ({
    star, count: ratings.filter(r=>r===star).length
  }))
  const maxCount = Math.max(1, ...dist.map(d=>d.count))

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Anket & Geri Bildirim</h1>
      </div>

      <div className="tab-bar" style={{marginBottom:20}}>
        <button className={`tab ${tab==='responses'?'active':''}`} onClick={()=>setTab('responses')}>
          Yanıtlar ({responses.length})
        </button>
        <button className={`tab ${tab==='settings'?'active':''}`} onClick={()=>setTab('settings')}>
          Soru Ayarı
        </button>
      </div>

      {tab === 'responses' && (
        <>
          {/* Özet */}
          <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:16,marginBottom:24}}>
            <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:24,textAlign:'center'}}>
              <div style={{fontSize:42,fontWeight:900,color:'#1D9E75'}}>{avg}</div>
              <div style={{color:'#f59e0b',fontSize:18,margin:'4px 0'}}>
                {'★'.repeat(Math.round(avg)||0)}{'☆'.repeat(5-(Math.round(avg)||0))}
              </div>
              <p style={{fontSize:12,color:'#999'}}>{ratings.length} değerlendirme</p>
            </div>
            <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:20}}>
              {dist.map(d => (
                <div key={d.star} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <span style={{fontSize:12,color:'#888',width:30}}>{d.star} ★</span>
                  <div style={{flex:1,height:8,background:'#f0f0ee',borderRadius:4,overflow:'hidden'}}>
                    <div style={{width:`${(d.count/maxCount)*100}%`,height:'100%',background:'#1D9E75',borderRadius:4}} />
                  </div>
                  <span style={{fontSize:12,color:'#999',width:28,textAlign:'right'}}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Yorumlar */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {responses.filter(r=>r.comment).map(r => (
              <div key={r.id} style={{background:'#fff',border:'1px solid #eee',borderRadius:12,padding:'14px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{color:'#f59e0b',fontSize:14}}>{'★'.repeat(r.rating||0)}{'☆'.repeat(5-(r.rating||0))}</span>
                  <span style={{fontSize:11,color:'#bbb'}}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
                <p style={{fontSize:13,color:'#444',lineHeight:1.5}}>{r.comment}</p>
              </div>
            ))}
            {responses.filter(r=>r.comment).length === 0 && (
              <p style={{color:'#bbb',fontSize:13}}>Henüz yorumlu yanıt yok.</p>
            )}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <div style={{background:'#fff',border:'1px solid #eee',borderRadius:14,padding:24,maxWidth:560}}>
          <p style={{fontSize:13,color:'#888',marginBottom:18}}>
            Müşteriye servis sonrası sorulacak anket sorusu.
          </p>
          {['tr','en','ka','ru'].map(l => (
            <div key={l} style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>
                Soru ({l.toUpperCase()})
              </label>
              <input value={q[`question_${l}`]} onChange={e=>set(`question_${l}`,e.target.value)}
                placeholder={l==='tr'?'Deneyiminizi değerlendirin':''}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #e8e8e4',borderRadius:8,fontSize:13}} />
            </div>
          ))}
          <button className="btn-primary" onClick={saveQuestion} style={{marginTop:8}}>
            {saved?'✓ Kaydedildi':'Soruyu Kaydet'}
          </button>
        </div>
      )}
    </div>
  )
}
