'use client'

import { useState, useEffect } from 'react'
import { Site } from '@/types'

export function useSites() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/sites')
        
        if (!response.ok) {
          throw new Error('Failed to fetch sites')
        }
        
        const data = await response.json()
        setSites(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setSites([])
      } finally {
        setLoading(false)
      }
    }

    fetchSites()
  }, [])

  return { sites, loading, error }
}
