'use client'

import { useState } from 'react'
import { Bell, Plus, TestTube, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Alert } from '@/types'

interface AlertListProps {
  alerts: Alert[]
  siteId: number | null
  loading?: boolean
}

export function AlertList({ alerts, siteId, loading }: AlertListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const getAlertStatus = (alert: Alert) => {
    if (alert.rule_json.snoozed_until) {
      const snoozeUntil = new Date(alert.rule_json.snoozed_until)
      if (snoozeUntil > new Date()) {
        return 'snoozed'
      }
    }
    
    if (!alert.enabled) return 'disabled'
    return 'enabled'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'enabled':
        return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'disabled':
        return <XCircle className="h-4 w-4 text-muted" />
      case 'snoozed':
        return <Clock className="h-4 w-4 text-yellow-400" />
      default:
        return <AlertCircle className="h-4 w-4 text-muted" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'enabled':
        return 'Enabled'
      case 'disabled':
        return 'Disabled'
      case 'snoozed':
        return 'Snoozed'
      default:
        return 'Unknown'
    }
  }

  const getPresetBadge = (rule: Alert['rule_json']) => {
    if (rule.type === 'threshold' && rule.key === 'power') return 'High Draw'
    if (rule.type === 'threshold' && rule.key === 'temp') return 'Over-temp'
    if (rule.type === 'nodata') return 'No Data'
    return 'Custom'
  }

  const testAlert = async (alertId: number) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/test`, {
        method: 'POST'
      })
      
      if (response.ok) {
        // Show success toast
        const toast = document.createElement('div')
        toast.className = 'fixed top-4 right-4 bg-accent text-bg px-4 py-2 rounded-lg shadow-lg z-50'
        toast.textContent = 'Test alert sent!'
        document.body.appendChild(toast)
        setTimeout(() => document.body.removeChild(toast), 3000)
      }
    } catch (error) {
      console.error('Failed to test alert:', error)
    }
  }

  const snoozeAlert = async (alertId: number, minutes: number) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ minutes })
      })
      
      if (response.ok) {
        // Refresh alerts or update state
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to snooze alert:', error)
    }
  }

  const createAlert = async () => {
    if (!siteId) return
    
    const presetType = (document.getElementById('preset-type') as HTMLSelectElement)?.value
    const threshold = parseFloat((document.getElementById('threshold-value') as HTMLInputElement)?.value || '0')
    
    if (!presetType || (presetType !== 'no_data' && !threshold)) {
      alert('Please select a preset type and enter a threshold value')
      return
    }
    
    setIsCreating(true)
    
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site_id: siteId,
          preset_type: presetType,
          threshold: threshold,
          device_ids: [] // Will be populated by user selection
        })
      })
      
      if (response.ok) {
        setShowCreateForm(false)
        window.location.reload() // Refresh to show new alert
      } else {
        const error = await response.json()
        alert('Failed to create alert: ' + error.error)
      }
    } catch (error) {
      alert('Failed to create alert: ' + (error as Error).message)
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="skeleton h-6 w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="skeleton h-16 w-full"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-text">Alerts</h3>
        </div>
        
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center space-x-1 px-3 py-1 bg-accent text-bg rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Create</span>
        </button>
      </div>

      {/* Create Alert Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 border border-card-border rounded-lg bg-card/50">
          <h4 className="font-medium text-text mb-3">Create Alert</h4>
          <div className="space-y-3">
            <select className="input w-full" id="preset-type">
              <option value="high_draw">High Draw (Power Threshold)</option>
              <option value="over_temp">Over-temp (Temperature)</option>
              <option value="no_data">No Data (Device Offline)</option>
            </select>
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="Threshold value"
                className="input flex-1"
                id="threshold-value"
              />
              <button 
                onClick={createAlert}
                disabled={isCreating}
                className="btn-primary disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No alerts configured</p>
            <p className="text-xs">Create alerts to monitor your devices</p>
          </div>
        ) : (
          alerts.map(alert => {
            const status = getAlertStatus(alert)
            
            return (
              <div
                key={alert.id}
                className="p-3 border border-card-border rounded-lg bg-card/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-text">{alert.name}</h4>
                    <span className="px-2 py-1 text-xs bg-card border border-card-border rounded">
                      {getPresetBadge(alert.rule_json)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(status)}
                    <span className="text-xs text-muted">{getStatusText(status)}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted">
                    {alert.rule_json.type === 'threshold' && (
                      <span>
                        {alert.rule_json.key} {alert.rule_json.op} {alert.rule_json.value}
                      </span>
                    )}
                    {alert.rule_json.type === 'nodata' && (
                      <span>No data for {alert.rule_json.duration_sec}s</span>
                    )}
                  </div>
                  
                  <div className="flex space-x-1">
                    <button
                      onClick={() => testAlert(alert.id)}
                      className="p-1 text-muted hover:text-accent transition-colors"
                      title="Test alert"
                    >
                      <TestTube className="h-4 w-4" />
                    </button>
                    
                    {status === 'enabled' && (
                      <button
                        onClick={() => snoozeAlert(alert.id, 30)}
                        className="p-1 text-muted hover:text-yellow-400 transition-colors"
                        title="Snooze for 30 minutes"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
