'use client'

import { TrendingUp, TrendingDown, Zap, DollarSign } from 'lucide-react'

interface KpiCardsProps {
  siteId: number | null
  deviceIds: number[]
  loading?: boolean
}

export function KpiCards({ siteId, deviceIds, loading }: KpiCardsProps) {
  // Mock data for now - will be replaced with real API calls
  const kpiData = {
    current_power: 1247.5,
    daily_energy: 28.4,
    peak_today: 1543.2,
    cost_estimate: 4.26
  }

  const kpis = [
    {
      title: 'Current Power',
      value: kpiData.current_power,
      unit: 'W',
      icon: Zap,
      trend: { value: 5.2, direction: 'up' as const },
      color: 'text-accent'
    },
    {
      title: '24h Energy',
      value: kpiData.daily_energy,
      unit: 'kWh',
      icon: TrendingUp,
      trend: { value: 2.1, direction: 'up' as const },
      color: 'text-accent-2'
    },
    {
      title: 'Peak Today',
      value: kpiData.peak_today,
      unit: 'W',
      icon: TrendingUp,
      trend: { value: 8.7, direction: 'down' as const },
      color: 'text-yellow-400'
    },
    {
      title: 'Cost Est.',
      value: kpiData.cost_estimate,
      unit: '$',
      icon: DollarSign,
      trend: { value: 1.3, direction: 'up' as const },
      color: 'text-green-400'
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="kpi-card">
            <div className="skeleton h-4 w-24 mb-2"></div>
            <div className="skeleton h-8 w-16 mb-2"></div>
            <div className="skeleton h-3 w-12"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        const TrendIcon = kpi.trend.direction === 'up' ? TrendingUp : TrendingDown
        
        return (
          <div key={index} className="kpi-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Icon className={`h-5 w-5 ${kpi.color}`} />
                <h3 className="text-sm font-medium text-muted">{kpi.title}</h3>
              </div>
              <div className={`flex items-center space-x-1 text-xs ${
                kpi.trend.direction === 'up' ? 'text-green-400' : 'text-red-400'
              }`}>
                <TrendIcon className="h-3 w-3" />
                <span>{kpi.trend.value}%</span>
              </div>
            </div>
            
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-mono font-semibold text-text">
                {typeof kpi.value === 'number' && kpi.value % 1 !== 0 
                  ? kpi.value.toFixed(1)
                  : kpi.value.toString()
                }
              </span>
              <span className="text-sm text-muted">{kpi.unit}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
