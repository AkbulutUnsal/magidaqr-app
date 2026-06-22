import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders(restaurantId, statuses = []) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const channelRef = useRef(null)

  const statusKey = statuses.join(',')

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return
    let query = supabase
      .from('orders')
      .select(`
        *,
        table:tables(table_number, label),
        order_items(
          *,
          menu_item:menu_items(name_ka, name_en, name_tr, name_ru, price)
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })

    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setOrders(data || [])
    setLoading(false)
  }, [restaurantId, statusKey])

  useEffect(() => {
    if (!restaurantId) return

    fetchOrders()

    // Her panel için benzersiz channel adı
    const channelName = `orders-${restaurantId}-${statusKey}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => {
        fetchOrders()
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [restaurantId, statusKey])

  const updateStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
    if (error) throw error
    // fetchOrders'ı burada çağırmıyoruz — realtime event zaten tetikleyecek
  }

  return { orders, loading, error, refetch: fetchOrders, updateStatus }
}
