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
  ChevronRight,
  Menu,
  Star,
  CheckCircle,
  Building,
  Heart,
  Award,
  Briefcase,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import content from "./content.json"

export default function ElegantLawFirm() {
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
    const element = document.getElementById(sectionId.replace("#", ""))
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      setMobileMenuOpen(false)
    }
  }

  const serviceIcons = [FileText, Building, Shield, Heart, Users, Briefcase]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center group">
              <div className="relative">
                <Scale className="w-10 h-10 text-slate-700 group-hover:text-amber-600 transition-colors duration-300" />
                <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/20 to-slate-700/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
              </div>
              <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                {content.header.logo}
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-10">
              {content.header.navigation.map((item) => (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.href)}
                  className="relative text-slate-700 hover:text-slate-900 transition-colors duration-300 font-medium group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-600 group-hover:w-full transition-all duration-300" />
                </button>
              ))}
            </nav>

            {/* CTA Button */}
            <div className="hidden md:block">
              <Button
                onClick={() => scrollToSection("#contact")}
                className="bg-gradient-to-r from-slate-800 to-slate-700 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {content.header.ctaButton}
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6 text-slate-700" />
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-6 border-t border-slate-200/50 bg-white/95 backdrop-blur-sm">
              <div className="flex flex-col space-y-6">
                {content.header.navigation.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => scrollToSection(item.href)}
                    className="text-left text-slate-700 hover:text-slate-900 transition-colors font-medium"
                  >
                    {item.label}
                  </button>
                ))}
                <Button
                  onClick={() => scrollToSection("#contact")}
                  className="bg-gradient-to-r from-slate-800 to-slate-700 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-3 rounded-full font-semibold w-fit"
                >
                  {content.header.ctaButton}
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=60 height=60 viewBox=0 0 60 60 xmlns=http://www.w3.org/2000/svg%3E%3Cg fill=none fillRule=evenodd%3E%3Cg fill=%23ffffff fillOpacity=0.03%3E%3Ccircle cx=30 cy=30 r=2/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-7xl font-bold text-white mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                {content.hero.title}
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-amber-400 font-medium mb-6 leading-relaxed">
              {content.hero.subtitle}
            </p>
            <p className="text-lg text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">{content.hero.description}</p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button
                onClick={() => scrollToSection("#contact")}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-10 py-4 rounded-full text-lg font-semibold shadow-2xl hover:shadow-amber-500/25 transition-all duration-300 transform hover:scale-105"
              >
                {content.hero.primaryButton}
              </Button>
              <Button
                onClick={() => scrollToSection("#services")}
                variant="outline"
                className="border-2 border-white/30 text-white hover:bg-white hover:text-slate-900 px-10 py-4 rounded-full text-lg font-semibold backdrop-blur-sm transition-all duration-300 transform hover:scale-105"
              >
                {content.hero.secondaryButton}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-white relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {content.about.title}
              </span>
            </h2>
            <p className="text-2xl text-amber-600 font-medium mb-8">{content.about.subtitle}</p>
            <p className="text-lg text-slate-600 max-w-4xl mx-auto leading-relaxed">{content.about.description}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {content.about.stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="relative p-8 rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-slate-200/50">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-slate-700/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-amber-600 to-amber-700 bg-clip-text text-transparent mb-3">
                      {stat.number}
                    </div>
                    <div className="text-slate-600 font-medium">{stat.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {content.about.features.map((feature, index) => (
              <div key={index} className="flex items-center group">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-slate-700 font-medium text-lg group-hover:text-slate-900 transition-colors duration-300">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-gradient-to-br from-slate-50 to-stone-50 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=100 height=100 viewBox=0 0 100 100 xmlns=http://www.w3.org/2000/svg%3E%3Cg fillRule=evenodd%3E%3Cg fill=%23000000 fillOpacity=0.02%3E%3Cpath d=M50 50c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10zm-20 0c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10z /%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {content.services.title}
              </span>
            </h2>
            <p className="text-2xl text-amber-600 font-medium">{content.services.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {content.services.items.map((service, index) => {
              const IconComponent = serviceIcons[index]
              return (
                <Card
                  key={index}
                  className="group hover:shadow-2xl transition-all duration-500 transform hover:scale-105 border-0 bg-white/80 backdrop-blur-sm overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-slate-700/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="relative pb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900 group-hover:text-slate-800 transition-colors duration-300">
                      {service.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className="text-slate-600 mb-6 leading-relaxed">{service.description}</p>
                    <ul className="space-y-3">
                      {service.features.map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-center text-slate-500 group-hover:text-slate-600 transition-colors duration-300"
                        >
                          <ChevronRight className="w-4 h-4 text-amber-600 mr-3 flex-shrink-0" />
                          <span className="text-sm font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/30 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {content.testimonials.title}
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.testimonials.items.map((testimonial, index) => (
              <Card
                key={index}
                className="group border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-br from-white to-slate-50/50 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-slate-700/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="relative pt-8">
                  <div className="flex mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-amber-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-slate-700 mb-8 leading-relaxed italic text-lg">{testimonial.text}</p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center mr-4 shadow-lg">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{testimonial.author}</div>
                      <div className="text-sm text-amber-600 font-medium">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=60 height=60 viewBox=0 0 60 60 xmlns=http://www.w3.org/2000/svg%3E%3Cg fill=none fillRule=evenodd%3E%3Cg fill=%23ffffff fillOpacity=0.03%3E%3Ccircle cx=30 cy=30 r=2/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">{content.contact.title}</h2>
            <p className="text-2xl text-amber-400 font-medium">{content.contact.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
              <CardContent className="pt-8">
                <form className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      {content.contact.form.nameLabel}
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      {content.contact.form.emailLabel}
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      {content.contact.form.phoneLabel}
                    </label>
                    <input
                      type="tel"
                      className="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      {content.contact.form.messageLabel}
                    </label>
                    <textarea
                      rows={5}
                      className="w-full px-4 py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 resize-none bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    {content.contact.form.submitButton}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-8">
              <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-sm text-white">
                <CardContent className="pt-8">
                  <div className="space-y-8">
                    <div className="flex items-start group">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white mb-2 text-lg">Adresă</h3>
                        <p className="text-slate-300 leading-relaxed">{content.contact.info.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start group">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                        <Phone className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white mb-2 text-lg">Telefon</h3>
                        <p className="text-slate-300">{content.contact.info.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-start group">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                        <Mail className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white mb-2 text-lg">Email</h3>
                        <p className="text-slate-300">{content.contact.info.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start group">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white mb-2 text-lg">Program</h3>
                        <p className="text-slate-300">{content.contact.info.schedule}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-slate-900 text-white border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0 group">
              <div className="relative">
                <Scale className="w-10 h-10 text-amber-500 group-hover:text-amber-400 transition-colors duration-300" />
                <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/20 to-slate-700/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
              </div>
              <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                {content.header.logo}
              </span>
            </div>
            <div className="flex flex-wrap justify-center md:justify-end space-x-8 mb-6 md:mb-0">
              {content.footer.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-slate-300 hover:text-amber-400 transition-colors duration-300 font-medium"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-400">
            <p>{content.footer.copyright}</p>
          </div>
        </div>
      </footer>

      {/* StieLegi.ro Chat Widget */}
      {!isChatOpen && (
        <div
          className={`${isDragging ? "fixed" : `fixed ${getPositionClasses()}`} z-50 transition-all duration-300 ease-in-out hover:scale-[1.7] cursor-pointer ${getTransformOrigin()} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
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
          <Card className="w-56 bg-white/95 backdrop-blur-sm shadow-2xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                    <Scale className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Asistent Legal</div>
                  </div>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsChatOpen(true)
                  }}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white h-6 px-3 text-xs font-semibold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Întreabă
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="text-sm text-slate-800 mb-2 font-semibold">Aveți întrebări juridice?</div>
              <div className="text-xs text-slate-600 mb-3 leading-relaxed">
                Obțineți consultanță juridică rapidă și profesională
              </div>
              <div className="flex flex-col items-start">
                <div className="text-xs text-emerald-600 font-semibold flex items-center">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                  Online
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium">Powered by StieLegi.ro</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Expanded Chat Widget */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <Card className="w-full max-w-6xl h-[90vh] flex flex-col bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                  <Scale className="w-7 h-7 text-white" />
                </div>
                <div>
                  <span className="font-bold text-xl">Asistent Legal</span>
                  <div className="text-sm opacity-90 font-medium">Powered by StieLegi.ro</div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {authLoading ? (
                  <span className="text-sm opacity-90">Se încarcă...</span>
                ) : isAuthenticated && user ? (
                  <>
                    <Avatar className="h-10 w-10 ring-2 ring-amber-500/50">
                      <AvatarImage src={user.picture || "/placeholder.svg"} alt={user.name} />
                      <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                        {user.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        logout({ logoutParams: { returnTo: `${window.location.origin}/ask` } } as LogoutOptions)
                      }
                      className="text-white hover:bg-white/20 text-sm font-medium"
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
                    className="text-white hover:bg-white/20 text-sm font-medium"
                  >
                    Log in / Register
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsChatOpen(false)}
                  className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-8 space-y-8">
              {/* Question Input Section */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold text-slate-900">Cu ce vă putem ajuta?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Textarea
                    placeholder="Descrieți problema juridică cu care vă confruntați..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="min-h-[100px] border-slate-200 focus:border-amber-500 focus:ring-amber-500/20 text-sm resize-none bg-white/80 backdrop-blur-sm rounded-xl"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-slate-600 font-medium">
                      <span>{status}</span>
                      {isLoading && (
                        <span className="loading-dots ml-2">
                          <span>.</span>
                          <span>.</span>
                          <span>.</span>
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={handleSubmit}
                      disabled={isLoading || !question.trim()}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isLoading ? "Procesăm..." : "Trimite"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Answer and Sources Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                {/* Answer - Takes 2/3 of the space */}
                <div className="lg:col-span-2">
                  <Card className="border-0 shadow-lg bg-white h-full">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-bold text-slate-900">Răspuns:</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="space-y-4">
                          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
                          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse w-3/4" />
                          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse w-1/2" />
                        </div>
                      ) : (
                        <div className="text-sm text-slate-800 leading-relaxed min-h-[80px] p-6 bg-gradient-to-br from-slate-50 to-white rounded-xl prose prose-sm max-w-none shadow-inner">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) => (
                                <a
                                  href={href || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-600 hover:text-amber-700 underline font-medium"
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
                  <Card className="border-0 shadow-lg bg-white h-full">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-bold text-slate-900">Surse relevante:</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {links.length > 0 ? (
                        <div className="space-y-3">
                          {links.map((link, i) => (
                            <div
                              key={i}
                              className="flex flex-col justify-between p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl min-h-[110px] shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100"
                            >
                              <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                                  <span className="text-xs font-bold text-white">{i + 1}</span>
                                </div>
                                <div className="text-xs text-slate-700 leading-tight">
                                  <div className="font-semibold mb-2 text-slate-900">{link.title}</div>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-600 hover:text-amber-700 underline decoration-amber-200 hover:decoration-amber-400 font-medium"
                                  >
                                    Deschide document
                                  </a>
                                </div>
                              </div>
                              <button
                                className="text-xs text-slate-500 underline hover:text-slate-700 transition text-left mt-3 font-medium"
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
                        <div className="text-xs text-slate-500 italic p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100">
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
      {/* StieLegi.ro widget here */}

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
