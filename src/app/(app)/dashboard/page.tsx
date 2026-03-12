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
  Radio,
  ExternalLink,
  Dumbbell,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, ProgressBar, StreakBadge, BadgePill } from '@/components/ui'
import { getGreeting, formatDuration } from '@/lib/utils'
import type { Profile, DailyInspiration, LiveSession } from '@/types/database'
import { DEMO_PROFILE } from '@/lib/demo-data'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface FeaturedCard {
  title: string
  description: string
  url: string
  image: string | null
}

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' as const },
  }),
}

export default function DashboardPage() {
  const router = useRouter()
  const { profile, setProfile } = useAuthStore()
  const [inspiration, setInspiration] = useState<DailyInspiration | null>(null)
  const [nextLive, setNextLive] = useState<LiveSession | null>(null)
  const [featured, setFeatured] = useState<FeaturedCard | null>(null)
  const [iosPrompt, setIosPrompt] = useState(false)

  function openExternal(url: string) {
    const isIosPwa = (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isIosPwa) {
      navigator.clipboard.writeText(url).catch(() => {})
      setIosPrompt(true)
      setTimeout(() => setIosPrompt(false), 4000)
    } else {
      const a = document.createElement('a')
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    }
  }

  useEffect(() => {
    const supabase = createClient()

    async function loadData() {
      if (!isSupabaseConfigured()) {
        setProfile(DEMO_PROFILE)
        setFeatured({
          title: 'Programme Hebdo',
          description: 'Un nouveau programme chaque semaine pour progresser à ton rythme.',
          url: 'https://vod.marjoriejamin.com/programs/programmehebdo?category_id=233117',
          image: null,
        })
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (profileData) {
        setProfile(profileData as Profile)
      } else {
        router.replace('/onboarding')
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: inspirationData } = await supabase
        .from('daily_inspirations').select('*').eq('display_date', today).single()
      if (inspirationData) setInspiration(inspirationData as DailyInspiration)

      const { data: liveData } = await supabase
        .from('live_sessions').select('*')
        .eq('is_cancelled', false)
        .eq('is_collective', true)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1).single()
      if (liveData) setNextLive(liveData as LiveSession)

      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['featured_title', 'featured_description', 'featured_url', 'featured_image'])
      if (settings && settings.length > 0) {
        const get = (k: string) => settings.find((s: { key: string; value: string | null }) => s.key === k)?.value ?? null
        const url = get('featured_url')
        if (url) {
          setFeatured({
            title: get('featured_title') || 'Programme Hebdo',
            description: get('featured_description') || '',
            url,
            image: get('featured_image'),
          })
        }
      }
    }

    loadData()
  }, [setProfile, router])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse-soft text-text-secondary">Chargement de ton espace...</div>
      </div>
    )
  }

  const weeklyProgress = Math.min(100, (profile.total_sessions / Math.max(1, profile.weekly_rhythm)) * 100)

  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-5xl mx-auto">

      {/* iOS PWA prompt */}
      {iosPrompt && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-[#2C2C2C] text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3">
          <span className="text-xl">📋</span>
          <div className="flex-1">
            <p className="text-sm font-medium">Lien copié !</p>
            <p className="text-xs text-white/70 mt-0.5">Ouvre <strong>Safari</strong> et colle le lien.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl lg:text-3xl text-text leading-snug">
          {getGreeting(profile.username)}
        </h1>
        <div className="flex items-center gap-4 mt-3 max-w-sm">
          <StreakBadge count={profile.current_streak} />
          <div className="flex-1">
            <ProgressBar value={weeklyProgress} size="sm" color="success" />
            <p className="text-xs text-text-muted mt-1">
              Cette semaine : {Math.min(profile.total_sessions, profile.weekly_rhythm)}/{profile.weekly_rhythm} sessions
            </p>
          </div>
        </div>
      </motion.div>

      {/* Desktop: 2-col grid / Mobile: single col */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-4 lg:space-y-0">

        {/* ── LEFT COLUMN (2/3) ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Next live */}
          {nextLive && (
            <motion.div initial="hidden" animate="visible" custom={1} variants={fadeInUp}>
              <Link href="/cours">
                <Card hover className="bg-primary/5 border-primary/20 lg:p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#C6684F]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Radio size={20} className="text-[#C6684F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <BadgePill variant="accent">Prochain live collectif</BadgePill>
                      </div>
                      <h3 className="font-[family-name:var(--font-heading)] text-lg lg:text-xl text-text">
                        {nextLive.title}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1 capitalize">
                        {format(new Date(nextLive.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                        &nbsp;&bull;&nbsp;{nextLive.duration_minutes} min
                      </p>
                      {nextLive.equipment && (
                        <p className="text-xs text-text-muted mt-1">Matériel : {nextLive.equipment}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-text-muted flex-shrink-0 mt-1" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          )}

          {/* Programme Hebdo */}
          {featured && (
            <motion.div initial="hidden" animate="visible" custom={2} variants={fadeInUp}>
              <button onClick={() => openExternal(featured.url)} className="w-full text-left">
                <Card hover className="relative overflow-hidden p-0 lg:p-0">
                  {featured.image ? (
                    <div className="flex flex-col sm:flex-row">
                      <div className="relative w-full sm:w-40 lg:w-48 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={featured.image}
                          alt={featured.title}
                          className="w-full h-36 sm:h-full object-cover rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none"
                        />
                      </div>
                      <div className="flex-1 p-4 lg:p-5 flex flex-col justify-between">
                        <div>
                          <BadgePill variant="accent">
                            <Dumbbell size={12} />
                            Programme de la semaine
                          </BadgePill>
                          <h3 className="font-[family-name:var(--font-heading)] text-xl lg:text-2xl mt-2 text-text">{featured.title}</h3>
                          {featured.description && (
                            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{featured.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#C6684F]">
                          Accéder <ExternalLink size={11} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 lg:p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="flex items-start justify-between relative">
                        <div>
                          <BadgePill variant="accent">
                            <Dumbbell size={12} />
                            Programme de la semaine
                          </BadgePill>
                          <h3 className="font-[family-name:var(--font-heading)] text-xl lg:text-2xl mt-2 text-text">{featured.title}</h3>
                          {featured.description && (
                            <p className="text-sm text-text-secondary mt-1">{featured.description}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#C6684F]">
                            Accéder sur Uscreen <ExternalLink size={11} />
                          </div>
                        </div>
                        <div className="mt-2 w-11 h-11 bg-primary rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                          <ExternalLink size={18} className="text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </button>
            </motion.div>
          )}

          {/* Community */}
          <motion.div initial="hidden" animate="visible" custom={4} variants={fadeInUp}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-[family-name:var(--font-heading)] text-lg text-text">Communauté</h2>
              <Link href="/communaute" className="text-sm text-primary font-medium flex items-center gap-1">
                Voir tout <ChevronRight size={14} />
              </Link>
            </div>
            <Link href="/communaute">
              <Card hover className="lg:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-success-light rounded-full flex items-center justify-center flex-shrink-0">
                    <Users size={20} className="text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-text text-sm">Rejoins la communauté</p>
                    <p className="text-xs text-text-secondary">Partage ton expérience et inspire les autres</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-text-muted" />
                </div>
              </Card>
            </Link>
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN (1/3) ── */}
        <div className="space-y-4">

          {/* Stats */}
          <motion.div initial="hidden" animate="visible" custom={1.5} variants={fadeInUp}>
            <h2 className="font-[family-name:var(--font-heading)] text-lg text-text mb-3">Ton parcours</h2>
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
              <Card padding="sm" className="lg:flex lg:items-center lg:gap-4 text-center lg:text-left">
                <Trophy size={22} className="mx-auto lg:mx-0 text-alert mb-1 lg:mb-0 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-text">{profile.total_sessions}</p>
                  <p className="text-xs text-text-muted">sessions</p>
                </div>
              </Card>
              <Card padding="sm" className="lg:flex lg:items-center lg:gap-4 text-center lg:text-left">
                <Clock size={22} className="mx-auto lg:mx-0 text-primary mb-1 lg:mb-0 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-text">{formatDuration(profile.total_practice_minutes)}</p>
                  <p className="text-xs text-text-muted">de pratique</p>
                </div>
              </Card>
              <Card padding="sm" className="lg:flex lg:items-center lg:gap-4 text-center lg:text-left">
                <Sparkles size={22} className="mx-auto lg:mx-0 text-success mb-1 lg:mb-0 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-text">{profile.longest_streak}</p>
                  <p className="text-xs text-text-muted">meilleure série</p>
                </div>
              </Card>
            </div>
          </motion.div>

          {/* Inspiration */}
          <motion.div initial="hidden" animate="visible" custom={2.5} variants={fadeInUp}>
            <Card className="bg-primary/5 border-primary/10 lg:p-5">
              <p className="font-[family-name:var(--font-heading)] text-base lg:text-lg italic text-text leading-relaxed">
                {inspiration?.quote || '"Chaque mouvement conscient est une déclaration d\'amour envers toi-même."'}
              </p>
              <p className="text-sm text-text-secondary mt-2">— Marjorie, MJ Pilates</p>
              {inspiration?.tip && (
                <div className="mt-3 pt-3 border-t border-primary/10">
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium text-primary">Conseil : </span>
                    {inspiration.tip}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
