'use client'

import { useState, useEffect } from 'react'
import { MetricsResponse } from '@/types'

interface UseMetricsOptions {
  siteId?: number | null
  deviceIds?: number[]
  key?: string
  hours?: number
  from?: string
  to?: string
  resolution?: 'raw' | '1m' | '15m'
}

export function useMetrics(options: UseMetricsOptions = {}) {
  const [metrics, setMetrics] = useState<MetricsResponse>({ series: [], devices: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!options.siteId && !options.deviceIds?.length) {
        setMetrics({ series: [], devices: [] })
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const params = new URLSearchParams()
        
        if (options.siteId) params.append('site_id', options.siteId.toString())
        if (options.deviceIds?.length) {
          options.deviceIds.forEach(id => params.append('device_id', id.toString()))
        }
        if (options.key) params.append('key', options.key)
        if (options.hours) {
          const to = new Date()
          const from = new Date(to.getTime() - options.hours * 60 * 60 * 1000)
          params.append('from', from.toISOString())
          params.append('to', to.toISOString())
        }
        if (options.from) params.append('from', options.from)
        if (options.to) params.append('to', options.to)
        if (options.resolution) params.append('res', options.resolution)
        
        const response = await fetch(`/api/metrics?${params.toString()}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch metrics')
        }
        
        const data = await response.json()
        setMetrics(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setMetrics({ series: [], devices: [] })
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [options.siteId, options.deviceIds, options.key, options.hours, options.from, options.to, options.resolution])

  return { metrics, loading, error }
}
