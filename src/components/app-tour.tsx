'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useDataCache } from '@/stores/data-cache'

type TourStep = {
  target: string
  title: string
  description: string
  emoji: string
  page: string // route where this step lives
  position: 'top' | 'bottom'
  scrollTo?: boolean
  prepare?: () => void // Called before looking for the target element
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'dashboard-programmes',
    title: 'Programme & Replay',
    description: 'Ton programme hebdo et le dernier replay.',
    emoji: '🎯',
    page: '/dashboard',
    position: 'top',
    scrollTo: true,
  },
  {
    target: 'cours-tabs',
    title: 'Tes cours',
    description: 'Lives, replays et +180 cours vidéo.',
    emoji: '🎬',
    page: '/cours',
    position: 'bottom',
  },
  {
    target: 'communaute-compose',
    title: 'La communauté',
    description: 'C\'est ici que tu peux écrire tes messages dans la communauté.',
    emoji: '💬',
    page: '/communaute',
    position: 'top',
  },
  {
    target: 'nav-messages',
    title: 'Messages privés',
    description: 'Marjorie t\'a envoyé un message !',
    emoji: '💌',
    page: '/communaute',
    position: 'bottom',
  },
  {
    target: 'nav-menu',
    title: 'Enregistre tes séances',
    description: 'Appuie ici après chaque pratique.',
    emoji: '🌟',
    page: '/communaute',
    position: 'top',
  },
]

