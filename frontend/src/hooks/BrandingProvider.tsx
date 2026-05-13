import { createContext, useContext } from 'react'
import { useBranding } from './useBranding'
import type { PublicBrandingResponse } from '@/api/admin/branding'

interface BrandingContextValue {
  branding: PublicBrandingResponse | undefined
  newsEnabled: boolean
  referralEnabled: boolean
  devicesEnabled: boolean
  supportLink: string | null
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: undefined,
  newsEnabled: true,
  referralEnabled: true,
  devicesEnabled: true,
  supportLink: null,
})

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const branding = useBranding()

  const value: BrandingContextValue = {
    branding,
    newsEnabled: branding?.news_enabled ?? true,
    referralEnabled: branding?.referral_enabled ?? true,
    devicesEnabled: branding?.devices_enabled ?? true,
    supportLink: branding?.support_link ?? null,
  }

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBrandingContext() {
  return useContext(BrandingContext)
}
