import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function AdminMenu() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [activeTab, setActiveTab] = useState('items')
  const [editItem, setEditItem] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: cats } = await supabase.from('menu_categories')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    const { data: its } = await supabase.from('menu_items')
      .select('*, category:menu_categories(name_en)').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    setCategories(cats || [])
    setItems(its || [])
  }

  async function toggleAvailable(item) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    load()
  }

  async function deleteItem(id) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    load()
  }

  async function saveItem(formData) {
    const payload = {
      ...formData,
      restaurant_id: profile.restaurant_id,
      category_id: formData.category_id || null,
      price: parseFloat(formData.price) || 0,
      image_url: formData.image_url || null,
      calories: formData.calories ? parseInt(formData.calories) : null,
    }
    let error
    if (editItem?.id) {
      const res = await supabase.from('menu_items').update(payload).eq('id', editItem.id)
      error = res.error
    } else {
      const res = await supabase.from('menu_items').insert(payload)
      error = res.error
    }
    if (error) { alert('Hata: ' + error.message); return }
    setShowForm(false)
    setEditItem(null)
    load()
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">{t('menu_management')}</h1>
        <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>
          + {t('add_item')}
        </button>
      </div>

      <div className="tab-bar">
        <button className={`tab ${activeTab==='items'?'active':''}`} onClick={()=>setActiveTab('items')}>{t('items')}</button>
        <button className={`tab ${activeTab==='cats'?'active':''}`} onClick={()=>setActiveTab('cats')}>{t('categories')}</button>
      </div>

      {activeTab === 'items' && (
        <div className="menu-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('categories')}</th>
                <th>{t('price')}</th>
                <th>{t('available')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="item-name-cell">
                      {item.image_url
                        ? <img src={item.image_url} alt="" className="item-thumb" />
                        : <div style={{ width:36, height:36, borderRadius:6, background:'#f0f0ee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🍽️</div>
                      }
                      <span>{item.name_en || item.name_ka}</span>
                    </div>
                  </td>
                  <td>{item.category?.name_en || '—'}</td>
                  <td>{item.price} ₾</td>
                  <td>
                    <button className={`toggle-btn ${item.is_available?'on':'off'}`} onClick={() => toggleAvailable(item)}>
                      {item.is_available ? '✅' : '❌'}
                    </button>
                  </td>
                  <td className="action-cell">
                    <button className="icon-btn" onClick={() => { setEditItem(item); setShowForm(true) }}>✏️</button>
                    <button className="icon-btn danger" onClick={() => deleteItem(item.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'cats' && (
        <CategoriesTab categories={categories} restaurantId={profile?.restaurant_id} onRefresh={load} t={t} />
      )}

      {showForm && categories.length > 0 && (
        <ItemFormModal
          item={editItem}
          categories={categories}
          restaurantId={profile?.restaurant_id}
          onSave={saveItem}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          t={t}
        />
      )}
    </div>
  )
}

function CategoriesTab({ categories, restaurantId, onRefresh, t }) {
  const [name, setName] = useState({ ka:'', en:'', tr:'', ru:'' })

  async function addCat() {
    if (!name.en) return
    const { error } = await supabase.from('menu_categories').insert({
      restaurant_id: restaurantId,
      name_ka: name.ka, name_en: name.en, name_tr: name.tr, name_ru: name.ru,
      sort_order: categories.length
    })
    if (error) { alert('Hata: ' + error.message); return }
    setName({ ka:'', en:'', tr:'', ru:'' })
    onRefresh()
  }

  async function deleteCat(id) {
    if (!confirm('Kategoriyi sil? İçindeki ürünler kategorisiz kalır.')) return
    await supabase.from('menu_categories').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="cats-section">
      <div className="cat-add-form">
        {['ka','en','tr','ru'].map(l => (
          <input key={l} placeholder={`İsim (${l.toUpperCase()})`} value={name[l]}
            onChange={e => setName(p => ({...p, [l]:e.target.value}))} className="cat-input" />
        ))}
        <button className="btn-primary" onClick={addCat}>+ Ekle</button>
      </div>
      <ul className="cat-list">
        {categories.map(cat => (
          <li key={cat.id} className="cat-row" style={{ justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:16 }}>
              <span>{cat.name_en}</span>
              <span className="cat-ka">{cat.name_ka}</span>
            </div>
            <button className="icon-btn danger" onClick={() => deleteCat(cat.id)}>🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ItemFormModal({ item, categories, restaurantId, onSave, onClose, t }) {
  const [form, setForm] = useState({
    name_ka: item?.name_ka || '', name_en: item?.name_en || '',
    name_tr: item?.name_tr || '', name_ru: item?.name_ru || '',
    description_ka: item?.description_ka || '', description_en: item?.description_en || '',
    description_tr: item?.description_tr || '', description_ru: item?.description_ru || '',
    price: item?.price || '', category_id: item?.category_id || '',
    image_url: item?.image_url || '', calories: item?.calories || '',
    is_available: item?.is_available ?? true, is_featured: item?.is_featured ?? false
  })
  const [uploading, setUploading] = useState(false)

  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  async function uploadImage(file) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${restaurantId}/items/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(path)
    set('image_url', publicUrl)
    setUploading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width:600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item ? 'Ürünü düzenle' : t('add_item')}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Görsel */}
          <div style={{ display:'flex', gap:16, marginBottom:16, alignItems:'flex-start' }}>
            <div style={{ width:100, height:100, borderRadius:12, background:'#f0f0ee', overflow:'hidden', flexShrink:0, border:'1px solid #eee' }}>
              {form.image_url
                ? <img src={form.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>🍽️</div>
              }
            </div>
            <div style={{ flex:1 }}>
              <label className="upload-label" style={{ marginBottom:8 }}>
                {uploading ? '⏳ Yükleniyor...' : '📁 Görsel yükle'}
                <input type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => e.target.files[0] && uploadImage(e.target.files[0])} />
              </label>
              <div className="form-group">
                <label>veya görsel URL</label>
                <input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* İsimler */}
          <div className="form-row">
            {['ka','en','tr','ru'].map(l => (
              <div key={l} className="form-group">
                <label>İsim ({l.toUpperCase()})</label>
                <input value={form[`name_${l}`]} onChange={e => set(`name_${l}`, e.target.value)} />
              </div>
            ))}
          </div>

          {/* Açıklamalar */}
          <div className="form-row">
            {['ka','en','tr','ru'].map(l => (
              <div key={l} className="form-group">
                <label>Açıklama ({l.toUpperCase()})</label>
                <textarea value={form[`description_${l}`]} onChange={e => set(`description_${l}`, e.target.value)} rows={2} />
              </div>
            ))}
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>{t('price')} (₾)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Kalori (kcal)</label>
              <input type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="350" />
            </div>
          </div>

          <div className="form-group">
            <label>{t('categories')}</label>
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">— Kategori seç —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </div>

          <div className="form-checks">
            <label><input type="checkbox" checked={form.is_available} onChange={e => set('is_available', e.target.checked)} /> Mevcut</label>
            <label><input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} /> Öne çıkan</label>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={() => onSave(form)}>{t('save')}</button>
        </div>
      </div>
    </div>
  )
}
