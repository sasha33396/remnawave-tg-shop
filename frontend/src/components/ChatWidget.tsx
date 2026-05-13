import { useEffect } from 'react'
import { useBrandingContext } from '@/hooks/BrandingProvider'

const SCRIPT_ID = 'chat-widget-script'

declare global {
  interface Window {
    Tawk_API?: Record<string, unknown>
    Tawk_LoadStart?: Date
    $crisp?: unknown[]
    CRISP_WEBSITE_ID?: string
  }
}

function injectTawk(widgetId: string) {
  // widgetId expected as "propertyId/widgetId"
  if (!widgetId.includes('/')) {
    console.warn('[ChatWidget] tawk widget id must be in "propertyId/widgetId" format')
    return
  }
  window.Tawk_API = window.Tawk_API || {}
  window.Tawk_LoadStart = new Date()
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://embed.tawk.to/${widgetId}`
  script.charset = 'UTF-8'
  script.setAttribute('crossorigin', '*')
  document.body.appendChild(script)
}

function injectCrisp(websiteId: string) {
  window.$crisp = []
  window.CRISP_WEBSITE_ID = websiteId
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = 'https://client.crisp.chat/l.js'
  document.head.appendChild(script)
}

export function ChatWidget() {
  const { branding } = useBrandingContext()
  const provider = branding?.chat_widget_provider ?? null
  const widgetId = branding?.chat_widget_id ?? null

  useEffect(() => {
    if (!provider || !widgetId) return
    if (document.getElementById(SCRIPT_ID)) return

    if (provider === 'tawk') {
      injectTawk(widgetId)
    } else if (provider === 'crisp') {
      injectCrisp(widgetId)
    } else {
      console.warn(`[ChatWidget] unsupported provider: ${provider}`)
    }
  }, [provider, widgetId])

  return null
}
