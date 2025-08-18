"use client"
import { useEffect } from "react"

export default function DevConsent() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    // grant analytics so GA works without clicking the banner
    window.gtag?.("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    })
  }, [])
  return null
}
