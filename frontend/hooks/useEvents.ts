'use client'

import { useState, useEffect } from 'react'
import { Event } from '@/types'

interface UseEventsOptions {
  siteId?: number | null
  deviceIds?: number[]
  from?: string
  to?: string
  hours?: number
}

export function useEvents(options: UseEventsOptions = {}) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      if (!options.siteId) {
        setEvents([])
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
        if (options.hours) {
          const to = new Date()
          const from = new Date(to.getTime() - options.hours * 60 * 60 * 1000)
          params.append('from', from.toISOString())
          params.append('to', to.toISOString())
        }
        if (options.from) params.append('from', options.from)
        if (options.to) params.append('to', options.to)
        
        const response = await fetch(`/api/events?${params.toString()}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch events')
        }
        
        const data = await response.json()
        setEvents(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [options.siteId, options.deviceIds, options.from, options.to, options.hours])

  return { events, loading, error }
}
