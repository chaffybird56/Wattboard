'use client'

import { useState } from 'react'
import { X, AlertTriangle, TrendingUp, TrendingDown, Clock, Zap } from 'lucide-react'
import { Event } from '@/types'

interface EventDetailsProps {
  event: Event | null
  onClose: () => void
  onCreateAlert?: (event: Event) => void
}

export function EventDetails({ event, onClose, onCreateAlert }: EventDetailsProps) {
  if (!event) return null

  const duration = new Date(event.end_ts).getTime() - new Date(event.start_ts).getTime()
  const durationMinutes = Math.floor(duration / (1000 * 60))
  const durationSeconds = Math.floor((duration % (1000 * 60)) / 1000)

  const getEventIcon = () => {
    switch (event.type) {
      case 'spike':
        return <TrendingUp className="h-5 w-5 text-accent" />
      case 'sag':
        return <TrendingDown className="h-5 w-5 text-yellow-400" />
      default:
        return <AlertTriangle className="h-5 w-5 text-muted" />
    }
  }

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return 'text-red-400'
    if (severity >= 3) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getSeverityLabel = (severity: number) => {
    if (severity >= 4) return 'High'
    if (severity >= 3) return 'Medium'
    return 'Low'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {getEventIcon()}
            <h3 className="text-lg font-semibold text-text">
              {event.type.charAt(0).toUpperCase() + event.type.slice(1)} Event
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-text transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Event Stats */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card/50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <Clock className="h-4 w-4 text-muted" />
                <span className="text-sm text-muted">Duration</span>
              </div>
              <p className="font-mono text-text">
                {durationMinutes}m {durationSeconds}s
              </p>
            </div>

            <div className="bg-card/50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <Zap className="h-4 w-4 text-muted" />
                <span className="text-sm text-muted">Severity</span>
              </div>
              <p className={`font-mono ${getSeverityColor(event.severity)}`}>
                {getSeverityLabel(event.severity)} ({event.severity}/5)
              </p>
            </div>
          </div>

          <div className="bg-card/50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted" />
              <span className="text-sm text-muted">Peak Value</span>
            </div>
            <p className="font-mono text-text">
              {event.meta?.peak_value?.toFixed(1) || 'N/A'}
            </p>
          </div>

          {event.meta?.zmax && (
            <div className="bg-card/50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-muted" />
                <span className="text-sm text-muted">Z-Score</span>
              </div>
              <p className="font-mono text-text">
                {event.meta.zmax.toFixed(2)}
              </p>
            </div>
          )}

          <div className="bg-card/50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm text-muted">Time Range</span>
            </div>
            <p className="text-sm text-text">
              {new Date(event.start_ts).toLocaleString()} - {new Date(event.end_ts).toLocaleString()}
            </p>
          </div>

          {event.meta?.baseline_mu && event.meta?.baseline_sigma && (
            <div className="bg-card/50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm text-muted">Baseline</span>
              </div>
              <p className="text-sm text-text">
                μ: {event.meta.baseline_mu.toFixed(1)}, σ: {event.meta.baseline_sigma.toFixed(1)}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
          {onCreateAlert && (
            <button
              onClick={() => {
                onCreateAlert(event)
                onClose()
              }}
              className="btn-primary"
            >
              Create Alert
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
