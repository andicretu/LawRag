// src/types/global.d.ts
declare global {
  interface Gtag {
    (command: "js", date: Date): void
    (command: "config", targetId: string, config?: Record<string, unknown>): void
    (command: "event", action: string, params?: Record<string, unknown>): void
    (command: "consent", mode: "default" | "update", params: Record<string, string>): void
  }

  interface Window {
    gtag: Gtag
    __gaid?: string
  }
}

export {}
