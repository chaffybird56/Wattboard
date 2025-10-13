'use client'

import { useState } from 'react'
import { Filter, Wifi, WifiOff, Clock } from 'lucide-react'
import { Device } from '@/types'

interface DeviceFiltersProps {
  devices: Device[]
  selectedDeviceIds: number[]
  onDeviceSelectionChange: (deviceIds: number[]) => void
  loading?: boolean
}

export function DeviceFilters({
  devices,
  selectedDeviceIds,
  onDeviceSelectionChange,
  loading
}: DeviceFiltersProps) {
  const [filterType, setFilterType] = useState<string>('all')

  const getDeviceStatus = (device: Device) => {
    if (!device.last_seen_at) return 'unknown'
    const lastSeen = new Date(device.last_seen_at)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60)
    
    if (diffMinutes < 1) return 'online'
    if (diffMinutes < 5) return 'warning'
    return 'offline'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="h-4 w-4 text-green-400" />
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-400" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-400" />
      default:
        return <WifiOff className="h-4 w-4 text-muted" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online'
      case 'warning':
        return 'Delayed'
      case 'offline':
        return 'Offline'
      default:
        return 'Unknown'
    }
  }

  const filteredDevices = devices.filter(device => {
    if (filterType === 'all') return true
    return device.type === filterType
  })

  const deviceTypes = Array.from(new Set(devices.map(d => d.type)))

  const toggleDevice = (deviceId: number) => {
    if (selectedDeviceIds.includes(deviceId)) {
      onDeviceSelectionChange(selectedDeviceIds.filter(id => id !== deviceId))
    } else {
      onDeviceSelectionChange([...selectedDeviceIds, deviceId])
    }
  }

  const selectAll = () => {
    onDeviceSelectionChange(filteredDevices.map(d => d.id))
  }

  const selectNone = () => {
    onDeviceSelectionChange([])
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="skeleton h-6 w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-12 w-full"></div>
          ))}
        </div>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-text">Devices</h3>
        </div>
        
        <div className="text-center py-8 text-muted">
          <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">No devices found</p>
          <p className="text-sm">Add a device or enable demo mode to see data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-text">Devices</h3>
        </div>
        
        <div className="flex space-x-1">
          <button
            onClick={selectAll}
            className="px-2 py-1 text-xs bg-card border border-card-border rounded hover:border-accent/50 transition-colors"
          >
            All
          </button>
          <button
            onClick={selectNone}
            className="px-2 py-1 text-xs bg-card border border-card-border rounded hover:border-accent/50 transition-colors"
          >
            None
          </button>
        </div>
      </div>

      {/* Type filter */}
      {deviceTypes.length > 1 && (
        <div className="mb-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input w-full text-sm"
          >
            <option value="all">All Types</option>
            {deviceTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Device list */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredDevices.map(device => {
          const status = getDeviceStatus(device)
          const isSelected = selectedDeviceIds.includes(device.id)
          
          return (
            <div
              key={device.id}
              onClick={() => toggleDevice(device.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:translate-y-[-1px] ${
                isSelected
                  ? 'border-accent bg-accent/10'
                  : 'border-card-border bg-card hover:border-accent/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-text">{device.name}</h4>
                    {getStatusIcon(status)}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted">
                    <span>{device.type} • {device.unit}</span>
                    <span className="text-xs">{getStatusText(status)}</span>
                  </div>
                </div>
                
                <div className={`w-4 h-4 rounded border-2 ${
                  isSelected
                    ? 'border-accent bg-accent'
                    : 'border-card-border'
                }`}>
                  {isSelected && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-bg rounded-sm"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredDevices.length === 0 && (
        <div className="text-center py-4 text-muted">
          <p className="text-sm">No devices of type "{filterType}" found</p>
        </div>
      )}
    </div>
  )
}
