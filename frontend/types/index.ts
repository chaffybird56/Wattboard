export interface Site {
  id: number
  name: string
  tz: string
}

export interface Device {
  id: number
  site_id: number
  room_id?: number
  name: string
  type: string
  unit: string
  capabilities: string[]
  last_seen_at?: string
  is_active: boolean
}

export interface Metric {
  t: string
  device_id: number
  value: number
  device_name: string
}

export interface MetricsResponse {
  series: Metric[]
  devices: Array<{
    name: string
    type: string
    unit: string
  }>
}

export interface Event {
  id: number
  site_id: number
  start_ts: string
  end_ts: string
  type: 'spike' | 'sag' | 'unknown'
  severity: number
  device_ids: number[]
  meta?: {
    peak_value?: number
    zmax?: number
    baseline_mu?: number
    baseline_sigma?: number
  }
}

export interface Alert {
  id: number
  site_id: number
  name: string
  rule_json: {
    type: 'threshold' | 'nodata' | 'timewindow'
    device_ids: number[]
    key: string
    op?: 'gt' | 'lt' | 'eq'
    value?: number
    duration_sec?: number
    schedule?: {
      start: string
      end: string
      tz: string
    }
    action: {
      email?: string[]
      webhook?: string[]
    }
    snoozed_until?: string
  }
  enabled: boolean
  last_fired_at?: string
  created_at: string
}

export interface AlertEvent {
  id: number
  alert_id: number
  ts: string
  payload: any
}

export interface KpiData {
  current_power: number
  daily_energy: number
  peak_today: number
  cost_estimate: number
}
