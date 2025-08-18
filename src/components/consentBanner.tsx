"use client"

import { useEffect, useState } from "react"

const KEY = "stielegi.consent.v1"

export default function ConsentBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(KEY)
    if (!saved) setOpen(true)
  }, [])

  function grantAnalytics() {
    try {
      window.gtag?.("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted",
      })
      localStorage.setItem(KEY, JSON.stringify({ analytics: true, ts: Date.now() }))
    } catch {}
    setOpen(false)
  }

  function declineAll() {
    try {
      window.gtag?.("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      })
      localStorage.setItem(KEY, JSON.stringify({ analytics: false, ts: Date.now() }))
    } catch {}
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <p className="text-sm text-slate-700">
        Folosim cookie-uri analitice (Google Analytics) pentru a măsura traficul. Poți accepta sau refuza.
      </p>
      <div className="mt-3 flex gap-2 justify-end">
        <button
          onClick={declineAll}
          className="px-3 py-1.5 text-sm border rounded-lg"
        >
          Refuz
        </button>
        <button
          onClick={grantAnalytics}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
