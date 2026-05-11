import { apiRequest } from '@/api/client'

export interface InsightsOverview {
  total_users: number
  users_with_subscription: number
  active_users: number
  paid_users: number
  no_purchase_users: number
  total_revenue: number
  total_payments: number
  avg_check: number
  conversion_to_paid_pct: number
  trial_users: number
  paying_share_pct: number
}

export interface TimeseriesPoint {
  date: string
  new_users: number
  new_subscriptions: number
  revenue: number
  payments_count: number
}

export interface InsightsTimeseriesResponse {
  period_from: string
  period_to: string
  points: TimeseriesPoint[]
}

export function getInsightsOverview(): Promise<InsightsOverview> {
  return apiRequest<InsightsOverview>('/admin/insights/overview')
}

export function getInsightsTimeseries(days = 90, period_from?: string, period_to?: string): Promise<InsightsTimeseriesResponse> {
  const params = new URLSearchParams()
  if (period_from) params.set('period_from', period_from)
  if (period_to) params.set('period_to', period_to)
  if (!period_from && !period_to) params.set('days', String(days))
  return apiRequest<InsightsTimeseriesResponse>(`/admin/insights/timeseries?${params.toString()}`)
}
