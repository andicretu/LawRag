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

const DEFAULT_ASK = [
  { id: "scope",    q: "Care este scopul întrebării?" },
  { id: "parties",  q: "Cine sunt părțile implicate?" },
  { id: "actions",  q: "Ce acțiuni sunt avute în vedere?" },
  { id: "timeframe",q: "Care este intervalul de timp relevant?" },
] as const;


type ClarifyOut = {
  needs_more_info: boolean;
  ask?: Array<{ id: "scope"|"parties"|"actions"|"timeframe"; q: string }>;
  clarified_question?: string;
  hints?: { scope?: string; parties?: string; actions?: string; timeframe?: { from?: string; to?: string } };
  confidence: number;
};

type ClarifyAnswers = { scope?: string; parties?: string; actions?: string; timeframe?: { from?: string; to?: string } };



function buildClarifiedQuestion(original: string, a: ClarifyAnswers) {
  const bits:string[] = [];
  if (a.scope) bits.push(`scop: ${a.scope}`);
  if (a.parties) bits.push(`părți: ${a.parties}`);
  if (a.actions) bits.push(`acțiuni: ${a.actions}`);
  if (a.timeframe?.from || a.timeframe?.to) {
    bits.push(`interval: ${a.timeframe?.from ?? "?"}–${a.timeframe?.to ?? "?"}`);
  }
  return bits.length ? `${original}\nContext: ${bits.join("; ")}` : original;
}

export default function LegalQuestionPageLogged() {

  const [clarify, setClarify] = useState<ClarifyOut | null>(null);
  const [clarifyAns, setClarifyAns] = useState<ClarifyAnswers>({});
  const [phase, setPhase] = useState<"idle"|"clarify"|"search"|"answer">("idle");
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

  useEffect(() => {
    if (phase === "clarify" && clarify) {
      const el = document.getElementById("clarify-panel");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [phase, clarify]);

  async function proceedFlow(clarifiedQuestion: string, token?: string) {
    // 🔍 Search
    setStatus('Cautam documentele relevante');
    const searchRes = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clarifiedQuestion }),
    });
    if (!searchRes.ok) throw new Error(`Eroare cautare: ${await searchRes.text()}`);
    const { sources } = await searchRes.json();

    // 🧠 Answer
    setStatus('Pregatim raspunsul');
    const answerRes = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clarifiedQuestion, chunks: sources }),
    });
    if (!answerRes.ok) throw new Error(`Eroare raspuns: ${await answerRes.text()}`);
    const { answer: aiAnswer } = await answerRes.json();

    const newEntry = { question, answer: aiAnswer, links: sources || [] };
    setChatHistory(prev => [...prev, newEntry]);
    setStatus('Raspunsul final este pregatit.');

    if (token) {
      await fetch(`/api/chats?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newEntry),
      });
    }
    setQuestion("");
  }

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setIsLoading(true);
    setStatus("Ne asiguram ca am inteles intrebarea");
    try {
      const token = await getAccessTokenSilently();
      const clarifyRes = await fetch(`/api/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ originalQuestion: question }),
      });
      if (!clarifyRes.ok) throw new Error(`Eroare clarificare: ${await clarifyRes.text()}`);
      
      const out: ClarifyOut = await clarifyRes.json();
      console.log("UI ClarifyOut:", out, out?.needs_more_info, out?.ask?.length);

      /*if (out?.needs_more_info === true && Array.isArray(out.ask) && out.ask.length > 0) {
        setClarify(out);
        setPhase("clarify");
        console.log("Phase set to:", "clarify");
        setStatus("Avem nevoie de câteva clarificări.");
        setIsLoading(false);
        return; // așteptăm input-ul din UI
      }*/

      setPhase("clarify");
      setClarify({
        needs_more_info: true,
        ask: DEFAULT_ASK.slice(0, 3),
        clarified_question: "",
        hints: {},
        confidence: 0.2,
      });
      setIsLoading(false);
      return; // așteptăm input-ul din UI

      setPhase("search");
      const clarified = out.clarified_question?.trim() || question;
      await proceedFlow(clarified, token);
    } catch (error) {
      setStatus(`A aparut o eroare: ${error}`);
      console.error("❌ handleSubmit error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  async function handleClarifyContinue() {
    try {
      setIsLoading(true);
      setPhase("search");
      const token = await getAccessTokenSilently();
      const clarified = buildClarifiedQuestion(question, clarifyAns);
      await proceedFlow(clarified, token);
      setClarify(null);
      setClarifyAns({});
      setPhase("idle");
    } catch (e) {
      setStatus(`Eroare: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }

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

        {phase === "clarify" && (
          <Card id="clarify-panel" className="border-0 shadow-sm bg-white">
            <CardHeader><CardTitle className="text-base font-semibold text-slate-900">Clarifică întrebarea</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(clarify?.ask?.length ? clarify.ask : DEFAULT_ASK.slice(0,3)).map((q, idx) => (
                <div key={q.id} className="space-y-1">
                  <label className="text-sm font-medium text-slate-800">{idx+1}. {q.q}</label>
                  {q.id === "timeframe" ? (
                    <div className="flex gap-2">
                      <input type="date" className="border rounded px-2 py-1 text-sm"
                        onChange={(e)=>setClarifyAns(a=>({ ...a, timeframe:{ ...(a.timeframe||{}), from:e.target.value||undefined }}))}/>
                      <input type="date" className="border rounded px-2 py-1 text-sm"
                        onChange={(e)=>setClarifyAns(a=>({ ...a, timeframe:{ ...(a.timeframe||{}), to:e.target.value||undefined }}))}/>
                    </div>
                  ) : (
                    <input type="text" className="w-full border rounded px-2 py-1 text-sm"
                      onChange={(e)=>setClarifyAns(a => ({ ...a, [q.id]: (e.target.value || undefined) } as ClarifyAnswers))}/>
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <Button onClick={handleClarifyContinue} disabled={isLoading}>Continuă</Button>
              </div>
            </CardContent>
          </Card>
        )}


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
