import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth/AuthProvider"
import AnalyticsProvider from "@/components/analiticsProvider"
import ConsentBanner from "@/components/consentBanner"
import { Suspense } from "react"



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "StieLegi.ro",
  description: "Asistent virtual pentru intrebari legale",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <head>
        {/* Consent Mode v2 defaults (run early, before GA loads) */}
        <script
          id="consent-defaults"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                analytics_storage: 'denied',
                functionality_storage: 'granted',
                security_storage: 'granted'
              });
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* GA4 loader + SPA pageviews */}
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
          <AuthProvider>{children}</AuthProvider>
        <ConsentBanner />
      </body>
    </html>
  )
}
