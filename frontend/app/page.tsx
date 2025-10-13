'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { KpiCards } from '@/components/KpiCards'
import { LiveTimeline } from '@/components/LiveTimeline'
import { DeviceFilters } from '@/components/DeviceFilters'
import { AlertList } from '@/components/AlertList'
import { DemoMode } from '@/components/DemoMode'
import { useSites } from '@/hooks/useSites'
import { useDevices } from '@/hooks/useDevices'
import { useMetrics } from '@/hooks/useMetrics'
import { useEvents } from '@/hooks/useEvents'
import { useAlerts } from '@/hooks/useAlerts'

function Dashboard() {
  const searchParams = useSearchParams()
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([])
  const [selectedMetric, setSelectedMetric] = useState('power')
  const [timeRange, setTimeRange] = useState({ hours: 24 })
  const [demoMode, setDemoMode] = useState(false)

  // Fetch data
  const { sites, loading: sitesLoading } = useSites()
  const { devices, loading: devicesLoading } = useDevices(selectedSiteId)
  const { metrics, loading: metricsLoading } = useMetrics({
    siteId: selectedSiteId,
    deviceIds: selectedDeviceIds,
    key: selectedMetric,
    hours: timeRange.hours
  })
  const { events, loading: eventsLoading } = useEvents({
    siteId: selectedSiteId,
    deviceIds: selectedDeviceIds,
    hours: timeRange.hours
  })
  const { alerts, loading: alertsLoading } = useAlerts(selectedSiteId)

  // Initialize from URL parameters
  useEffect(() => {
    const siteId = searchParams.get('siteId')
    const deviceIds = searchParams.get('deviceIds')
    const metric = searchParams.get('key')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    
    if (siteId) {
      setSelectedSiteId(parseInt(siteId))
    }
    
    if (deviceIds) {
      setSelectedDeviceIds(deviceIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)))
    }
    
    if (metric) {
      setSelectedMetric(metric)
    }
    
    if (from && to) {
      const fromTime = new Date(from)
      const toTime = new Date(to)
      const hours = Math.ceil((toTime.getTime() - fromTime.getTime()) / (1000 * 60 * 60))
      setTimeRange({ hours })
    }
  }, [searchParams])

  // Auto-select first site if no URL params
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId && !searchParams.get('siteId')) {
      setSelectedSiteId(sites[0].id)
    }
  }, [sites, selectedSiteId, searchParams])

  // Auto-select all devices when site changes (if no URL params)
  useEffect(() => {
    if (devices.length > 0 && !searchParams.get('deviceIds')) {
      setSelectedDeviceIds(devices.map(d => d.id))
    }
  }, [devices, searchParams])

  // Update URL when state changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const params = new URLSearchParams()
    if (selectedSiteId) params.set('siteId', selectedSiteId.toString())
    if (selectedDeviceIds.length > 0) params.set('deviceIds', selectedDeviceIds.join(','))
    if (selectedMetric !== 'power') params.set('key', selectedMetric)
    
    const newUrl = `${window.location.pathname}?${params.toString()}`
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl)
    }
  }, [selectedSiteId, selectedDeviceIds, selectedMetric])

  if (sitesLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header
        sites={sites}
        selectedSiteId={selectedSiteId}
        selectedDeviceIds={selectedDeviceIds}
        selectedMetric={selectedMetric}
        timeRange={timeRange}
        onSiteChange={setSelectedSiteId}
        demoMode={demoMode}
        onDemoModeToggle={setDemoMode}
      />
      
      <main className="container mx-auto px-6 py-8">
        <DemoMode enabled={demoMode} onToggle={setDemoMode} />
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left column - Charts and KPIs */}
          <div className="lg:col-span-3 space-y-8">
            <KpiCards
              siteId={selectedSiteId}
              deviceIds={selectedDeviceIds}
              loading={metricsLoading}
            />
            
            <LiveTimeline
              metrics={metrics}
              events={events}
              selectedMetric={selectedMetric}
              onMetricChange={setSelectedMetric}
              onTimeRangeChange={setTimeRange}
              loading={metricsLoading || eventsLoading}
            />
          </div>
          
          {/* Right column - Filters and Alerts */}
          <div className="space-y-6">
            <DeviceFilters
              devices={devices}
              selectedDeviceIds={selectedDeviceIds}
              onDeviceSelectionChange={setSelectedDeviceIds}
              loading={devicesLoading}
            />
            
            <AlertList
              alerts={alerts}
              siteId={selectedSiteId}
              loading={alertsLoading}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return <Dashboard />
}
