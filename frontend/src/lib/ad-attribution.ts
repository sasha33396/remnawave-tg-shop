const AD_PARAM_KEY = 'ad_attribution_param'
const AD_PARAM_PATTERN = /^[A-Za-z0-9_-]{2,64}$/

export function normalizeAdParam(value: string | null | undefined): string | null {
  const clean = (value ?? '').trim()
  if (!AD_PARAM_PATTERN.test(clean)) return null
  return clean
}

export function captureAdParamFromUrl(search: string): string | null {
  const params = new URLSearchParams(search)
  const value =
    normalizeAdParam(params.get('ad')) ??
    normalizeAdParam(params.get('utm_campaign')) ??
    normalizeAdParam(params.get('utm_source'))

  if (!value) return null
  localStorage.setItem(AD_PARAM_KEY, value)
  return value
}

export function getStoredAdParam(): string | null {
  return normalizeAdParam(localStorage.getItem(AD_PARAM_KEY))
}
