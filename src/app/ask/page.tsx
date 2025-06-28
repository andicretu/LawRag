"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LegalQuestionPage() {
  const [question, setQuestion] = useState("")
  const [status, setStatus] = useState("Ready")
  const [answer, setAnswer] = useState("")
  const [links, setLinks] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!question.trim()) return

    setIsLoading(true)
    setStatus("Embedding question...")
    setAnswer("")
    setLinks([])

    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      })

      if (!res.ok) {
        setStatus("Error fetching answer")
        return
      }

      const data = await res.json()
      setStatus("Retrieved relevant chunks: 5\nFinal answer ready")
      setAnswer(data.answer)
      setLinks(data.sources || [])
    } catch (error) {
      console.error("Error fetching answer:", error)
      setStatus("Connection error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Section 1: Input Field */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium text-slate-900">Your Legal Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter your legal question here..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[100px] border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 text-base resize-none"
            />
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !question.trim()}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing..." : "Submit"}
            </Button>
          </CardContent>
        </Card>

        {/* Section 2: System Status */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium text-slate-900">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <pre className="whitespace-pre-wrap text-sm text-slate-600 font-mono leading-relaxed bg-slate-50 p-3 rounded-lg">
                {status}
              </pre>

              {links.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="text-sm font-medium text-slate-700 mb-3">Relevant Sources:</div>
                  <div className="space-y-2">
                    {links.map((url, i) => (
                      <div key={i} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                        <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-medium text-slate-600">{i + 1}</span>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm underline decoration-blue-200 hover:decoration-blue-400 transition-colors break-all"
                        >
                          {url}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Final Answer */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium text-slate-900">Answer</CardTitle>
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
                {answer || "No answer yet."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
