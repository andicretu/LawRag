"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import AskInterface from "@/components/askInterface"
import Image from "next/image"
import {
  CheckCircle,
  Brain,
  Search,
  FileText,
  Palette,
  Users,
  Building2,
  GraduationCap,
  Heart,
  Shield,
  Phone,
  Download,
} from "lucide-react"

export default function LandingPage() {

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [ showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (showForm) {
      const existingScript = document.querySelector("script[src*='hsforms.net']")
      if (!existingScript) {
        const script = document.createElement("script")
        script.src = "https://js-eu1.hsforms.net/forms/embed/146681522.js"
        script.defer = true
        document.body.appendChild(script)
      }
    }
  }, [showForm])

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header - Clean and minimal */}
      <nav className="bg-white/95 backdrop-blur-sm border-b border-slate-200 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image
              src="/images/stielegi-logo-vertical.png"
              alt="StieLegi.ro"
              width={40}
              height={40}
              className="h-8 w-8"
            />
            <span className="text-xl font-bold text-slate-900">StieLegi.ro</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden sm:inline-flex bg-transparent" 
              onClick={() => setShowForm(true)}>
              Contact
            </Button>
          </div>
        </div>
      </nav>

       <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 relative">
      {/* Optional: Page Header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">StieLegi.ro</h1>
        <p className="text-slate-700 text-lg">
          Răspunsuri clare din legislația românească. Gratuit. Rapid.
        </p>
      </header>

      {/* Widget Card (Collapsed View) */}
      {!isChatOpen && (
        <Card className="w-64 bg-white shadow-2xl border-0 overflow-hidden">
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
                  <div className="text-xs opacity-90">Asistent Legal virtual</div>
                </div>
              </div>
              <Button
                onClick={() => setIsChatOpen(true)}
                className="bg-white text-blue-600 hover:bg-gray-100 h-7 px-2 text-xs font-medium"
              >
                Întreabă
              </Button>
            </div>
          </div>
          <CardContent className="p-3">
            <div className="text-sm text-gray-700 mb-3">
              <strong>Cu ce vă putem ajuta?</strong>
            </div>
            <div className="text-xs text-gray-600 mb-3">
              Obțineți răspunsuri rapide la întrebările dumneavoastră juridice
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-green-600 font-medium">● Online</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Ask Interface (Expanded View) */}
      {isChatOpen && (
        <div className="fixed inset-0 bg-white z-50 p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={() => setIsChatOpen(false)}
                className="text-sm"
              >
                Închide
              </Button>
            </div>
            <AskInterface />
          </div>
        </div>
      )}
    </div>

      {/* Hero Section - Logo as subtle background */}
      <section className="relative py-24 bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* Background Logo */}
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 opacity-5">
          <Image src="/images/stielegi-logo-vertical.png" alt="" width={600} height={600} className="w-96 h-96" />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-blue-100 text-blue-800 hover:bg-blue-100">🧑‍💼 StieLegi for Partners</Badge>
            <h1 className="text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Asistentul juridic AI, <br />
              <span className="text-blue-600">sub marca ta</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl">
              Integrează răspunsuri juridice automate, rapide și documentate, direct în platforma ta.
              <br />
              <strong>White-label. Personalizabil. Fără costuri de dezvoltare.</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-300 px-8 py-4 text-lg bg-white/80 backdrop-blur-sm"
              >
                <Phone className="mr-2 h-5 w-5" />
                Programează un apel
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1 - Ce este StieLegi - Clean layout */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Ce este StieLegi for Partners</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Transformă modul în care răspunzi întrebărilor juridice.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <p className="text-lg text-slate-700 leading-relaxed">
                StieLegi este un asistent juridic AI care înțelege legislația românească. Acum disponibil ca serviciu
                white-label, pe care îl poți integra direct în platforma ta.
              </p>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-slate-700 text-lg">Răspunde instant întrebărilor legale frecvente</span>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-slate-700 text-lg">Citează direct articole de lege actualizate</span>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-slate-700 text-lg">Reduce volumul de întrebări repetitive</span>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-slate-700 text-lg">Disponibil 24/7, fără costuri de personal</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-8">
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Brain className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900 text-lg">StieLegi.ro</span>
                </div>
                <div className="text-slate-600 mb-4">
                  Întrebare: Care sunt drepturile unui angajat în concediu medical?
                </div>
                <div className="text-slate-800 bg-blue-50 p-4 rounded-xl leading-relaxed">
                  Conform legislației muncii din România, un angajat aflat în concediu medical beneficiază de următoarele drepturi și protecții:...
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 - Cum funcționează - Simplified */}
      <section className="py-24 bg-slate-50 relative">
        {/* Subtle background logo */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 opacity-3">
          <Image src="/images/stielegi-logo-vertical.png" alt="" width={400} height={400} className="w-64 h-64" />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Cum funcționează</h2>
            <p className="text-xl text-slate-600">Tehnologie de ultimă generație, fără efort de implementare.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Brain className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">Analizează</h3>
              <p className="text-slate-600">Analizează întrebările utilizatorilor</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Search className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">Caută</h3>
              <p className="text-slate-600">Caută informația relevantă in baza e date, cuprinzand intreaga legislația românească</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">Livrează</h3>
              <p className="text-slate-600">Livrează un răspuns clar, bazat pe litera legii, cu indicarea surselor legale</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Palette className="h-10 w-10 text-orange-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">Personalizează</h3>
              <p className="text-slate-600">Totul sub logo-ul și culorile tale</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-lg text-slate-700">
              Disponibil ca <strong>widget integrabil</strong>, <strong>iframe</strong>, sau <strong>API custom</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Section 3 - Cui se adresează - Grid simplified */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Cui se adresează</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-8 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2 text-lg">Birouri de avocatură</h3>
              <p className="text-slate-600">care vor să ofere pre-calificare automată</p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2 text-lg">Platforme de consultanță</h3>
              <p className="text-slate-600">juridică / informare</p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <Building2 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2 text-lg">Instituții publice</h3>
              <p className="text-slate-600">locale (primării, agenții)</p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <Heart className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2 text-lg">ONG-uri</h3>
              <p className="text-slate-600">sau proiecte civice</p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <GraduationCap className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2 text-lg">Universități</h3>
              <p className="text-slate-600">și platforme educaționale</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 - Pachete flexibile - Cleaner pricing */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Pachete flexibile</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-3xl shadow-sm">
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Trafic mic</h3>
                <div className="text-4xl font-bold text-blue-600 mb-2">99 EUR</div>
                <div className="text-slate-600">pe lună</div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Logo Personalizat</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="h-5 w-5 text-slate-300">–</span>
                  <span className="text-slate-500">4 mil tokens</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-lg border-2 border-blue-200 relative">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white">
                Recomandat
              </Badge>
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Trafic mediu</h3>
                <div className="text-4xl font-bold text-blue-600 mb-2">199 EUR</div>
                <div className="text-slate-600">pe lună</div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Logo Personalizat</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Rapoarte trafic</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Acces la API</span>
                </div>
                 <div className="flex items-center space-x-3">
                  <span className="h-5 w-5 text-slate-300">–</span>
                  <span className="text-slate-500">9 mil tokens</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm">
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Platforme mari</h3>
                <div className="text-4xl font-bold text-blue-600 mb-2">399 EUR</div>
                <div className="text-slate-600">pe lună</div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Logo Personalizat</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Rapoarte trafic</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Acces la API</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Aplicatie proprie</span>
                </div>
                  <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Integrare programari</span>
                </div>
                  <div className="flex items-center space-x-3">
                  <span className="h-5 w-5 text-slate-300">–</span>
                  <span className="text-slate-500">nelimitat</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-slate-600">
              La cerere oferim contracte instituționale anuale și reduceri pentru ONG-uri.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5 - Testimonial - Simplified */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-12">Ce spun partenerii</h2>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-12">
            <blockquote className="text-2xl text-slate-700 italic mb-8 leading-relaxed">
              Am integrat StieLegi.ro pe site-ul nostru de avocatură și am primit cu 40% mai multe solicitari de servicii.
              Clienții revin pe site-ul nostru si apoi ne solicita serviciile, deoarece simt ca primesc mai multa valoare si atentie.
            </blockquote>
            <div className="font-semibold text-slate-900 text-lg">— Cabinet Avocat Popescu & Asociații</div>
          </div>
        </div>
      </section>

      {/* Section 6 - Contact & Acțiune - Clean CTA */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
        {/* Background logo */}
        <div className="absolute right-0 bottom-0 opacity-5">
          <Image src="/images/stielegi-logo-vertical.png" alt="" width={300} height={300} className="w-48 h-48" />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl font-bold mb-8">
            Hai să discutăm despre cum StieLegi poate aduce valoare pe site-ul tău
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="flex items-center justify-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <span className="text-lg">Demo gratuit</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <span className="text-lg">Consultanță tehnică</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <span className="text-lg">Integrare în mai puțin de 48h</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 text-lg">
              Programează un demo
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-slate-900 px-10 py-4 text-lg bg-transparent"
            >
              <Download className="mr-2 h-5 w-5" />
              Descarcă oferta PDF
            </Button>
          </div>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="bg-white py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Image
              src="/images/stielegi-logo-vertical.png"
              alt="StieLegi.ro"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-lg font-semibold text-slate-900">StieLegi.ro</span>
          </div>
          <p className="text-slate-600">© 2024 StieLegi.ro. Toate drepturile rezervate.</p>
        </div>
      </footer>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-2 right-3 text-slate-500 hover:text-slate-800 text-sm"
            >
              ✕
            </button>

            {/* HubSpot embed target container */}
            <div
              className="hs-form-frame"
              data-region="eu1"
              data-form-id="3f4f6ab5-eea7-4a42-9dd2-5deabf996fd3"
              data-portal-id="146681522"
            ></div>
          </div>
        </div>
      )}
    </div>
  )
}
