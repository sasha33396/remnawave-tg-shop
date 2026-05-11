import { apiRequest } from '@/api/client'

export interface FunnelStage {
  key: string
  label: string
  count: number
  pct_from_top: number
  pct_from_prev: number
}

export interface FunnelResponse {
  stages: FunnelStage[]
  period_from: string | null
  period_to: string | null
  total_revenue: number
  total_users: number
}

export interface FunnelBySourceItem {
  source: string
  starts: number
  trials: number
  payers: number
  revenue: number
}

export interface FunnelBySourceResponse {
  items: FunnelBySourceItem[]
}

export function getFunnel(period_from?: string, period_to?: string): Promise<FunnelResponse> {
  const params = new URLSearchParams()
  if (period_from) params.set('period_from', period_from)
  if (period_to) params.set('period_to', period_to)
  const qs = params.toString()
  return apiRequest<FunnelResponse>(`/admin/funnel${qs ? `?${qs}` : ''}`)
}

export function getFunnelBySource(): Promise<FunnelBySourceResponse> {
  return apiRequest<FunnelBySourceResponse>('/admin/funnel/by-source')
}
