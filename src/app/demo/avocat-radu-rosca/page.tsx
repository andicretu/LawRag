"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth0 } from "@auth0/auth0-react"
import type { LogoutOptions } from "@auth0/auth0-react"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  X,
  Phone,
  Mail,
  MapPin,
  Scale,
  Users,
  FileText,
  Shield,
  Clock,
  Award,
  ChevronDown,
  Menu,
  Star,
  CheckCircle,
  Building,
  Gavel,
  UserCheck,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import content from "./content.json"


export default function AstraLikeLawFirm() {
  const router = useRouter()
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    logout,
    user,
    getAccessTokenSilently,
  } = useAuth0()

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [status, setStatus] = useState("Pregatit")
  const [answer, setAnswer] = useState("")
  const [links, setLinks] = useState<{ title: string; url: string; text: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [widgetPosition, setWidgetPosition] = useState<"bottom-right" | "bottom-left" | "top-right" | "top-left">(
    "bottom-right",
  )
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [widgetOffset, setWidgetOffset] = useState({ x: 0, y: 0 })
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.sub) {
      ;(async () => {
        try {
          const token = await getAccessTokenSilently()
          await fetch("/api/auth/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
          router.replace(`/ask/logged/${user?.sub}`)
        } catch (err) {
          console.error("❌ Failed to sync user:", err)
        }
      })()
    }
  }, [authLoading, isAuthenticated, user?.sub, getAccessTokenSilently, router])

  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveWrapper = (e: MouseEvent) => handleMouseMove(e)
      const handleMouseUpWrapper = (e: MouseEvent) => handleMouseUp(e)

      document.addEventListener("mousemove", handleMouseMoveWrapper)
      document.addEventListener("mouseup", handleMouseUpWrapper)

      return () => {
        document.removeEventListener("mousemove", handleMouseMoveWrapper)
        document.removeEventListener("mouseup", handleMouseUpWrapper)
      }
    }
  }, [isDragging, dragStart])

  const handleSubmit = async () => {
    if (!question.trim()) return
    setIsLoading(true)
    setAnswer("")
    setLinks([])
    setStatus("Ne asiguram ca am inteles intrebarea")
    let token: string | null = null

    try {
      token = await getAccessTokenSilently()
      console.log("✅ Token received:", token)
    } catch (err) {
      console.warn("⚠️ No token – treating as guest session:", err)
    }

    try {
      // Step 1: Clarify
      const clarifyRes = await fetch("/api/clarify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question }),
      })

      if (!clarifyRes.ok) {
        const text = await clarifyRes.text()
        throw new Error(`Clarify failed: ${clarifyRes.status} – ${text}`)
      }

      const { clarifiedQuestion } = await clarifyRes.json()
      if (!clarifiedQuestion) {
        throw new Error("No clarified question returned")
      }

      setStatus("Cautam documentele relevante")

      // Step 2: Search
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarifiedQuestion }),
      })

      if (!searchRes.ok) {
        const text = await searchRes.text()
        throw new Error(`Search failed: ${searchRes.status} – ${text}`)
      }

      const { sources } = await searchRes.json()
      if (!Array.isArray(sources)) {
        throw new Error("No sources returned from search")
      }

      setLinks(sources || [])
      setStatus("Pregatim raspunsul")

      // Step 3: Answer
      const answerRes = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarifiedQuestion, chunks: sources }),
      })

      if (!answerRes.ok) {
        const text = await answerRes.text()
        throw new Error(`Answer generation failed: ${answerRes.status} – ${text}`)
      }

      const { answer, sources: finalSources } = await answerRes.json()
      if (!answer || typeof answer !== "string") {
        throw new Error("Invalid answer format")
      }

      setAnswer(answer)
      setLinks(finalSources || [])
      setStatus("Raspunsul final este pregatit.")

      // Step 4: Persist (if logged in)
      if (token && user?.sub) {
        const persistRes = await fetch(`/api/chats?userId=${user.sub}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question,
            answer,
            links: finalSources || [],
          }),
        })

        if (!persistRes.ok) {
          const text = await persistRes.text()
          console.warn(`⚠️ Persist failed: ${persistRes.status} – ${text}`)
        }
      }
    } catch (error) {
      console.error("❌ handleSubmit failed:", error)
      setStatus(`A aparut o eroare: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    setDragStart({ x: e.clientX - centerX, y: e.clientY - centerY })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y
    setWidgetOffset({ x: newX, y: newY })
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDragging) return
    setIsDragging(false)

    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const mouseX = e.clientX
    const mouseY = e.clientY

    let newPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left"

    if (mouseX < windowWidth / 2 && mouseY < windowHeight / 2) {
      newPosition = "top-left"
    } else if (mouseX >= windowWidth / 2 && mouseY < windowHeight / 2) {
      newPosition = "top-right"
    } else if (mouseX < windowWidth / 2 && mouseY >= windowHeight / 2) {
      newPosition = "bottom-left"
    } else {
      newPosition = "bottom-right"
    }

    setWidgetPosition(newPosition)
    setWidgetOffset({ x: 0, y: 0 })
  }

  const getPositionClasses = () => {
    switch (widgetPosition) {
      case "bottom-right":
        return "bottom-6 right-6"
      case "bottom-left":
        return "bottom-6 left-6"
      case "top-right":
        return "top-6 right-6"
      case "top-left":
        return "top-6 left-6"
      default:
        return "bottom-6 right-6"
    }
  }

  const getTransformOrigin = () => {
    switch (widgetPosition) {
      case "bottom-right":
        return "origin-bottom-right"
      case "bottom-left":
        return "origin-bottom-left"
      case "top-right":
        return "origin-top-right"
      case "top-left":
        return "origin-top-left"
      default:
        return "origin-bottom-right"
    }
  }

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      setMobileMenuOpen(false)
    }
  }

  const practiceAreaIcons = [FileText, Building, Users, Gavel, Shield, Globe]

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Scale className="w-8 h-8 text-[#C39A38] mr-3" />
              <span className="text-xl font-bold text-[#0B1F3A]">{content.lawyer.name}</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection("despre")}
                className="text-[#111827] hover:text-[#0B5FFF] transition-colors font-medium"
              >
                Despre
              </button>
              <button
                onClick={() => scrollToSection("servicii")}
                className="text-[#111827] hover:text-[#0B5FFF] transition-colors font-medium"
              >
                Servicii
              </button>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-[#111827] hover:text-[#0B5FFF] transition-colors font-medium"
              >
                Contact
              </button>
            </nav>

            {/* CTA Button */}
            <div className="hidden md:block">
              <Button
                onClick={() => scrollToSection("contact")}
                className="bg-[#0B1F3A] hover:bg-[#C39A38] text-white px-6 py-2 rounded-xl transition-colors"
              >
                Programează
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="w-6 h-6 text-[#0B1F3A]" />
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100">
              <div className="flex flex-col space-y-4">
                <button
                  onClick={() => scrollToSection("despre")}
                  className="text-left text-[#111827] hover:text-[#0B5FFF] transition-colors font-medium"
                >
                  Despre
                </button>
                <button
                  onClick={() => scrollToSection("servicii")}
                  className="text-left text-[#111827] hover:text-[#0B5FFF] transition-colors font-medium"
                >
                  Servicii
                </button>
                <button
                  onClick={() => scrollToSection("contact")}
                  className="text-left text-[#111827] hover:text-[#0B5FFF] transition-colors font-medium"
                >
                  Contact
                </button>
                <Button
                  onClick={() => scrollToSection("contact")}
                  className="bg-[#0B1F3A] hover:bg-[#C39A38] text-white px-6 py-2 rounded-xl transition-colors w-fit"
                >
                  Programează
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>
      {/* Hero Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-br from-[#F5F7FA] to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl lg:text-5xl font-bold text-[#0B1F3A] mb-6 leading-tight">
              {content.hero.headline}
            </h1>
            <p className="text-xl lg:text-2xl text-[#C39A38] font-medium mb-4">{content.hero.subheadline}</p>
            <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">{content.hero.description}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => scrollToSection("contact")}
                className="bg-[#0B1F3A] hover:bg-[#C39A38] text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors shadow-lg"
              >
                {content.hero.primaryCta}
              </Button>
              <Button
                onClick={() => scrollToSection("servicii")}
                variant="outline"
                className="border-2 border-[#0B1F3A] text-[#0B1F3A] hover:bg-[#0B1F3A] hover:text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors"
              >
                {content.hero.secondaryCta}
              </Button>
            </div>
          </div>
        </div>
      </section>
      {/* About Section */}
      <section id="despre" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            <div className="lg:col-span-2">
              <h2 className="text-3xl font-bold text-[#0B1F3A] mb-8">Despre mine</h2>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-shrink-0">
                  <img
                    src={content.lawyer.photo || "/placeholder.svg"}
                    alt={content.lawyer.name}
                    className="w-48 h-48 rounded-2xl object-cover shadow-lg"
                  />
                </div>
                <div className="flex-1">
                  <div className="space-y-4">
                    {content.lawyer.experience.map((item, index) => (
                      <div key={index} className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-[#C39A38] mr-3 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-700 leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <Card className="shadow-lg border-0 rounded-2xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold text-[#0B1F3A]">Acreditări</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {content.lawyer.accreditations.map((accreditation, index) => (
                      <div key={index} className="flex items-center">
                        <Award className="w-4 h-4 text-[#C39A38] mr-3" />
                        <span className="text-sm text-gray-700">{accreditation}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
      {/* Practice Areas */}
      <section id="servicii" className="py-20 bg-[#F5F7FA]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0B1F3A] mb-4">Arii de practică</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Oferim servicii juridice complete în domeniile de specialitate
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {content.practiceAreas.map((area, index) => {
              const IconComponent = practiceAreaIcons[index]
              return (
                <Card key={index} className="hover:shadow-xl transition-all duration-300 border-0 rounded-2xl bg-white">
                  <CardHeader className="pb-4">
                    <IconComponent className="w-12 h-12 text-[#C39A38] mb-4" />
                    <CardTitle className="text-xl font-semibold text-[#0B1F3A]">{area.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4 leading-relaxed">{area.description}</p>
                    <p className="text-sm text-gray-500">{area.details}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>
      {/* Why Us */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0B1F3A] mb-4">De ce să mă alegeți?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Avantajele colaborării cu cabinetul nostru</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {content.whyUs.map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-[#C39A38]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-[#C39A38]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0B1F3A] mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Testimonials */}
      <section className="py-20 bg-[#F5F7FA]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0B1F3A] mb-4">Ce spun clienții</h2>
            <p className="text-lg text-gray-600">Feedback-ul clienților noștri</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 rounded-2xl shadow-lg bg-white">
                <CardContent className="pt-8">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-[#C39A38] fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed italic">{testimonial.text}</p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-[#C39A38]/10 rounded-full flex items-center justify-center mr-3">
                      <UserCheck className="w-5 h-5 text-[#C39A38]" />
                    </div>
                    <span className="font-medium text-[#0B1F3A]">{testimonial.author}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0B1F3A] mb-4">Întrebări frecvente</h2>
            <p className="text-lg text-gray-600">Răspunsuri la cele mai comune întrebări</p>
          </div>

          <div className="space-y-4">
            {content.faq.map((item, index) => (
              <Card key={index} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  className="w-full text-left p-6 hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#0B1F3A] pr-4">{item.question}</h3>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === index ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-700 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>
      {/* Contact */}
      <section id="contact" className="py-20 bg-[#F5F7FA]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#0B1F3A] mb-4">Contact</h2>
            <p className="text-lg text-gray-600">Să discutăm despre cazul dumneavoastră</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="border-0 rounded-2xl shadow-lg bg-white">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-[#0B1F3A]">Trimiteți un mesaj</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nume</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C39A38] focus:border-transparent transition-colors"
                        placeholder="Numele dumneavoastră"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                      <input
                        type="tel"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C39A38] focus:border-transparent transition-colors"
                        placeholder="Numărul de telefon"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C39A38] focus:border-transparent transition-colors"
                      placeholder="Adresa de email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mesaj</label>
                    <textarea
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C39A38] focus:border-transparent transition-colors resize-none"
                      placeholder="Descrieți pe scurt problema juridică..."
                    />
                  </div>
                  <Button className="w-full bg-[#0B1F3A] hover:bg-[#C39A38] text-white py-3 rounded-xl text-lg font-medium transition-colors">
                    Trimite mesajul
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info & Map */}
            <div className="space-y-8">
              <Card className="border-0 rounded-2xl shadow-lg bg-white">
                <CardContent className="pt-8">
                  <div className="space-y-6">
                    <div className="flex items-start">
                      <MapPin className="w-6 h-6 text-[#C39A38] mr-4 mt-1" />
                      <div>
                        <h3 className="font-semibold text-[#0B1F3A] mb-1">Adresă</h3>
                        <p className="text-gray-600">{content.contact.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <Phone className="w-6 h-6 text-[#C39A38] mr-4 mt-1" />
                      <div>
                        <h3 className="font-semibold text-[#0B1F3A] mb-1">Telefon</h3>
                        <p className="text-gray-600">{content.contact.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <Mail className="w-6 h-6 text-[#C39A38] mr-4 mt-1" />
                      <div>
                        <h3 className="font-semibold text-[#0B1F3A] mb-1">Email</h3>
                        <p className="text-gray-600">{content.contact.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <Clock className="w-6 h-6 text-[#C39A38] mr-4 mt-1" />
                      <div>
                        <h3 className="font-semibold text-[#0B1F3A] mb-1">Program</h3>
                        <p className="text-gray-600">{content.contact.schedule}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Map */}
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <iframe
                  src={content.contact.mapEmbed}
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Locația cabinetului"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-12 bg-[#0B1F3A] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <Scale className="w-8 h-8 text-[#C39A38] mr-3" />
                <span className="text-xl font-bold">{content.lawyer.name}</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                Consultanță juridică profesională în București cu peste 15 ani de experiență.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Linkuri utile</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                {content.footer.links.map((link, index) => (
                  <li key={index}>
                    <a href={link.url} className="hover:text-[#C39A38] transition-colors">
                      {link.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Social Media</h4>
              <div className="flex space-x-4">
                {content.footer.social.map((social, index) => (
                  <a key={index} href={social.url} className="text-gray-300 hover:text-[#C39A38] transition-colors">
                    {social.platform}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
            <p>{content.footer.copyright}</p>
          </div>
        </div>
      </footer>
      {/* StieLegi.ro Chat Widget */}
      {!isChatOpen && (
        <div
          className={`${isDragging ? "fixed" : `fixed ${getPositionClasses()}`} z-50 transition-transform duration-300 ease-in-out hover:scale-[1.7] cursor-pointer ${getTransformOrigin()} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            ...(isDragging
              ? {
                  left: `${widgetOffset.x}px`,
                  top: `${widgetOffset.y}px`,
                  transform: "none",
                }
              : {
                  transform: `translate(${widgetOffset.x}px, ${widgetOffset.y}px)`,
                }),
            userSelect: "none",
          }}
          onMouseDown={handleMouseDown}
        >
          <Card className="w-54 bg-white shadow-2xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0B1F3A] to-[#1a365d] p-3">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-[#C39A38] rounded-full flex items-center justify-center">
                    <Scale className="w-4 h-4 text-[#0B1F3A]" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs">Asistent Legal</div>
                  </div>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsChatOpen(true)
                  }}
                  className="bg-white text-[#0B1F3A] hover:bg-gray-100 h-6 px-2 text-xs font-medium"
                >
                  Întreabă
                </Button>
              </div>
            </div>
            <CardContent className="p-3">
              <div className="text-sm text-gray-700 mb-2">
                <strong>Aveți întrebări juridice?</strong>
              </div>
              <div className="text-xs text-gray-600 mb-3">Obțineți consultanță juridică rapidă și profesională</div>
              <div className="flex flex-col items-start">
                <div className="text-xs text-green-600 font-medium">● Online</div>
                <div className="text-xs text-gray-400 mt-1">Powered by StieLegi.ro</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Expanded Chat Widget */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-5xl h-[85vh] flex flex-col bg-white/95 backdrop-blur-sm shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b bg-gradient-to-r from-[#0B1F3A] to-[#1a365d] text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#C39A38] rounded-full flex items-center justify-center">
                  <Scale className="w-6 h-6 text-[#0B1F3A]" />
                </div>
                <div>
                  <span className="font-semibold text-lg">Asistent Legal</span>
                  <div className="text-sm opacity-90">Powered by StieLegi.ro</div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {authLoading ? (
                  <span className="text-sm opacity-90">Se încarcă...</span>
                ) : isAuthenticated && user ? (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.picture || "/placeholder.svg"} alt={user.name} />
                      <AvatarFallback className="text-xs">{user.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        logout({ logoutParams: { returnTo: `${window.location.origin}/ask` } } as LogoutOptions)
                      }
                      className="text-white hover:bg-white/20 text-xs"
                    >
                      Log out
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      loginWithRedirect({
                        authorizationParams: {
                          redirect_uri: `${window.location.origin}/ask`,
                        },
                      })
                    }
                    className="text-white hover:bg-white/20 text-xs"
                  >
                    Log in / Register
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsChatOpen(false)}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-6 space-y-6">
              {/* Question Input Section */}
              <Card className="border-0 shadow-sm bg-gray-50">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-medium text-gray-900">Cu ce vă putem ajuta?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Descrieți problema juridică cu care vă confruntați..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="min-h-[80px] border-gray-200 focus:border-[#C39A38] focus:ring-[#C39A38]/20 text-sm resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-600">
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
                      className="bg-[#C39A38] hover:bg-[#0B1F3A] text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? "Procesăm..." : "Trimite"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Answer and Sources Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                {/* Answer - Takes 2/3 of the space */}
                <div className="lg:col-span-2">
                  <Card className="border-0 shadow-sm bg-white h-full">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-medium text-gray-900">Răspuns:</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="space-y-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                        </div>
                      ) : (
                        <div className="text-sm text-gray-800 leading-relaxed min-h-[60px] p-4 bg-gray-50 rounded-lg prose prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) => (
                                <a
                                  href={href || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#0B5FFF] hover:text-[#C39A38] underline"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {answer || "Nu există niciun răspuns."}
                          </ReactMarkdown>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Relevant Sources - Takes 1/3 of the space */}
                <div className="lg:col-span-1">
                  <Card className="border-0 shadow-sm bg-white h-full">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-medium text-gray-900">Surse relevante:</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {links.length > 0 ? (
                        <div className="space-y-2">
                          {links.map((link, i) => (
                            <div
                              key={i}
                              className="flex flex-col justify-between p-3 bg-gray-50 rounded-lg min-h-[96px] shadow-sm"
                            >
                              <div className="flex items-start space-x-2">
                                <div className="w-5 h-5 bg-[#C39A38] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-xs font-medium text-[#0B1F3A]">{i + 1}</span>
                                </div>
                                <div className="text-xs text-gray-700 leading-tight">
                                  <div className="font-medium mb-1">{link.title}</div>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#0B5FFF] hover:text-[#C39A38] underline decoration-blue-200 hover:decoration-amber-400"
                                  >
                                    Deschide document
                                  </a>
                                </div>
                              </div>
                              <button
                                className="text-xs text-gray-500 underline hover:text-gray-700 transition text-left mt-2"
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
                        <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                          Sursele vor fi afișate aici, după procesarea întrebării.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* StieLegi.ro widget placeholder */}
      StieLegi.ro widget here
      <style jsx>{`
        .loading-dots span {
          animation: loading 1.4s infinite ease-in-out;
        }
        .loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }
        .loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes loading {
          0%, 80%, 100% {
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