export function AppTour() {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, setProfile } = useAuthStore()
  const invalidateCache = useDataCache(s => s.invalidate)
  const [showWelcome, setShowWelcome] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [navigating, setNavigating] = useState(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const isActive = currentStep >= 0 && currentStep < TOUR_STEPS.length

  // Show welcome on first visit + send welcome DM
  useEffect(() => {
    if (!profile) return
    if (profile.is_admin) return
    if (profile.has_seen_tour) return
    if (!profile.onboarding_completed) return

    fetch('/api/welcome-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id }),
    }).then(() => {
      // Invalidate dashboard cache so unread message card appears
      setTimeout(() => invalidateCache('dashboard'), 2000)
    }).catch(() => {})

    const timer = setTimeout(() => setShowWelcome(true), 1200)
    return () => clearTimeout(timer)
  }, [profile])

  // Position spotlight and tooltip
  const positionElements = useCallback(() => {
    if (!isActive) return
    const step = TOUR_STEPS[currentStep]
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
    if (!el) {
      retryCountRef.current++
      // After 3 retries, try prepare() to reveal the element (e.g. switch tab)
      if (retryCountRef.current === 3 && step.prepare) {
        step.prepare()
      }
      // Give up after 25 retries (~5s) and skip to next step
      if (retryCountRef.current > 25) {
        setSpotlightRect(null)
        setCurrentStep(prev => prev < TOUR_STEPS.length - 1 ? prev + 1 : -1)
        return
      }
      retryRef.current = setTimeout(() => positionElements(), 200)
      return
    }
    retryCountRef.current = 0

    if (step.scrollTo) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Wait for scroll to finish before measuring
      setTimeout(() => {
        const rect = el.getBoundingClientRect()
        updatePositions(rect, step.position)
      }, 400)
    } else {
      const rect = el.getBoundingClientRect()
      updatePositions(rect, step.position)
    }

    setNavigating(false)
  }, [currentStep, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  function updatePositions(rect: DOMRect, position: 'top' | 'bottom') {
    // Clamp spotlight to visible viewport (avoid off-screen elements)
    const safeTop = Math.max(0, rect.top)
    const safeBottom = Math.min(window.innerHeight, rect.bottom)
    const safeLeft = Math.max(0, rect.left)
    const safeRight = Math.min(window.innerWidth, rect.right)
    const safeRect = {
      top: safeTop,
      bottom: safeBottom,
      left: safeLeft,
      right: safeRight,
      width: safeRight - safeLeft,
      height: safeBottom - safeTop,
    }
    setSpotlightRect(safeRect as DOMRect)

    const padding = 14
    const tooltipHeight = 180 // estimated tooltip height
    const tooltipWidth = Math.min(280, window.innerWidth - 40)
    const style: React.CSSProperties = { width: tooltipWidth }
    // Center horizontally relative to element, clamped to screen edges
    style.left = Math.max(20, Math.min(
      safeRect.left + safeRect.width / 2 - tooltipWidth / 2,
      window.innerWidth - tooltipWidth - 20
    ))

    if (position === 'top') {
      // Place tooltip above the element
      const spaceAbove = safeRect.top - padding
      if (spaceAbove >= tooltipHeight) {
        style.bottom = window.innerHeight - safeRect.top + padding
      } else {
        // Not enough space above, place below
        style.top = safeRect.bottom + padding
      }
    } else {
      // Place tooltip below the element
      const spaceBelow = window.innerHeight - safeRect.bottom - padding
      if (spaceBelow >= tooltipHeight) {
        style.top = safeRect.bottom + padding
      } else {
        // Not enough space below, place above
        style.bottom = window.innerHeight - safeRect.top + padding
      }
    }

    // Final safety: ensure tooltip doesn't go beyond viewport
    if (style.top !== undefined && (style.top as number) + tooltipHeight > window.innerHeight - 80) {
      // Too close to bottom nav — move up
      delete style.top
      style.bottom = window.innerHeight - safeRect.top + padding
    }

    setTooltipStyle(style)
  }

  // When step changes, navigate if needed then position
  useEffect(() => {
    if (!isActive) return
    if (retryRef.current) clearTimeout(retryRef.current)
    retryCountRef.current = 0

    const step = TOUR_STEPS[currentStep]
    if (!pathname.startsWith(step.page)) {
      setNavigating(true)
      setSpotlightRect(null)
      router.push(step.page)
    } else {
      // Already on the right page — run prepare if needed, then position
      if (step.prepare) step.prepare()
      const timer = setTimeout(positionElements, 300)
      return () => clearTimeout(timer)
    }
  }, [currentStep, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // When pathname changes (navigation complete), reposition
  useEffect(() => {
    if (!isActive || !navigating) return
    const step = TOUR_STEPS[currentStep]
    if (pathname.startsWith(step.page)) {
      if (step.prepare) step.prepare()
      const timer = setTimeout(positionElements, 600)
      return () => clearTimeout(timer)
    }
  }, [pathname, navigating]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reposition on resize/scroll
  useEffect(() => {
    if (!isActive) return
    window.addEventListener('resize', positionElements)
    window.addEventListener('scroll', positionElements, true)
    return () => {
      window.removeEventListener('resize', positionElements)
      window.removeEventListener('scroll', positionElements, true)
    }
  }, [positionElements, isActive])

  // Observe target element changes
  useEffect(() => {
    if (!isActive) return
    const step = TOUR_STEPS[currentStep]
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) return
    resizeObserverRef.current = new ResizeObserver(positionElements)
    resizeObserverRef.current.observe(el)
    return () => resizeObserverRef.current?.disconnect()
  }, [currentStep, isActive, positionElements])

  // Cleanup retry on unmount
  useEffect(() => {
    return () => { if (retryRef.current) clearTimeout(retryRef.current) }
  }, [])

  async function markTourSeen() {
    if (!profile || !isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.from('profiles').update({ has_seen_tour: true }).eq('id', profile.id)
    setProfile({ ...profile, has_seen_tour: true })
  }

  function startTour() {
    setShowWelcome(false)
    setCurrentStep(0)
  }

  function skipTour() {
    setShowWelcome(false)
    setCurrentStep(-1)
    setSpotlightRect(null)
    setNavigating(false)
    markTourSeen()
    // Return to dashboard
    if (!pathname.startsWith('/dashboard')) router.push('/dashboard')
  }

  function nextStep() {
    if (currentStep >= TOUR_STEPS.length - 1) {
      finishTour()
    } else {
      setSpotlightRect(null)
      setCurrentStep(prev => prev + 1)
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setSpotlightRect(null)
      setCurrentStep(prev => prev - 1)
    }
  }

  function finishTour() {
    setCurrentStep(-1)
    setSpotlightRect(null)
    setNavigating(false)
    markTourSeen()
    router.push('/dashboard')
  }

  const step = isActive ? TOUR_STEPS[currentStep] : null

  return (
    <>
      {/* Welcome modal */}
      <AnimatePresence>
        {showWelcome && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
            >
              <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
                <div className="bg-gradient-to-br from-[#C6684F] to-[#E8926F] px-6 pt-8 pb-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                  >
                    <Sparkles size={32} className="text-white" />
                  </motion.div>
                  <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-1">
                    Bienvenue {profile?.first_name} !
                  </h2>
                  <p className="text-white/80 text-sm">Ton espace Pilates est prêt</p>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm text-[#6B6359] leading-relaxed text-center mb-6">
                    Souhaites-tu faire un petit tour rapide pour découvrir les différentes fonctionnalités de l&apos;application ?
                  </p>
                  <div className="space-y-2.5">
                    <button
                      onClick={startTour}
                      className="w-full py-3 rounded-2xl bg-[#C6684F] text-white text-sm font-semibold hover:bg-[#b55a43] transition-colors shadow-md shadow-[#C6684F]/20"
                    >
                      Oui, montre-moi !
                    </button>
                    <button
                      onClick={skipTour}
                      className="w-full py-3 rounded-2xl border border-[#EDE5DA] text-sm font-medium text-[#6B6359] hover:bg-[#FAF6F1] transition-colors"
                    >
                      Non merci, je découvre seule
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tour overlay */}
      <AnimatePresence>
        {isActive && spotlightRect && step && (
          <>
            {/* SVG overlay with spotlight cutout */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998]"
              onClick={skipTour}
            >
              <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                  <mask id="spotlight-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={spotlightRect.left - 8}
                      y={spotlightRect.top - 8}
                      width={spotlightRect.width + 16}
                      height={spotlightRect.height + 16}
                      rx={16}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%" height="100%"
                  fill="rgba(0,0,0,0.5)"
                  mask="url(#spotlight-mask)"
                />
              </svg>

              {/* Spotlight border glow */}
              <motion.div
                key={`glow-${currentStep}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute rounded-2xl border-2 border-[#C6684F] shadow-[0_0_24px_rgba(198,104,79,0.35)]"
                style={{
                  left: spotlightRect.left - 8,
                  top: spotlightRect.top - 8,
                  width: spotlightRect.width + 16,
                  height: spotlightRect.height + 16,
                }}
              />
            </motion.div>

            {/* Tooltip */}
            <motion.div
              key={`tooltip-${currentStep}`}
              initial={{ opacity: 0, y: step.position === 'top' ? 8 : -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed z-[9999] pointer-events-auto"
              style={tooltipStyle}
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-[#EDE5DA] overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                  <div className="w-10 h-10 rounded-full bg-[#C6684F]/10 flex items-center justify-center text-lg flex-shrink-0">
                    {step.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2C2C2C]">{step.title}</p>
                    <p className="text-[10px] text-[#A09488]">{currentStep + 1} / {TOUR_STEPS.length}</p>
                  </div>
                  <button
                    onClick={skipTour}
                    className="w-7 h-7 rounded-full hover:bg-[#F2E8DF] flex items-center justify-center text-[#A09488] hover:text-[#6B6359] transition-colors flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Description */}
                <p className="text-xs text-[#6B6359] leading-relaxed px-4 pb-3">
                  {step.description}
                </p>

                {/* Progress bar */}
                <div className="px-4 pb-3">
                  <div className="h-1 bg-[#F2E8DF] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#C6684F] rounded-full"
                      initial={{ width: `${(currentStep / TOUR_STEPS.length) * 100}%` }}
                      animate={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between px-4 pb-4">
                  <button
                    onClick={skipTour}
                    className="text-xs text-[#A09488] hover:text-[#6B6359] transition-colors"
                  >
                    Passer
                  </button>
                  <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                      <button
                        onClick={prevStep}
                        className="w-8 h-8 rounded-full border border-[#EDE5DA] flex items-center justify-center text-[#6B6359] hover:bg-[#FAF6F1] transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    <button
                      onClick={nextStep}
                      className="h-8 px-4 rounded-full bg-[#C6684F] text-white text-xs font-semibold hover:bg-[#b55a43] transition-colors flex items-center gap-1 shadow-md shadow-[#C6684F]/20"
                    >
                      {currentStep >= TOUR_STEPS.length - 1 ? 'C\'est parti !' : 'Suivant'}
                      {currentStep < TOUR_STEPS.length - 1 && <ChevronRight size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loading state between pages */}
      <AnimatePresence>
        {isActive && navigating && !spotlightRect && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center"
          >
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
