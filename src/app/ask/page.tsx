"use client"

import { useState, useEffect } from "react"
import { useAuth0 } from "@auth0/auth0-react"
import { LogoutOptions } from "@auth0/auth0-react";
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from 'next/navigation'


export default function LegalQuestionPage() {

const router = useRouter()
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    logout,
    user,
    getAccessTokenSilently,
  } = useAuth0()

  useEffect(() => {
    // as soon as we know who they are...
    if (!authLoading && isAuthenticated) {
      // 1) sync to your backend
      (async () => {
        try {
          const token = await getAccessTokenSilently()
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
          // optionally notify on first-time registration
        } catch (err) {
          console.error('❌ Failed to sync user:', err)
        }
      })()

      // 2) redirect into the logged-in Q/A page
      router.replace(`/ask/logged/${user?.sub}`)
    }
  }, [authLoading, isAuthenticated, getAccessTokenSilently, router, user?.sub])

  const [question, setQuestion] = useState("")
  const [status, setStatus] = useState("Pregatit")
  const [answer, setAnswer] = useState("")
  const [links, setLinks] = useState<{title: string; url: string;text: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)


  const handleSubmit = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setAnswer("");
    setLinks([]);
    setStatus("Ne asiguram ca am inteles intrebarea");

    try {
      // Step 1: Clarify
      const clarifyRes = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const { clarifiedQuestion } = await clarifyRes.json();

      setStatus("Cautam documentele relevante");

      // ✅ Step 2: Search with clarifiedQuestion
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarifiedQuestion }),
      });
      const { sources } = await searchRes.json(); // sources == chunks

      setLinks(sources || []);
      setStatus("Asteptam raspunsul LLM-ului");

      // ✅ Step 3: Answer with clarifiedQuestion and chunks
      const answerRes = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarifiedQuestion, chunks: sources }),
      });
      const { answer } = await answerRes.json();

      setAnswer(answer);
      setStatus("Raspunsul final este pregatit.");
    } catch (error) {
      setStatus(`A aparut o eroare: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

 return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">LawRAG Assistant</h1>
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
                onClick={() => logout({ logoutParams: { returnTo: `${window.location.origin}/ask` },
                } as LogoutOptions)}
              >
                Log out
              </Button>
            </>
          ) : (
            <Button onClick={() => 
              loginWithRedirect({
                 authorizationParams: {
                  redirect_uri: `${window.location.origin}/ask`
                 }
              })}>
              Log in / Register
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Section 1: Input Field with Status */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium text-slate-900">Cu ce va putem ajuta?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Va rugam introduceti intrebarea..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[100px] border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 text-base resize-none"
            />
            <div className="flex items-center justify-between">
              {/* Status Display - Left Side */}
              <div className="flex items-center text-sm text-slate-600">
                <span>{status}</span>
                {isLoading && (
                  <span className="loading-dots ml-1">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isLoading || !question.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Procesam..." : "Trimite"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Answer (2/3) and Sources (1/3) in Same Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Answer - Takes 2/3 of the space */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm bg-white h-full">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium text-slate-900">Raspuns:</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2" />
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-base text-slate-800 leading-relaxed min-h-[60px] p-4 bg-slate-50 rounded-lg">
                    {answer || "Nu exista niciun raspuns."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Relevant Sources - Takes 1/3 of the space */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-sm bg-white h-full">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium text-slate-900">Surse relevante:</CardTitle>
              </CardHeader>
              <CardContent>
                {links.length > 0 ? (
                  <div className="space-y-2">
                    {links.map((link, i) => (
                      <div
                        key={i}
                        className="flex flex-col justify-between p-3 bg-slate-50 rounded-lg min-h-[96px] shadow-sm"
                      >
                        <div className="flex items-start space-x-2">
                          <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-medium text-slate-600">{i + 1}</span>
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
                            localStorage.setItem("selectedChunk", link.text);
                            window.open("/sectiune", "_blank");
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
    </div>
  )
}
