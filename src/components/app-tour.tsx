'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'

type TourStep = {
  target: string // data-tour attribute value
  title: string
  description: string
  emoji: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'nav-accueil',
    title: 'Ton tableau de bord',
    description: 'Retrouve ici ta progression, tes prochaines séances et l\'inspiration du jour.',
    emoji: '🏠',
    position: 'top',
  },
  {
    target: 'nav-cours',
    title: 'Tes cours de Pilates',
    description: 'Accède à tous les cours vidéo et aux sessions live avec Marjorie.',
    emoji: '🎬',
    position: 'top',
  },
  {
    target: 'nav-menu',
    title: 'Menu rapide',
    description: 'Appuie ici pour enregistrer une séance ou consulter ton suivi de progression.',
    emoji: '✨',
    position: 'top',
  },
  {
    target: 'nav-social',
    title: 'La communauté',
    description: 'Échange avec les autres clientes, partage tes réussites et encourage-toi mutuellement.',
    emoji: '💬',
    position: 'top',
  },
  {
    target: 'nav-articles',
    title: 'Les articles',
    description: 'Des conseils bien-être, nutrition et pratique sélectionnés par Marjorie.',
    emoji: '📖',
    position: 'top',
  },
  {
    target: 'nav-messages',
    title: 'Tes messages privés',
    description: 'Discute directement avec Marjorie. Elle t\'a déjà envoyé un petit message de bienvenue !',
    emoji: '💌',
    position: 'bottom',
  },
  {
    target: 'nav-profil',
    title: 'Ton profil',
    description: 'Personnalise ton espace, consulte tes badges et gère tes préférences.',
    emoji: '👤',
    position: 'bottom',
  },
]

export function AppTour() {
  const { profile, setProfile } = useAuthStore()
  const [showWelcome, setShowWelcome] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1) // -1 = not started
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const isActive = currentStep >= 0 && currentStep < TOUR_STEPS.length

  // Show welcome on first visit
  useEffect(() => {
    if (!profile) return
    if (profile.is_admin) return
    if (profile.has_seen_tour) return
    if (!profile.onboarding_completed) return
    // Small delay so the dashboard renders first
    const timer = setTimeout(() => setShowWelcome(true), 1200)
    return () => clearTimeout(timer)
  }, [profile])

  // Position spotlight and tooltip
  const positionElements = useCallback(() => {
    if (!isActive) return
    const step = TOUR_STEPS[currentStep]
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
    if (!el) return

    const rect = el.getBoundingClientRect()
    setSpotlightRect(rect)

    const padding = 12
    const tooltipWidth = Math.min(300, window.innerWidth - 32)
    const style: React.CSSProperties = { width: tooltipWidth }

    if (step.position === 'top') {
      // Tooltip above element
      style.bottom = window.innerHeight - rect.top + padding
      style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16))
    } else if (step.position === 'bottom') {
      // Tooltip below element
      style.top = rect.bottom + padding
      style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16))
    }

    setTooltipStyle(style)
  }, [currentStep, isActive])

  useEffect(() => {
    positionElements()
    window.addEventListener('resize', positionElements)
    window.addEventListener('scroll', positionElements, true)
    return () => {
      window.removeEventListener('resize', positionElements)
      window.removeEventListener('scroll', positionElements, true)
    }
  }, [positionElements])

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
    markTourSeen()
  }

  function nextStep() {
    if (currentStep >= TOUR_STEPS.length - 1) {
      finishTour()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep(prev => prev - 1)
  }

  function finishTour() {
    setCurrentStep(-1)
    setSpotlightRect(null)
    markTourSeen()
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
                {/* Header illustration */}
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
                  <p className="text-white/80 text-sm">
                    Ton espace Pilates est prêt
                  </p>
                </div>

                {/* Content */}
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
                      x={spotlightRect.left - 6}
                      y={spotlightRect.top - 6}
                      width={spotlightRect.width + 12}
                      height={spotlightRect.height + 12}
                      rx={12}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%" height="100%"
                  fill="rgba(0,0,0,0.55)"
                  mask="url(#spotlight-mask)"
                />
              </svg>

              {/* Spotlight border glow */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute rounded-xl border-2 border-[#C6684F] shadow-[0_0_20px_rgba(198,104,79,0.4)]"
                style={{
                  left: spotlightRect.left - 6,
                  top: spotlightRect.top - 6,
                  width: spotlightRect.width + 12,
                  height: spotlightRect.height + 12,
                }}
              />
            </motion.div>

            {/* Tooltip */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: step.position === 'top' ? 10 : -10 }}
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
                      {currentStep >= TOUR_STEPS.length - 1 ? 'Terminer' : 'Suivant'}
                      {currentStep < TOUR_STEPS.length - 1 && <ChevronRight size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
