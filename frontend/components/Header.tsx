'use client'

import { useState } from 'react'
import { ChevronDown, Zap, Download, Share2 } from 'lucide-react'
import { Site } from '@/types'
import { CsvImport } from './CsvImport'

interface HeaderProps {
  sites: Site[]
  selectedSiteId: number | null
  selectedDeviceIds: number[]
  selectedMetric: string
  timeRange: { hours: number }
  onSiteChange: (siteId: number) => void
  demoMode: boolean
  onDemoModeToggle: (enabled: boolean) => void
}

export function Header({ sites, selectedSiteId, selectedDeviceIds, selectedMetric, timeRange, onSiteChange, demoMode, onDemoModeToggle }: HeaderProps) {
  const [showSiteDropdown, setShowSiteDropdown] = useState(false)
  const [showExportDropdown, setShowExportDropdown] = useState(false)

  const selectedSite = sites.find(s => s.id === selectedSiteId)

  const handleExport = (format: 'png' | 'csv') => {
    if (format === 'png') {
      // Export chart as PNG
      const canvas = document.querySelector('canvas')
      if (canvas) {
        const link = document.createElement('a')
        link.download = `wattboard_${selectedSite?.name}_${new Date().toISOString().split('T')[0]}.png`
        link.href = canvas.toDataURL('image/png', 2)
        link.click()
      }
    } else if (format === 'csv') {
      // Export data as CSV
      const url = `/api/metrics?site_id=${selectedSiteId}&format=csv`
      window.open(url, '_blank')
    }
    setShowExportDropdown(false)
  }

  const copyPermalink = () => {
    const to = new Date()
    const from = new Date(to.getTime() - timeRange.hours * 60 * 60 * 1000)
    
    const params = new URLSearchParams({
      siteId: selectedSiteId?.toString() || '',
      deviceIds: selectedDeviceIds.join(','),
      key: selectedMetric,
      from: from.toISOString(),
      to: to.toISOString()
    })
    
    const permalink = `${window.location.origin}?${params.toString()}`
    navigator.clipboard.writeText(permalink)
    setShowExportDropdown(false)
    
    // Show toast notification
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 bg-accent text-bg px-4 py-2 rounded-lg shadow-lg z-50'
    toast.textContent = 'Link copied to clipboard!'
    document.body.appendChild(toast)
    setTimeout(() => document.body.removeChild(toast), 3000)
  }

  return (
    <header className="border-b border-card-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-accent" />
              <h1 className="text-xl font-bold text-text">Wattboard</h1>
            </div>
            
            {/* Site Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowSiteDropdown(!showSiteDropdown)}
                className="flex items-center space-x-2 px-3 py-2 bg-card border border-card-border rounded-lg hover:border-accent/50 transition-colors"
              >
                <span className="text-text font-medium">
                  {selectedSite?.name || 'Select Site'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted" />
              </button>
              
              {showSiteDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-card-border rounded-lg shadow-card z-50">
                  {sites.map(site => (
                    <button
                      key={site.id}
                      onClick={() => {
                        onSiteChange(site.id)
                        setShowSiteDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left text-text hover:bg-card-border transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      {site.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Demo Mode Toggle and Import */}
          <div className="flex items-center space-x-4">
            <CsvImport siteId={selectedSiteId} />
            
            <button
              onClick={() => onDemoModeToggle(!demoMode)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                demoMode
                  ? 'bg-accent text-bg'
                  : 'bg-card border border-card-border text-text hover:border-accent/50'
              }`}
            >
              {demoMode ? 'Demo Mode' : 'Live Mode'}
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="flex items-center space-x-2 px-3 py-2 bg-card border border-card-border rounded-lg hover:border-accent/50 transition-colors"
              >
                <Download className="h-4 w-4 text-muted" />
                <span className="text-text font-medium">Export</span>
                <ChevronDown className="h-4 w-4 text-muted" />
              </button>
              
              {showExportDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-card-border rounded-lg shadow-card z-50">
                  <button
                    onClick={() => handleExport('png')}
                    className="w-full px-4 py-2 text-left text-text hover:bg-card-border transition-colors rounded-t-lg"
                  >
                    Export as PNG
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-left text-text hover:bg-card-border transition-colors"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={copyPermalink}
                    className="w-full px-4 py-2 text-left text-text hover:bg-card-border transition-colors rounded-b-lg"
                  >
                    <Share2 className="h-4 w-4 inline mr-2" />
                    Copy Permalink
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
