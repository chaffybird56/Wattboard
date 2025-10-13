'use client'

import { useState, useEffect } from 'react'
import { Alert } from '@/types'

export function useAlerts(siteId?: number | null) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!siteId) {
        setAlerts([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/alerts?site_id=${siteId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch alerts')
        }
        
        const data = await response.json()
        setAlerts(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setAlerts([])
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [siteId])

  return { alerts, loading, error }
}
