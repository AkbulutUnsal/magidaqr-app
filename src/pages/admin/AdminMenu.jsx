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
  const [allergens, setAllergens] = useState([])

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    const { data: cats } = await supabase.from('menu_categories')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    const { data: its } = await supabase.from('menu_items')
      .select('*, category:menu_categories(name_en)').eq('restaurant_id', profile.restaurant_id).order('sort_order')
    const { data: alg } = await supabase.from('allergens')
      .select('*').eq('restaurant_id', profile.restaurant_id).order('created_at')
    setCategories(cats || [])
    setItems(its || [])
    setAllergens(alg || [])
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
    const payload = { ...formData, restaurant_id: profile.restaurant_id }
    if (editItem?.id) {
      await supabase.from('menu_items').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('menu_items').insert(payload)
    }
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
                      {item.image_url && <img src={item.image_url} alt="" className="item-thumb" />}
                      <span>{item.name_en || item.name_ka}</span>
                    </div>
                  </td>
                  <td>{item.category?.name_en || '—'}</td>
                  <td>{item.price} ₾</td>
                  <td>
                    <button
                      className={`toggle-btn ${item.is_available ? 'on' : 'off'}`}
                      onClick={() => toggleAvailable(item)}
                    >{item.is_available ? '✅' : '❌'}</button>
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

      {showForm && (
        <ItemFormModal
          item={editItem}
          categories={categories}
          allergens={allergens}
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
    await supabase.from('menu_categories').insert({
      restaurant_id: restaurantId,
      name_ka: name.ka, name_en: name.en, name_tr: name.tr, name_ru: name.ru,
      sort_order: categories.length
    })
    setName({ ka:'', en:'', tr:'', ru:'' })
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
          <li key={cat.id} className="cat-row">
            <span>{cat.name_en}</span>
            <span className="cat-ka">{cat.name_ka}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ItemFormModal({ item, categories, allergens, onSave, onClose, t }) {
  const [form, setForm] = useState({
    name_ka: item?.name_ka || '', name_en: item?.name_en || '',
    name_tr: item?.name_tr || '', name_ru: item?.name_ru || '',
    description_en: item?.description_en || '',
    price: item?.price || '', category_id: item?.category_id || '',
    image_url: item?.image_url || '', is_available: item?.is_available ?? true,
    is_featured: item?.is_featured ?? false, goes_to_kitchen: item?.goes_to_kitchen ?? true,
    allergen_ids: item?.allergen_ids || []
  })

  const toggleAllergen = (id) => setForm(p => ({
    ...p,
    allergen_ids: p.allergen_ids.includes(id)
      ? p.allergen_ids.filter(x => x !== id)
      : [...p.allergen_ids, id]
  }))

  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item ? 'Ürünü düzenle' : t('add_item')}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            {['ka','en','tr','ru'].map(l => (
              <div key={l} className="form-group">
                <label>İsim ({l.toUpperCase()})</label>
                <input value={form[`name_${l}`]} onChange={e => set(`name_${l}`, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label>Açıklama (EN)</label>
            <textarea value={form.description_en} onChange={e => set('description_en', e.target.value)} rows={2} />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>{t('price')} (₾)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('categories')}</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">— Kategori seç —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Görsel URL</label>
            <input value={form.image_url} onChange={e => set('image_url', e.target.value)} />
          </div>
          {allergens.length > 0 && (
            <div className="form-group">
              <label>Alerjenler</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
                {allergens.map(a => {
                  const on = form.allergen_ids.includes(a.id)
                  return (
                    <button type="button" key={a.id} onClick={() => toggleAllergen(a.id)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px',
                        borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
                        border:`1.5px solid ${on ? '#dc2626' : '#e8e8e4'}`,
                        background: on ? '#fef2f2' : '#fff',
                        color: on ? '#dc2626' : '#888' }}>
                      <span>{a.icon}</span>{a.name_tr || a.name_en}
                      {on && ' ✓'}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {allergens.length === 0 && (
            <p style={{ fontSize:12, color:'#bbb', margin:'4px 0 12px' }}>
              Alerjen tanımlamak için önce "Alerjenler" sayfasından ekleyin.
            </p>
          )}
          <div className="form-checks">
            <label><input type="checkbox" checked={form.is_available} onChange={e => set('is_available', e.target.checked)} /> Mevcut</label>
            <label><input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} /> Öne çıkan</label>
            <label><input type="checkbox" checked={form.goes_to_kitchen} onChange={e => set('goes_to_kitchen', e.target.checked)} /> 🍳 Mutfağa gider (içecekler için kaldırın)</label>
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
