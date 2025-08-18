"use client"

import Script from "next/script"
import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default function AnalyticsProvider() {
  const pathname = usePathname()
  const search = useSearchParams()

  // SPA page_view on route changes
  useEffect(() => {
    if (!window.gtag || !GA_ID) return
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: pathname || "/",
      page_title: document.title,
    })
  }, [pathname, search])

  if (!GA_ID) return null

  return (
    <>
      {/* GA loader */}
      <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      {/* GA init (send_page_view disabled; we fire manually) */}
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
            send_page_view: false,
            ${process.env.NODE_ENV !== "production" ? "debug_mode: true," : ""}
            });
            window.__gaid='${process.env.NEXT_PUBLIC_GA_ID}';
        `}
      </Script>
    </>
  )
}
