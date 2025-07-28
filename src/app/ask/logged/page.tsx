"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"

export default function LoggedRedirectFallback() {
  const { isAuthenticated, isLoading, user } = useAuth0()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.sub) {
      router.replace(`/ask/logged/${user.sub}`)
    }
  }, [isLoading, isAuthenticated, user, router])

  return <p className="p-6 text-sm text-slate-600">Redirecting to your session...</p>
}
