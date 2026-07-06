import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { formatPrice } from './currency'

export function useCurrency() {
  const { i18n } = useTranslation()
  const [rates, setRates] = useState({})

  useEffect(() => {
    let active = true
    supabase.from('exchange_rates').select('currency_code, rate_from_gel').then(({ data }) => {
      if (!active || !data) return
      const map = {}
      data.forEach(r => { map[r.currency_code] = Number(r.rate_from_gel) })
      setRates(map)
    })
    return () => { active = false }
  }, [])

  const format = useCallback(
    (amountGEL) => formatPrice(amountGEL, i18n.language, rates),
    [i18n.language, rates]
  )

  return { format }
}
