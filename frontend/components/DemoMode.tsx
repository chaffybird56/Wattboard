'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, Download } from 'lucide-react'

interface DemoModeProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function DemoMode({ enabled, onToggle }: DemoModeProps) {
  const [isFirstLoad, setIsFirstLoad] = useState(true)

  useEffect(() => {
    // Check if this is the first time the user is visiting
    const hasVisited = localStorage.getItem('wattboard-visited')
    if (!hasVisited) {
      localStorage.setItem('wattboard-visited', 'true')
      setIsFirstLoad(true)
    } else {
      setIsFirstLoad(false)
    }
  }, [])

  const toggleDemoMode = async () => {
    try {
      const response = await fetch('/api/demo/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !enabled })
      })
      
      if (response.ok) {
        onToggle(!enabled)
      }
    } catch (error) {
      console.error('Failed to toggle demo mode:', error)
    }
  }

  const downloadSampleCSV = () => {
    // Create a sample CSV content
    const csvContent = `timestamp,device_name,key,value,unit
2025-01-15T00:00:00Z,Main Meter,power,1200.5,W
2025-01-15T00:01:00Z,Main Meter,power,1180.2,W
2025-01-15T00:02:00Z,Main Meter,power,1225.8,W
2025-01-15T00:03:00Z,Main Meter,power,1195.3,W
2025-01-15T00:04:00Z,Main Meter,power,1210.7,W`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wattboard_sample.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isFirstLoad && !enabled) {
    return null
  }

  return (
    <div className={`mb-6 p-4 rounded-lg border ${
      enabled 
        ? 'bg-accent/10 border-accent/30' 
        : 'bg-card border-card-border'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {enabled ? (
            <Pause className="h-5 w-5 text-accent" />
          ) : (
            <Play className="h-5 w-5 text-muted" />
          )}
          
          <div>
            <h3 className="font-medium text-text">
              {enabled ? 'Demo Mode Active' : 'Try Demo Mode'}
            </h3>
            <p className="text-sm text-muted">
              {enabled 
                ? 'Viewing realistic simulated data from multiple devices'
                : 'See realistic data in seconds with our built-in simulator'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {!enabled && (
            <button
              onClick={downloadSampleCSV}
              className="flex items-center space-x-2 px-3 py-2 bg-card border border-card-border rounded-lg hover:border-accent/50 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="text-sm">Sample CSV</span>
            </button>
          )}
          
          <button
            onClick={toggleDemoMode}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              enabled
                ? 'bg-accent text-bg hover:bg-accent/90'
                : 'bg-card border border-card-border text-text hover:border-accent/50'
            }`}
          >
            {enabled ? 'Stop Demo' : 'Start Demo'}
          </button>
        </div>
      </div>
      
      {isFirstLoad && !enabled && (
        <div className="mt-3 pt-3 border-t border-card-border">
          <p className="text-sm text-muted">
            Demo mode simulates realistic energy data from multiple devices. 
            You can also import your own CSV data using the upload feature.
          </p>
        </div>
      )}
    </div>
  )
}
