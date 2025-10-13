'use client'

import { useState, useEffect } from 'react'
import { Device } from '@/types'

interface UseDevicesOptions {
  siteId?: number | null
  type?: string
  active?: boolean
}

export function useDevices(options: UseDevicesOptions = {}) {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDevices = async () => {
      if (!options.siteId) {
        setDevices([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const params = new URLSearchParams()
        
        if (options.siteId) params.append('site_id', options.siteId.toString())
        if (options.type) params.append('type', options.type)
        if (options.active !== undefined) params.append('active', options.active.toString())
        
        const response = await fetch(`/api/devices?${params.toString()}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch devices')
        }
        
        const data = await response.json()
        setDevices(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setDevices([])
      } finally {
        setLoading(false)
      }
    }

    fetchDevices()
  }, [options.siteId, options.type, options.active])

  return { devices, loading, error }
}
