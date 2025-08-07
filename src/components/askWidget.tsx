"use client"

import { useState } from "react"
import { X } from "lucide-react"
import LegalQuestionPage from "@/components/askInterface" // extracted from your ask logic
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function AskWidget() {
  const [isOpen, setIsOpen] = useState(false)

  if (isOpen) {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-auto p-6">
        <div className="max-w-6xl mx-auto relative">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-slate-600 hover:text-slate-900"
          >
            <X className="h-6 w-6" />
          </Button>
          <LegalQuestionPage />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 shadow-2xl">
      <div className="w-64 bg-white rounded-xl border shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <Image
                src="/images/stielegi-logo-horizontal.png"
                alt="StieLegi.ro"
                width={80}
                height={24}
                className="h-4 w-auto"
              />
              <div>
                <div className="font-semibold text-xs">StieLegi.ro</div>
                <div className="text-xs opacity-90">Asistent Legal AI</div>
              </div>
            </div>
            <Button
              onClick={() => setIsOpen(true)}
              className="bg-white text-blue-600 hover:bg-gray-100 h-7 px-2 text-xs font-medium"
            >
              Întreabă
            </Button>
          </div>
        </div>
        <div className="px-4 py-3 text-sm text-gray-700">
          <strong>Cu ce vă putem ajuta?</strong>
          <p className="text-xs text-gray-600 mt-1">
            Răspunsuri automate, gratuite, cu bază legală.
          </p>
          <div className="mt-2 text-xs text-green-600 font-medium">● Online</div>
        </div>
      </div>
    </div>
  )
}
