"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter, usePathname } from "next/navigation"
import { useAuth0, LogoutOptions } from "@auth0/auth0-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ChatEntry {
  question: string
  answer: string
  links: { title: string; url: string; text: string }[]
}

export default function LegalQuestionPageLogged() {
  const params = useParams()
  const userId = params?.userId as string

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

  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([])
  const [question, setQuestion] = useState<string>("")
  const [status, setStatus] = useState<string>("Pregatit")
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const endOfPageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      ;(async () => {
        try {
          const token = await getAccessTokenSilently()
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
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
      if (pathname !== `/ask/logged/${userId}`) {
        router.replace(`/ask/logged/${userId}`)
      }
    }
  }, [authLoading, isAuthenticated, getAccessTokenSilently, router, pathname, userId])

  useEffect(() => {
    if (endOfPageRef.current) {
      endOfPageRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatHistory])

  const handleSubmit = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setStatus("Ne asiguram ca am inteles intrebarea");

    try {
      const token = await getAccessTokenSilently();

      // 🔍 Clarify step
      const clarifyRes = await fetch(`/api/clarify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });

      if (!clarifyRes.ok) {
        const errorText = await clarifyRes.text();
        throw new Error(`Eroare clarificare: ${clarifyRes.status} – ${errorText}`);
      }

      const { clarifiedQuestion } = await clarifyRes.json();

      // 🔍 Search step
      setStatus('Cautam documentele relevante');

      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clarifiedQuestion }),
      });

      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        throw new Error(`Eroare cautare: ${searchRes.status} – ${errorText}`);
      }

      const { sources } = await searchRes.json();

      // 🔍 Answer step
      setStatus('Pregatim raspunsul');

      const answerRes = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clarifiedQuestion, chunks: sources }),
      });

      if (!answerRes.ok) {
        const errorText = await answerRes.text();
        throw new Error(`Eroare raspuns: ${answerRes.status} – ${errorText}`);
      }

      const { answer: aiAnswer } = await answerRes.json();

      // 🧠 Save new entry
      const newEntry: ChatEntry = { question, answer: aiAnswer, links: sources || [] };
      setChatHistory(prev => [...prev, newEntry]);
      setStatus('Raspunsul final este pregatit.');

      // 💾 Persist to backend
      await fetch(`/api/chats?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newEntry),
      });

      setQuestion("");
    } catch (error) {
      setStatus(`A aparut o eroare: ${error}`);
      console.error("❌ handleSubmit error:", error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50">
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
                onClick={() => logout({ logoutParams: { returnTo: `${window.location.origin}/ask` } } as LogoutOptions)}
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
        {chatHistory.map((entry, i) => (
          <div key={i} className="space-y-4">
            <Card className="border-0 shadow-sm bg-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Întrebare</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{entry.question}</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
               <Card className="border-0 shadow-sm bg-white h-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">Raspuns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm leading-relaxed min-h-[60px] p-4 bg-slate-50 rounded-lg prose prose-sm max-w-none">
                    {entry.answer ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children }) => (
                            <a
                              href={href || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {entry.answer}
                      </ReactMarkdown>
                    ) : (
                      "Nu exista niciun raspuns."
                    )}
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
                    {entry.links.length > 0 ? (
                      <div className="space-y-2">
                        {entry.links.map((link, j) => (
                          <div key={j} className="flex flex-col justify-between p-3 bg-slate-50 rounded-lg min-h-[96px] shadow-sm">
                            <div className="flex items-start space-x-2">
                              <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-medium text-slate-600">{j + 1}</span>
                              </div>
                              <div className="text-xs text-slate-700 leading-tight">
                                <div className="font-medium mb-1">{link.title}</div>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-400"
                                >
                                  Deschide document
                                </a>
                              </div>
                            </div>
                            <button
                              className="text-xs text-slate-500 underline hover:text-slate-700 transition text-left mt-2"
                              onClick={() => {
                                localStorage.setItem("selectedChunk", link.text)
                                window.open("/sectiune", "_blank")
                              }}
                            >
                              Vezi secțiunea
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                        Sursele vor fi afisate aici, dupa procesarea intrebarii.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ))}

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
                className="min-h-[100px] resize-none text-sm"
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
