'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Clock,
  Trophy,
  ChevronRight,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, ProgressBar, StreakBadge, BadgePill } from '@/components/ui'
import { getGreeting, formatDuration } from '@/lib/utils'
import type { Profile, DailyInspiration, LiveSession } from '@/types/database'
import { DEMO_PROFILE } from '@/lib/demo-data'
import Link from 'next/link'

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' as const },
  }),
}

export default function DashboardPage() {
  const router = useRouter()
  const { profile, setProfile } = useAuthStore()
  const [inspiration, setInspiration] = useState<DailyInspiration | null>(null)
  const [nextLive, setNextLive] = useState<LiveSession | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadData() {
      if (!isSupabaseConfigured()) {
        setProfile(DEMO_PROFILE)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (profileData) {
        setProfile(profileData as Profile)
      } else {
        // No profile yet → go to onboarding
        router.replace('/onboarding')
        return
      }

      // Load today's inspiration
      const today = new Date().toISOString().split('T')[0]
      const { data: inspirationData } = await supabase
        .from('daily_inspirations').select('*').eq('display_date', today).single()
      if (inspirationData) setInspiration(inspirationData as DailyInspiration)

      // Load next live session
      const { data: liveData } = await supabase
        .from('live_sessions').select('*')
        .eq('is_cancelled', false)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1).single()
      if (liveData) setNextLive(liveData as LiveSession)
    }

    loadData()
  }, [setProfile, router])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse-soft text-text-secondary">
          Chargement de ton espace...
        </div>
      </div>
    )
  }

  const weeklyProgress = Math.min(
    100,
    (profile.total_sessions / Math.max(1, profile.weekly_rhythm)) * 100
  )

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      {/* Greeting */}
      <motion.div
        initial="hidden"
        animate="visible"
        custom={0}
        variants={fadeInUp}
      >
        <h1 className="font-[family-name:var(--font-heading)] text-2xl text-text leading-snug">
          {getGreeting(profile.first_name)}
        </h1>
        <div className="flex items-center gap-4 mt-3">
          <StreakBadge count={profile.current_streak} />
          <div className="flex-1">
            <ProgressBar
              value={weeklyProgress}
              size="sm"
              color="success"
            />
            <p className="text-xs text-text-muted mt-1">
              Cette semaine : {Math.min(profile.total_sessions, profile.weekly_rhythm)}/{profile.weekly_rhythm} sessions
            </p>
          </div>
        </div>
      </motion.div>

      {/* Next session */}
      <motion.div
        initial="hidden"
        animate="visible"
        custom={1}
        variants={fadeInUp}
      >
        <Card hover className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between relative">
            <div>
              <BadgePill variant="accent">
                <Calendar size={12} />
                Prochaine session
              </BadgePill>
              <h3 className="font-[family-name:var(--font-heading)] text-xl mt-2 text-text">
                Pilates Fondamentaux
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Renforcement doux &bull; 30 min
              </p>
            </div>
            <Link
              href="/cours"
              className="mt-2 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-sm"
            >
              <ChevronRight size={20} className="text-white" />
            </Link>
          </div>
        </Card>
      </motion.div>

      {/* Next Live */}
      {nextLive && (
        <motion.div
          initial="hidden"
          animate="visible"
          custom={1.5}
          variants={fadeInUp}
        >
          <Link href="/cours">
            <Card hover className="bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Video size={16} className="text-primary" />
                <BadgePill variant="accent">Live à venir</BadgePill>
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-lg text-text">
                {nextLive.title}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                {new Date(nextLive.scheduled_at).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })} &bull; {nextLive.duration_minutes} min
              </p>
              {nextLive.max_participants && (
                <p className="text-xs text-text-muted mt-1">
                  {nextLive.registered_count}/{nextLive.max_participants} places réservées
                </p>
              )}
            </Card>
          </Link>
        </motion.div>
      )}

      {/* Stats summary */}
      <motion.div
        initial="hidden"
        animate="visible"
        custom={2}
        variants={fadeInUp}
      >
        <h2 className="font-[family-name:var(--font-heading)] text-lg text-text mb-3">
          Ton parcours
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Card padding="sm" className="text-center">
            <Trophy size={20} className="mx-auto text-alert mb-1" />
            <p className="text-2xl font-bold text-text">
              {profile.total_sessions}
            </p>
            <p className="text-xs text-text-muted">sessions</p>
          </Card>
          <Card padding="sm" className="text-center">
            <Clock size={20} className="mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-text">
              {formatDuration(profile.total_practice_minutes)}
            </p>
            <p className="text-xs text-text-muted">de pratique</p>
          </Card>
          <Card padding="sm" className="text-center">
            <Sparkles size={20} className="mx-auto text-success mb-1" />
            <p className="text-2xl font-bold text-text">
              {profile.longest_streak}
            </p>
            <p className="text-xs text-text-muted">meilleure série</p>
          </Card>
        </div>
      </motion.div>

      {/* Inspiration */}
      <motion.div
        initial="hidden"
        animate="visible"
        custom={3}
        variants={fadeInUp}
      >
        <Card className="bg-primary/5 border-primary/10">
          <p className="font-[family-name:var(--font-heading)] text-lg italic text-text leading-relaxed">
            {inspiration?.quote ||
              '"Chaque mouvement conscient est une déclaration d\'amour envers toi-même."'}
          </p>
          <p className="text-sm text-text-secondary mt-2">
            — Marjorie, MJ Pilates
          </p>
          {(inspiration?.tip) && (
            <div className="mt-3 pt-3 border-t border-primary/10">
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-primary">Conseil : </span>
                {inspiration.tip}
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Community preview */}
      <motion.div
        initial="hidden"
        animate="visible"
        custom={4}
        variants={fadeInUp}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[family-name:var(--font-heading)] text-lg text-text">
            Communauté
          </h2>
          <Link
            href="/communaute"
            className="text-sm text-primary font-medium flex items-center gap-1"
          >
            Voir tout <ChevronRight size={14} />
          </Link>
        </div>
        <Card hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success-light rounded-full flex items-center justify-center">
              <Users size={18} className="text-success" />
            </div>
            <div>
              <p className="font-medium text-text text-sm">
                Rejoins la communauté
              </p>
              <p className="text-xs text-text-secondary">
                Partage ton expérience et inspire les autres
              </p>
            </div>
            <ChevronRight size={16} className="ml-auto text-text-muted" />
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
