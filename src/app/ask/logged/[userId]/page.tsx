// **src/app/ask/logged/page.tsx**
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth0, LogoutOptions } from "@auth0/auth0-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ChatEntry {
  question: string
  answer: string
  links: { title: string; url: string; text: string }[]
}

type Props = {
  params: { userId: string }
};

export default function LegalQuestionPageLogged( {
  params,
}: Props) {
  const {userId} = params;  
  
  // Extract userId from params
  // This is the userId from the URL, e.g. /ask/logged/
  const router = useRouter()
  const pathname = usePathname()
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    logout,
    user,
    getAccessTokenSilently,
  } = useAuth0()

  // Chat history state
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([])
  const [question, setQuestion] = useState<string>("")
  const [status, setStatus] = useState<string>("Pregatit")
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // On auth, sync and fetch previous chats
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      ;(async () => {
        try {
          const token = await getAccessTokenSilently()
          // sync user
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
          // fetch chat history
          const res = await fetch(`/api/chats?userId=${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data: ChatEntry[] = await res.json()
            setChatHistory(data)
          }
        } catch (err) {
          console.error('❌ Failed to fetch chat history:', err)
        }
      })()
      // Redirect if not already on logged page
      if (pathname !== `/ask/logged/${userId}`) {
        router.replace(`/ask/logged/${userId}`)
      }
    }
  }, [authLoading, isAuthenticated, getAccessTokenSilently, router, pathname, userId])

  const endOfPageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (endOfPageRef.current) {
      endOfPageRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatHistory])

  const handleSubmit = async () => {
    if (!question.trim()) return

    setIsLoading(true)
    setStatus("Ne asiguram ca am inteles intrebarea")

    try {
      // Clarify
      const token = await getAccessTokenSilently()
      const clarifyRes = await fetch(`/api/clarify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // ✅ Pass token properly
        },
        body: JSON.stringify({ question }),
      })
      const { clarifiedQuestion } = await clarifyRes.json()

      setStatus('Cautam documentele relevante')
      // Search
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clarifiedQuestion }),
      })
      const { sources } = await searchRes.json()

      setStatus('Asteptam raspunsul LLM-ului')
      // Answer
      const answerRes = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clarifiedQuestion, chunks: sources }),
      })
      const { answer: aiAnswer } = await answerRes.json()

      // Build entry
      const newEntry: ChatEntry = { question, answer: aiAnswer, links: sources || [] }
      setChatHistory(prev => [...prev, newEntry])
      setStatus('Raspunsul final este pregatit.')

      // Persist to backend
      await fetch(`/api/chats?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newEntry),
      })

      // Clear input
      setQuestion("")
    } catch (error) {
      setStatus(`A aparut o eroare: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
  <div className="min-h-screen bg-slate-50">
    {/* Header */}
    <header className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">StieLegi.ro</h1>
      <div className="flex items-center gap-4">
        {authLoading ? (
          <span className="text-sm text-slate-500">Se încarcă...</span>
        ) : isAuthenticated && user ? (
          <>
            <Avatar>
              <AvatarImage src={user.picture} alt={user.name} />
              <AvatarFallback>{user.name?.[0]}</AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              onClick={() =>
                logout({ logoutParams: { returnTo: `${window.location.origin}/ask` } } as LogoutOptions)
              }
            >
              Log out
            </Button>
          </>
        ) : (
          <Button
            onClick={() =>
              loginWithRedirect({
                appState: { returnTo: `/ask/logged/${user?.sub}` },
                authorizationParams: {
                  redirect_uri: `${window.location.origin}/ask/logged/${user?.sub}`,
                },
              })
            }
          >
            Log in / Register
          </Button>
        )}
      </div>
    </header>

    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 text-base text-slate-800">
      {/* Render chat history */}
      {chatHistory.map((entry, i) => (
        <div key={i} className="space-y-4">
          <Card className="border-0 shadow-sm bg-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-900">Întrebare</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{entry.question}</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-sm bg-white h-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">Raspuns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap leading-relaxed min-h-[60px] p-4 bg-slate-50 rounded-lg">
                    {entry.answer}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-sm bg-white h-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">Surse relevante</CardTitle>
                </CardHeader>
                <CardContent>
                  {entry.links.map((link, j) => (
                    <div key={j} className="flex flex-col space-y-2 p-3 bg-slate-50 rounded-lg">
                      <div className="font-medium text-sm text-slate-700">{link.title}</div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 text-sm">
                        Deschide document
                      </a>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ))}

      {/* Input for new question */}
      <div ref={endOfPageRef}>
        <Card className="border-0 shadow-sm bg-white mt-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Cu ce vă putem ajuta?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Adaugă o întrebare..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[100px] resize-none text-base"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{status}</span>
              <Button onClick={handleSubmit} disabled={isLoading || !question.trim()}>
                {isLoading ? "Procesăm..." : "Trimite"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
  )
}
