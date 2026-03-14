'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Flame, Check, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const MILESTONES = [7, 14, 30, 60, 90, 120, 180, 365]

function getNextMilestone(current: number) {
  for (const m of MILESTONES) {
    if (current < m) return m
  }
  return Math.ceil(current / 100) * 100 + 100
}

function getStreakMessage(streak: number): string {
  if (streak === 0) return "C'est le moment de commencer ta série ! Ajoute ta première session aujourd'hui."
  if (streak < 7) return "Chaque jour compte. Continue comme ça, tu construis une belle habitude."
  if (streak < 14) return "Une semaine de régularité, c'est déjà une victoire. Tu es sur la bonne voie."
  if (streak < 30) return "Deux semaines de pratique, ton corps commence vraiment à changer. Ne lâche rien."
  if (streak < 60) return "Un mois de Pilates régulier ! Ton corps te remercie. La transformation est en cours."
  if (streak < 90) return "Tu fais preuve d'une discipline remarquable. Le Pilates fait désormais partie de toi."
  if (streak < 180) return "Trois mois de régularité. Tu es une vraie passionnée, et c'est magnifique."
  if (streak < 365) return "Ta constance est inspirante. Tu es un modèle de persévérance."
  return "Un an de pratique ! Tu as atteint un niveau de maîtrise exceptionnel. Bravo."
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

  // Build week days
  const weekDays = (() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    const weekLabels = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
    return weekLabels.map((label, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const isToday = d.toDateString() === now.toDateString()
      const isPast = d < now && !isToday
      return { label, isToday, isPast }
    })
  })()

  const streakStart = new Date()
  streakStart.setDate(streakStart.getDate() - streak)

  return (
    <div className="min-h-screen bg-[#FAF6F1]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#E8DDD4]/50 transition-colors">
          <ArrowLeft size={20} className="text-[#1D1D1F]" />
        </button>
        <h1 className="text-[13px] font-bold tracking-[0.12em] uppercase text-[#86868B]">Ma série</h1>
        <div className="w-10" />
      </div>

      <div className="px-5 pb-10 max-w-2xl mx-auto">

        {/* Big flame + counter */}
        <motion.div initial="hidden" animate="visible" custom={0} variants={fadeIn} className="text-center pt-6 pb-10">
          <div className="relative inline-flex items-center justify-center mb-5">
            {streak >= 7 ? (
              <>
                {/* Warm ambient glow */}
                <motion.div
                  className="absolute w-40 h-40 rounded-full bg-[#E8500E]/8 blur-3xl"
                  animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.06, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Stacked flame layers — Whoop style */}
                <motion.div
                  className="relative"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {/* Outer flame — large, red-orange */}
                  <Flame size={88} className="relative text-[#E85D2A]" strokeWidth={1.2} />

                  {/* Mid flame — warm orange, offset up */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Flame size={60} className="text-[#FF8A3A] mt-1" strokeWidth={1.3} />
                  </motion.div>

                  {/* Inner core — yellow-white, smaller */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ y: [0, -3, 0], scale: [1, 1.04, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Flame size={36} className="text-[#FFD36E] mt-3" strokeWidth={1.5} />
                  </motion.div>

                  {/* Embers floating up */}
                  {[
                    { left: '25%', delay: 0, dur: 2.8 },
                    { left: '55%', delay: 0.9, dur: 3.2 },
                    { left: '72%', delay: 1.8, dur: 2.5 },
                  ].map((e, i) => (
                    <motion.span
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-[#FF8A3A]"
                      style={{ left: e.left, top: '15%' }}
                      animate={{
                        y: [0, -30, -50],
                        x: [0, (i % 2 === 0 ? 6 : -6), (i % 2 === 0 ? 10 : -10)],
                        opacity: [0, 0.8, 0],
                      }}
                      transition={{ duration: e.dur, repeat: Infinity, delay: e.delay, ease: 'easeOut' }}
                    />
                  ))}
                </motion.div>
              </>
            ) : (
              <>
                <div className="absolute w-28 h-28 rounded-full blur-3xl bg-[#C6684F]/10" />
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Flame size={72} className="relative text-[#C6684F]" strokeWidth={1.5} />
                </motion.div>
              </>
            )}
          </div>

          <motion.p
            className="text-[64px] font-bold text-[#1D1D1F] leading-none font-[family-name:var(--font-heading)]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          >
            {streak}
          </motion.p>
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#9B8E82] mt-2">
            {streak >= 7 ? 'série de jours' : 'jours de suite'}
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div initial="hidden" animate="visible" custom={1} variants={fadeIn} className="mb-8">
          <div className="rounded-2xl bg-white border border-[#E8DDD4] overflow-hidden">
            <div className="flex text-center divide-x divide-[#F0EBE5]">
              <div className="flex-1 py-4">
                <p className="text-[15px] font-bold text-[#1D1D1F]">
                  {streak > 0 ? format(streakStart, 'd MMM yyyy', { locale: fr }) : '—'}
                </p>
                <p className="text-[11px] text-[#9B8E82] mt-0.5">Série commencée</p>
              </div>
              <div className="flex-1 py-4">
                <p className="text-[15px] font-bold text-[#1D1D1F]">{bestStreak}</p>
                <p className="text-[11px] text-[#9B8E82] mt-0.5">Série maximale</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* This week */}
        <motion.div initial="hidden" animate="visible" custom={2} variants={fadeIn} className="mb-8">
          <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Cette semaine</h2>
          <div className="rounded-2xl bg-white border border-[#E8DDD4] px-4 py-5">
            <div className="flex items-center justify-between">
              {weekDays.map((day) => (
                <div key={day.label} className="flex flex-col items-center gap-2.5">
                  <span className={`text-[10px] font-bold tracking-wider ${day.isToday ? 'text-[#C6684F]' : 'text-[#AEAEB2]'}`}>
                    {day.label}
                  </span>
                  <div className="w-9 h-9 flex items-center justify-center">
                    {day.isPast ? (
                      <Flame size={24} className="text-[#C6684F]" />
                    ) : day.isToday ? (
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Flame size={26} className="text-[#C6684F]" />
                      </motion.div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-[#E8DDD4]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Next milestone */}
        <motion.div initial="hidden" animate="visible" custom={3} variants={fadeIn} className="mb-8">
          <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Prochain objectif</h2>
          <div className="rounded-2xl bg-white border border-[#E8DDD4] p-5">
            <div className="flex items-center gap-4">
              {/* Current */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-14 h-14 rounded-full border-[3px] border-[#C6684F] flex items-center justify-center mb-1">
                  <Flame size={22} className="text-[#C6684F]" />
                </div>
                <span className="text-[16px] font-bold text-[#1D1D1F]">{streak}</span>
              </div>

              {/* Progress */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#9B8E82] mb-2">
                  Encore <span className="text-[#1D1D1F] font-bold">{daysLeft} jours</span> pour atteindre {nextMilestone} jours
                </p>
                <div className="h-2.5 bg-[#F0EBE5] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#C6684F]"
                    initial={{ width: 0 }}
                    animate={{ width: `${milestoneProgress}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                  />
                </div>
              </div>

              {/* Next */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-14 h-14 rounded-full border-[3px] border-[#E8DDD4] flex items-center justify-center mb-1">
                  <Target size={22} className="text-[#D1CCC5]" />
                </div>
                <span className="text-[16px] font-bold text-[#D1CCC5]">{nextMilestone}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Milestones achieved */}
        <motion.div initial="hidden" animate="visible" custom={4} variants={fadeIn} className="mb-8">
          <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Objectifs atteints</h2>
          <div className="rounded-2xl bg-white border border-[#E8DDD4] p-5">
            {MILESTONES.filter(m => m <= streak).length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {MILESTONES.filter(m => m <= streak).map((m) => (
                  <div key={m} className="flex items-center gap-1.5 bg-[#E8F5E8] rounded-full px-3.5 py-2">
                    <Check size={13} className="text-[#34C759]" strokeWidth={2.5} />
                    <span className="text-[13px] font-bold text-[#1D1D1F]">{m} jours</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-[13px] text-[#9B8E82]">Tes premiers objectifs arrivent bientôt !</p>
                <p className="text-[12px] text-[#D1CCC5] mt-1">Prochain palier : {nextMilestone} jours</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Motivational message */}
        <motion.div initial="hidden" animate="visible" custom={5} variants={fadeIn}>
          <div className="rounded-2xl bg-gradient-to-br from-[#FDF8F5] to-[#FAF6F1] border border-[#E8DDD4] p-5">
            <p className="text-[14px] font-[family-name:var(--font-heading)] text-[#1D1D1F] leading-relaxed italic">
              "{getStreakMessage(streak)}"
            </p>
            <p className="text-[12px] text-[#9B8E82] mt-2 font-medium">— Marjorie</p>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
