// AdminReports.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts'

export default function AdminReports() {
  const { profile } = useAuth()
  const [topItems, setTopItems] = useState([])
  const [statusDist, setStatusDist] = useState([])

  useEffect(() => { if (profile?.restaurant_id) load() }, [profile?.restaurant_id])

  async function load() {
    // En çok sipariş edilen ürünler
    const { data } = await supabase
      .from('order_items')
      .select('menu_item_id, quantity, menu_item:menu_items(name_en)')
      .limit(200)

    const counts = {}
    data?.forEach(oi => {
      const name = oi.menu_item?.name_en || oi.menu_item_id
      counts[name] = (counts[name] || 0) + oi.quantity
    })
    const sorted = Object.entries(counts)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
    setTopItems(sorted)

    // Sipariş durum dağılımı
    const { data: orders } = await supabase.from('orders')
      .select('status').eq('restaurant_id', profile.restaurant_id)
    const dist = {}
    orders?.forEach(o => { dist[o.status] = (dist[o.status] || 0) + 1 })
    setStatusDist(Object.entries(dist).map(([name, value]) => ({ name, value })))
  }

  const COLORS = ['#1D9E75','#E24B4A','#BA7517','#534AB7','#888780']

  return (
    <div className="admin-page">
      <h1 className="page-title">Raporlar</h1>

      <div className="report-grid">
        <div className="report-card">
          <h3>En çok sipariş edilen ürünler</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topItems} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1D9E75" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="report-card">
          <h3>Sipariş durumu dağılımı</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
