import { apiRequest } from '@/api/client'

export interface AdminAdCampaignStats {
  starts: number
  trials: number
  payers: number
  revenue: number
}

export interface AdminAdCampaignItem {
  ad_campaign_id: number
  source: string
  start_param: string
  cost: number
  is_active: boolean
  created_at: string | null
  stats: AdminAdCampaignStats
}

export interface AdminAdsListResponse {
  items: AdminAdCampaignItem[]
  total: number
  page: number
  page_size: number
}

export interface AdminAdsOverview {
  total_cost: number
  total_revenue: number
  active_campaigns: number
  total_campaigns: number
}

export interface AdCampaignCreateRequest {
  source: string
  start_param: string
  cost: number
}

export interface AdCampaignUpdateRequest {
  is_active?: boolean
  cost?: number
  source?: string
}

export function getAdsOverview(): Promise<AdminAdsOverview> {
  return apiRequest<AdminAdsOverview>('/admin/ads/overview')
}

export function getAds(page = 0, page_size = 20, only_active = false): Promise<AdminAdsListResponse> {
  return apiRequest<AdminAdsListResponse>(
    `/admin/ads?page=${page}&page_size=${page_size}&only_active=${only_active}`,
  )
}

export function createAd(data: AdCampaignCreateRequest): Promise<AdminAdCampaignItem> {
  return apiRequest<AdminAdCampaignItem>('/admin/ads', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAd(id: number, data: AdCampaignUpdateRequest): Promise<AdminAdCampaignItem> {
  return apiRequest<AdminAdCampaignItem>(`/admin/ads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteAd(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiRequest<{ deleted: boolean; id: number }>(`/admin/ads/${id}`, {
    method: 'DELETE',
  })
}
