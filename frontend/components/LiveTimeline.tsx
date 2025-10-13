'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { Activity, Clock, Download } from 'lucide-react'
import { Metric, Event } from '@/types'
import { EventDetails } from './EventDetails'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
)

interface LiveTimelineProps {
  metrics: Metric[]
  events: Event[]
  selectedMetric: string
  onMetricChange: (metric: string) => void
  onTimeRangeChange: (range: { hours: number }) => void
  loading?: boolean
}

export function LiveTimeline({
  metrics,
  events,
  selectedMetric,
  onMetricChange,
  onTimeRangeChange,
  loading
}: LiveTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [timeRange, setTimeRange] = useState(24)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const metricOptions = [
    { value: 'power', label: 'Power (W)', color: '#82D9FF' },
    { value: 'voltage', label: 'Voltage (V)', color: '#A6E3B8' },
    { value: 'current', label: 'Current (A)', color: '#FFB347' },
    { value: 'temp', label: 'Temperature (°C)', color: '#FF6B6B' },
    { value: 'aqi', label: 'Air Quality', color: '#9B59B6' }
  ]

  const timeRangeOptions = [
    { value: 1, label: '1h' },
    { value: 6, label: '6h' },
    { value: 24, label: '24h' },
    { value: 168, label: '7d' }
  ]

  // Process metrics data for Chart.js
  const processChartData = () => {
    if (!metrics.length) return { datasets: [] }

    // Group metrics by device
    const deviceGroups = metrics.reduce((acc, metric) => {
      if (!acc[metric.device_id]) {
        acc[metric.device_id] = []
      }
      acc[metric.device_id].push({
        x: new Date(metric.t),
        y: metric.value,
        device_name: metric.device_name
      })
      return acc
    }, {} as Record<number, any[]>)

    // Create datasets for each device
    const datasets = Object.entries(deviceGroups).map(([deviceId, data], index) => {
      const colors = ['#82D9FF', '#A6E3B8', '#FFB347', '#FF6B6B', '#9B59B6']
      return {
        label: data[0]?.device_name || `Device ${deviceId}`,
        data: data.sort((a, b) => a.x.getTime() - b.x.getTime()),
        borderColor: colors[index % colors.length],
        backgroundColor: `${colors[index % colors.length]}20`,
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 6
      }
    })

    return { datasets }
  }

  // Process events for background ribbons
  const processEventRibbons = () => {
    if (!events.length) return []

    return events.map(event => {
      const color = event.type === 'spike' ? 'rgba(130,217,255,0.20)' : 'rgba(255,196,0,0.18)'
      const unit = metricOptions.find(m => m.value === selectedMetric)?.label.split(' ')[1] || ''
      const peakValue = event.meta?.peak_value?.toFixed(1) || 'N/A'
      
      return {
        type: 'box' as const,
        xMin: new Date(event.start_ts),
        xMax: new Date(event.end_ts),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        yMin: 'min',
        yMax: 'max',
        label: {
          content: `${event.type.toUpperCase()}: ${peakValue}${unit}`,
          enabled: true,
          position: 'top' as const
        }
      }
    })
  }

  const chartData = processChartData()
  const eventRibbons = processEventRibbons()

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#E6E9EF',
          font: {
            family: 'Inter'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(11, 14, 20, 0.95)',
        titleColor: '#E6E9EF',
        bodyColor: '#E6E9EF',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y
            const unit = metricOptions.find(m => m.value === selectedMetric)?.label.split(' ')[1] || ''
            return `${context.dataset.label}: ${value.toFixed(1)} ${unit}`
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: {
            hour: 'HH:mm',
            day: 'MMM dd'
          }
        },
        ticks: {
          color: '#9AA3AF',
          font: {
            family: 'Inter'
          }
        },
        grid: {
          color: 'rgba(255,255,255,0.05)'
        }
      },
      y: {
        ticks: {
          color: '#9AA3AF',
          font: {
            family: 'Inter'
          }
        },
        grid: {
          color: 'rgba(255,255,255,0.05)'
        }
      }
    },
    elements: {
      point: {
        hoverBackgroundColor: '#82D9FF'
      }
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="skeleton h-6 w-48 mb-4"></div>
        <div className="skeleton h-80 w-full"></div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Activity className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-text">Live Timeline</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Metric selector */}
          <select
            value={selectedMetric}
            onChange={(e) => onMetricChange(e.target.value)}
            className="input"
          >
            {metricOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          {/* Time range selector */}
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted" />
            <div className="flex space-x-1">
              {timeRangeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTimeRange(option.value)
                    onTimeRangeChange({ hours: option.value })
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timeRange === option.value
                      ? 'bg-accent text-bg'
                      : 'bg-card border border-card-border text-text hover:border-accent/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-80">
        {chartData.datasets.length > 0 ? (
          <Line
            ref={canvasRef}
            data={chartData}
            options={chartOptions}
            plugins={[{
              id: 'eventRibbons',
              afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx
                const chartArea = chart.chartArea
                
                eventRibbons.forEach((ribbon, index) => {
                  const xScale = chart.scales.x
                  const xMin = xScale.getPixelForValue(ribbon.xMin.getTime())
                  const xMax = xScale.getPixelForValue(ribbon.xMax.getTime())
                  
                  ctx.save()
                  ctx.fillStyle = ribbon.backgroundColor
                  ctx.fillRect(xMin, chartArea.top, xMax - xMin, chartArea.bottom - chartArea.top)
                  ctx.restore()
                  
                  // Make ribbons clickable
                  chart.canvas.style.cursor = 'pointer'
                })
              }
            }, {
              id: 'eventClickHandler',
              beforeEvent: (chart, event) => {
                if (event.type === 'click') {
                  const canvasPosition = ChartJS.helpers.getRelativePosition(event.event, chart)
                  const xScale = chart.scales.x
                  const clickedTime = xScale.getValueForPixel(canvasPosition.x)
                  
                  // Find clicked event
                  const clickedEvent = events.find(event => {
                    const startTime = new Date(event.start_ts).getTime()
                    const endTime = new Date(event.end_ts).getTime()
                    return clickedTime >= startTime && clickedTime <= endTime
                  })
                  
                  if (clickedEvent) {
                    setSelectedEvent(clickedEvent)
                  }
                }
              }
            }]}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No data available</p>
              <p className="text-sm">Try selecting different devices or enabling demo mode</p>
            </div>
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      <EventDetails
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onCreateAlert={(event) => {
          // Handle creating alert from event
          console.log('Create alert from event:', event)
        }}
      />
    </div>
  )
}
