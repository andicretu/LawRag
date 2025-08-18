export function gaEvent(action: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !window.gtag) return
  window.gtag("event", action, params)
}
