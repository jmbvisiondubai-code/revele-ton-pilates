'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Flame, Check, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Milestones for the streak system
const MILESTONES = [7, 14, 30, 60, 90, 120, 180, 365]

function getNextMilestone(current: number) {
  for (const m of MILESTONES) {
    if (current < m) return m
  }
  return Math.ceil(current / 100) * 100 + 100 // Beyond 365: next 100
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return "C'est le moment de commencer ta série ! Ajoute ta première session aujourd'hui."
  if (streak < 7) return "Chaque jour compte. Continue comme ça, tu construis une belle habitude."
  if (streak < 14) return "Une semaine de régularité, c'est déjà une victoire. Tu es sur la bonne voie."
  if (streak < 30) return "Deux semaines de pratique, ton corps commence vraiment à changer. Ne lâche rien."
  if (streak < 60) return "Un mois de Pilates régulier ! Ton corps te remercie. La transformation est en cours."
  if (streak < 90) return "Tu fais preuve d'une discipline remarquable. Le Pilates fait désormais partie de toi."
  if (streak < 180) return "Trois mois de régularité. Tu es une vraie Pilates addict, et c'est magnifique."
  if (streak < 365) return "Ta constance est inspirante. Tu es un modèle de persévérance."
  return "Un an de pratique ! Tu as atteint un niveau de maîtrise exceptionnel. Bravo."
}

function getFlameColor(streak: number): string {
  if (streak < 7) return '#C6684F'
  if (streak < 30) return '#E8723A'
  if (streak < 90) return '#F59E0B'
  return '#EF4444'
}

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
}

export default function SeriePage() {
  const router = useRouter()
  const { profile } = useAuthStore()

  useEffect(() => {
    if (!profile) router.replace('/dashboard')
  }, [profile, router])

  if (!profile) return null

  const streak = profile.current_streak
  const bestStreak = profile.longest_streak
  const nextMilestone = getNextMilestone(streak)
  const milestoneProgress = Math.min(100, (streak / nextMilestone) * 100)
  const daysLeft = nextMilestone - streak
  const flameColor = getFlameColor(streak)

  // Build week days
  const weekDays = (() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    const labels = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
    return labels.map((label, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const isToday = d.toDateString() === now.toDateString()
      const isPast = d < now && !isToday
      return { label, isToday, isPast }
    })
  })()

  // Calculate streak start date
  const streakStart = new Date()
  streakStart.setDate(streakStart.getDate() - streak)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1D1D1F] to-[#2C2C2C]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center">
          <ArrowLeft size={22} className="text-white" />
        </button>
        <h1 className="text-[13px] font-bold tracking-[0.15em] uppercase text-white">Série de jours</h1>
        <div className="w-10" />
      </div>

      <div className="px-5 pb-10">
        {/* Big flame + counter */}
        <motion.div initial="hidden" animate="visible" custom={0} variants={fadeIn} className="text-center pt-4 pb-8">
          {/* Flame glow */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: `${flameColor}20` }} />
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame size={80} className="relative" style={{ color: flameColor }} strokeWidth={1.5} />
            </motion.div>
          </div>

          {/* Big number */}
          <motion.p
            className="text-[72px] font-bold text-white leading-none"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          >
            {streak}
          </motion.p>
          <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#AEAEB2] mt-2">
            Série de jours
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div initial="hidden" animate="visible" custom={1} variants={fadeIn} className="mb-8">
          <div className="flex items-center justify-center gap-0 text-center">
            <div className="flex-1 border-r border-white/10 py-2">
              <p className="text-[14px] font-bold text-white">
                {streak > 0 ? format(streakStart, 'd MMM yyyy', { locale: fr }) : '—'}
              </p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">Série commencée</p>
            </div>
            <div className="flex-1 py-2">
              <p className="text-[14px] font-bold text-white">{bestStreak}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">Série maximale</p>
            </div>
          </div>
        </motion.div>

        {/* This week */}
        <motion.div initial="hidden" animate="visible" custom={2} variants={fadeIn} className="mb-6">
          <div className="rounded-2xl bg-white/[0.07] border border-white/[0.08] px-4 py-5">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#AEAEB2] mb-4">Cette semaine</p>
            <div className="flex items-center justify-between">
              {weekDays.map((day) => (
                <div key={day.label} className="flex flex-col items-center gap-2.5">
                  <span className={`text-[10px] font-bold tracking-wider ${day.isToday ? 'text-white' : 'text-[#AEAEB2]'}`}>
                    {day.label}
                  </span>
                  <div className="w-9 h-9 flex items-center justify-center">
                    {day.isPast ? (
                      <Flame size={24} style={{ color: flameColor }} />
                    ) : day.isToday ? (
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Flame size={26} style={{ color: flameColor }} />
                      </motion.div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/15" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Next milestone */}
        <motion.div initial="hidden" animate="visible" custom={3} variants={fadeIn} className="mb-6">
          <div className="rounded-2xl bg-white/[0.07] border border-white/[0.08] p-5">
            <div className="flex items-center justify-between mb-4">
              {/* Current */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-3 flex items-center justify-center mb-1.5" style={{ borderColor: flameColor, borderWidth: 3 }}>
                  <Flame size={22} style={{ color: flameColor }} />
                </div>
                <span className="text-[18px] font-bold text-white">{streak}</span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 mx-4">
                <p className="text-[12px] text-center text-[#AEAEB2] mb-2">
                  Il te reste <span className="text-white font-bold">{daysLeft} jours</span>
                </p>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: flameColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${milestoneProgress}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                  />
                </div>
                <p className="text-[11px] text-[#AEAEB2] text-center mt-1.5">
                  pour débloquer ton prochain objectif
                </p>
              </div>

              {/* Next milestone */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-3 border-white/15 flex items-center justify-center mb-1.5" style={{ borderWidth: 3 }}>
                  <Target size={22} className="text-white/30" />
                </div>
                <span className="text-[18px] font-bold text-white/40">{nextMilestone}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Milestones achieved */}
        <motion.div initial="hidden" animate="visible" custom={4} variants={fadeIn} className="mb-6">
          <div className="rounded-2xl bg-white/[0.07] border border-white/[0.08] p-5">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#AEAEB2] mb-4">Objectifs atteints</p>
            <div className="flex flex-wrap gap-3">
              {MILESTONES.filter(m => m <= streak).map((m) => (
                <div key={m} className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <Check size={12} className="text-[#34C759]" />
                  <span className="text-[12px] font-bold text-white">{m} jours</span>
                </div>
              ))}
              {MILESTONES.filter(m => m <= streak).length === 0 && (
                <p className="text-[12px] text-[#AEAEB2]">Aucun objectif atteint pour le moment</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Motivational message */}
        <motion.div initial="hidden" animate="visible" custom={5} variants={fadeIn}>
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.06] p-5">
            <p className="text-[14px] font-semibold text-white leading-relaxed">
              {getStreakMessage(streak)}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
