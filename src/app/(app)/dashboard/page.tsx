'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  CalendarClock,
  Clock,
  Trophy,
  ChevronRight,
  Sparkles,
  Users,
  Radio,
  ExternalLink,
  Dumbbell,
  Play,
  Copy,
  Check,
  Video,
  MessageCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useDataCache, isCacheValid } from '@/stores/data-cache'
import { Card, ProgressBar, StreakBadge, BadgePill } from '@/components/ui'
import { AddToCalendar } from '@/components/add-to-calendar'
import { getGreeting, formatDuration, formatSubscriptionRemaining } from '@/lib/utils'
import type { Profile, DailyInspiration, LiveSession, LiveSessionType, PrivateAppointment } from '@/types/database'

const SESSION_TYPE_LABELS: Record<LiveSessionType, string> = {
  collectif: 'Prochain cours collectif',
  masterclass: 'Prochaine masterclass',
  faq: 'Prochaine session FAQ',
  atelier: 'Prochain atelier',
  autre: 'Prochain live',
}
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

function getApptCalendarUrl(appt: PrivateAppointment) {
  const start = new Date(appt.scheduled_at)
  const end = new Date(start.getTime() + appt.duration_minutes * 60000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const details = [appt.description, appt.meeting_url ? `Lien visio : ${appt.meeting_url}` : ''].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `RDV privé — ${appt.title}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  })
  if (appt.meeting_url) params.set('location', appt.meeting_url)
  return `https://calendar.google.com/calendar/render?${params}`
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
  const cache = useDataCache()
  const [codeCopied, setCodeCopied] = useState(false)

  // Use cached data or local state
  const inspiration = cache.inspiration
  const nextLive = cache.nextLive
  const featured = cache.featured
  const replayUrl = cache.replayUrl
  const replayCode = cache.replayCode
  const replayImage = cache.replayImage
  const privateAppt = cache.privateAppt
  const unreadMsg = cache.unreadMsg

  function openExternal(url: string) {
    const a = document.createElement('a')
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  useEffect(() => {
    // Skip if cache is still valid
    if (isCacheValid(cache.dashboardLoadedAt) && profile) return

    const supabase = createClient()

    async function loadData() {
      if (!isSupabaseConfigured()) {
        setProfile(DEMO_PROFILE)
        cache.setDashboardData({
          featured: {
            title: 'Programme Hebdo',
            description: 'Un nouveau programme chaque semaine pour progresser à ton rythme.',
            url: 'https://vod.marjoriejamin.com/programs/programmehebdo?category_id=233117',
            image: null,
          },
        })
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Fetch profile + all data in parallel
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      const [profileRes, inspirationRes, liveRes, apptRes, dmCountRes, settingsRes] = await Promise.all([
        profile ? Promise.resolve({ data: null }) : supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('daily_inspirations').select('*').eq('display_date', today).single(),
        supabase.from('live_sessions').select('*').eq('is_cancelled', false).is('deleted_at', null).gte('scheduled_at', now).order('scheduled_at', { ascending: true }).limit(1).single(),
        supabase.from('private_appointments').select('*').eq('client_id', user.id).is('deleted_at', null).in('status', ['pending', 'confirmed']).gte('scheduled_at', now).order('scheduled_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('direct_messages').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).is('read_at', null),
        supabase.from('app_settings').select('key, value').in('key', ['featured_title', 'featured_description', 'featured_url', 'featured_image', 'vimeo_replay_url', 'vimeo_replay_code', 'vimeo_replay_image']),
      ])

      if (!profile) {
        if (profileRes.data) {
          setProfile(profileRes.data as Profile)
        } else {
          router.replace('/onboarding')
          return
        }
      }

      const cacheUpdate: Record<string, unknown> = {}

      if (inspirationRes.data) cacheUpdate.inspiration = inspirationRes.data
      if (liveRes.data) cacheUpdate.nextLive = liveRes.data
      if (apptRes.data) cacheUpdate.privateAppt = apptRes.data

      // Fetch unread message details only if there are unread messages
      const dmCount = dmCountRes.count ?? 0
      if (dmCount > 0) {
        const [lastMsgRes] = await Promise.all([
          supabase.from('direct_messages').select('content, sender_id').eq('receiver_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(1).single(),
        ])
        let senderName: string | null = null
        if (lastMsgRes.data?.sender_id) {
          const { data: senderProfile } = await supabase.from('profiles').select('first_name').eq('id', lastMsgRes.data.sender_id).single()
          senderName = senderProfile?.first_name ?? null
        }
        cacheUpdate.unreadMsg = { count: dmCount, lastContent: lastMsgRes.data?.content ?? null, senderName }
      }

      // Process settings
      const settings = settingsRes.data
      if (settings && settings.length > 0) {
        const get = (k: string) => settings.find((s: { key: string; value: string | null }) => s.key === k)?.value ?? null
        const url = get('featured_url')
        if (url) {
          cacheUpdate.featured = {
            title: get('featured_title') || 'Programme Hebdo',
            description: get('featured_description') || '',
            url,
            image: get('featured_image'),
          }
        }
        if (get('vimeo_replay_url')) cacheUpdate.replayUrl = get('vimeo_replay_url')
        if (get('vimeo_replay_code')) cacheUpdate.replayCode = get('vimeo_replay_code')
        if (get('vimeo_replay_image')) cacheUpdate.replayImage = get('vimeo_replay_image')
      }

      cache.setDashboardData(cacheUpdate)
    }

    loadData()
  }, [setProfile, router, profile, cache])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse-soft text-text-secondary">Chargement de ton espace...</div>
      </div>
    )
  }

  const weeklyProgress = Math.min(100, (profile.total_sessions / Math.max(1, profile.weekly_rhythm)) * 100)

  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 xl:px-12 lg:pt-8 max-w-6xl mx-auto">

      {/* Header */}
      {(() => {
        const greeting = getGreeting(profile.username)
        return (
          <motion.div data-tour="dashboard-greeting" initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="mb-6 lg:mb-8">
            <p className="text-sm font-medium text-[#C6684F] tracking-wide">{greeting.salut}</p>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl lg:text-4xl text-text leading-snug mt-1">
              {greeting.message}
            </h1>
            <div className="flex items-center gap-4 mt-4 max-w-sm">
              <StreakBadge count={profile.current_streak} />
              <div className="flex-1">
                <ProgressBar value={weeklyProgress} size="sm" color="success" />
                <p className="text-xs text-text-muted mt-1">
                  Cette semaine : {Math.min(profile.total_sessions, profile.weekly_rhythm)}/{profile.weekly_rhythm} sessions
                </p>
              </div>
            </div>
          </motion.div>
        )
      })()}

      {/* Desktop: 2-col grid / Mobile: single col */}
      <div className="lg:grid lg:grid-cols-3 xl:grid-cols-7 lg:gap-6 xl:gap-8 space-y-4 lg:space-y-0">

        {/* ── LEFT COLUMN (2/3) ── */}
        <div className="lg:col-span-2 xl:col-span-4 space-y-4">

          {/* Unread message card */}
          {unreadMsg.count > 0 && (
            <motion.div data-tour="dashboard-unread" initial="hidden" animate="visible" custom={0.5} variants={fadeInUp}>
              <Link href="/messages">
                <div className="relative group rounded-2xl bg-white border border-[#C6684F]/20 hover:border-[#C6684F]/40 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C6684F]" />
                  <div className="flex items-center gap-3 p-4 pl-5">
                    <div className="relative w-10 h-10 bg-[#C6684F]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageCircle size={18} className="text-[#C6684F]" />
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#C6684F] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unreadMsg.count}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#2C2C2C]">
                        {unreadMsg.senderName ? `${unreadMsg.senderName} t'a écrit` : 'Nouveau message'}
                      </p>
                      {unreadMsg.lastContent && (
                        <p className="text-xs text-[#6B6359] truncate mt-0.5">{unreadMsg.lastContent}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-[#DCCFBF] group-hover:text-[#C6684F] flex-shrink-0 transition-colors" />
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Next live — premium elegant card */}
          {nextLive && (
            <motion.div initial="hidden" animate="visible" custom={1} variants={fadeInUp}>
              <Link href="/cours">
                <div className="relative group rounded-2xl bg-white border border-[#C6684F]/25 shadow-[0_2px_20px_rgba(198,104,79,0.08)] hover:shadow-[0_4px_30px_rgba(198,104,79,0.15)] transition-all duration-500 overflow-hidden">
                  {/* Left accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#C6684F] to-[#D4956B]" />
                  {/* Soft decorative glow */}
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#C6684F]/[0.04] rounded-full blur-2xl" />

                  <div className="relative p-5 lg:p-6 pl-6 lg:pl-7">
                    <div className="flex items-start gap-4">
                      {/* Elegant icon */}
                      <div className="relative w-11 h-11 flex-shrink-0">
                        <motion.div
                          className="absolute inset-0 rounded-full border border-[#C6684F]/20"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <div className="relative w-full h-full bg-gradient-to-br from-[#C6684F] to-[#D4956B] rounded-full flex items-center justify-center shadow-sm">
                          <Radio size={18} className="text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#C6684F]">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C6684F] opacity-50" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C6684F]" />
                            </span>
                            {SESSION_TYPE_LABELS[nextLive.session_type] ?? 'Prochain live'}
                          </span>
                        </div>
                        <h3 className="font-[family-name:var(--font-heading)] text-lg lg:text-xl text-[#2C2C2C]">
                          {nextLive.title}
                        </h3>
                        <p className="text-sm text-[#C6684F]/80 mt-1 capitalize font-medium">
                          {format(new Date(nextLive.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                          <span className="text-[#A09488] font-normal">&nbsp;&middot;&nbsp;{nextLive.duration_minutes} min</span>
                        </p>
                        {nextLive.equipment && (
                          <p className="text-xs text-[#A09488] mt-1.5 italic">Matériel : {nextLive.equipment}</p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-[#DCCFBF] group-hover:text-[#C6684F] flex-shrink-0 mt-1 transition-colors duration-300" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Private appointment */}
          {privateAppt && (
            <motion.div initial="hidden" animate="visible" custom={1.5} variants={fadeInUp}>
              <Card className="bg-[#7C3AED]/5 border-[#7C3AED]/20 lg:p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CalendarClock size={20} className="text-[#7C3AED]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <BadgePill variant="accent">RDV privé avec Marjorie</BadgePill>
                    </div>
                    <h3 className="font-[family-name:var(--font-heading)] text-lg lg:text-xl text-text">
                      {privateAppt.title}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1 capitalize">
                      {format(new Date(privateAppt.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                      &nbsp;&bull;&nbsp;{privateAppt.duration_minutes} min
                    </p>
                    {privateAppt.description && (
                      <p className="text-xs text-text-muted mt-1">{privateAppt.description}</p>
                    )}
                    {privateAppt.meeting_url && (
                      <a
                        href={privateAppt.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <Video size={14} />
                        Rejoindre la visio
                      </a>
                    )}
                    {/* Calendar picker */}
                    <div className="mt-3" onClick={e => e.stopPropagation()}>
                      <AddToCalendar
                        event={{
                          title: `RDV privé — ${privateAppt.title}`,
                          description: [privateAppt.description, privateAppt.meeting_url ? `Lien visio : ${privateAppt.meeting_url}` : ''].filter(Boolean).join('\n'),
                          location: privateAppt.meeting_url || undefined,
                          start: new Date(privateAppt.scheduled_at),
                          end: new Date(new Date(privateAppt.scheduled_at).getTime() + privateAppt.duration_minutes * 60000),
                        }}
                        filename="rdv.ics"
                        accent="purple"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Programme Hebdo + Replay — compact row */}
          <motion.div data-tour="dashboard-programmes" initial="hidden" animate="visible" custom={2} variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Programme Hebdo */}
            {featured && (
              <button onClick={() => openExternal(featured.url)} className="w-full text-left">
                <Card hover className="h-full p-0 overflow-hidden">
                  {/* Mobile: horizontal compact */}
                  <div className="flex items-stretch lg:hidden">
                    {featured.image ? (
                      <div className="w-24 flex-shrink-0 rounded-l-2xl overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={featured.image} alt={featured.title} className="w-full h-full object-contain bg-[#F2E8DF]/50" />
                      </div>
                    ) : (
                      <div className="w-16 flex-shrink-0 bg-[#C6684F]/10 flex items-center justify-center">
                        <Dumbbell size={20} className="text-[#C6684F]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{featured.title}</p>
                        <p className="text-xs text-text-secondary truncate">{featured.description || 'Programme de la semaine'}</p>
                      </div>
                      <ExternalLink size={14} className="text-[#C6684F] flex-shrink-0" />
                    </div>
                  </div>
                  {/* Desktop: vertical with large image */}
                  <div className="hidden lg:block">
                    {featured.image ? (
                      <div className="w-full h-36 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={featured.image} alt={featured.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-24 bg-[#C6684F]/10 flex items-center justify-center">
                        <Dumbbell size={28} className="text-[#C6684F]" />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="text-base font-semibold text-text">{featured.title}</p>
                      {featured.description && (
                        <p className="text-sm text-text-secondary mt-1 line-clamp-2">{featured.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#C6684F]">
                        Accéder <ExternalLink size={12} />
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            )}

            {/* Replay */}
            {replayUrl && (
              <button onClick={() => openExternal(replayUrl)} className="w-full text-left">
                <Card hover className="h-full p-0 overflow-hidden border-[#7C3AED]/10 bg-[#7C3AED]/[0.03]">
                  {/* Mobile: horizontal compact */}
                  <div className="flex items-stretch lg:hidden">
                    {replayImage ? (
                      <div className="w-24 flex-shrink-0 rounded-l-2xl overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={replayImage} alt="Replay" className="w-full h-full object-contain bg-[#F2E8DF]/50" />
                      </div>
                    ) : (
                      <div className="w-16 flex-shrink-0 bg-[#7C3AED]/10 flex items-center justify-center">
                        <Play size={20} className="text-[#7C3AED] ml-0.5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text">Replay</p>
                        {replayCode ? (
                          <p className="text-xs text-text-secondary">
                            Mot de passe : <span className="font-mono font-bold text-[#7C3AED]">{replayCode}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-text-secondary">Dernier cours collectif</p>
                        )}
                      </div>
                      {replayCode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(replayCode)
                            setCodeCopied(true)
                            setTimeout(() => setCodeCopied(false), 2000)
                          }}
                          className="p-1.5 rounded-lg bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 transition-colors text-[#7C3AED] flex-shrink-0"
                        >
                          {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                      <ExternalLink size={14} className="text-[#7C3AED] flex-shrink-0" />
                    </div>
                  </div>
                  {/* Desktop: vertical with large image */}
                  <div className="hidden lg:block">
                    {replayImage ? (
                      <div className="w-full h-36 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={replayImage} alt="Replay" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-24 bg-[#7C3AED]/10 flex items-center justify-center">
                        <Play size={28} className="text-[#7C3AED] ml-0.5" />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="text-base font-semibold text-text">Replay</p>
                      {replayCode ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-sm text-text-secondary">
                            Mot de passe : <span className="font-mono font-bold text-[#7C3AED]">{replayCode}</span>
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(replayCode)
                              setCodeCopied(true)
                              setTimeout(() => setCodeCopied(false), 2000)
                            }}
                            className="p-1 rounded-md bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 transition-colors text-[#7C3AED]"
                          >
                            {codeCopied ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-text-secondary mt-1">Dernier cours collectif</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#7C3AED]">
                        Regarder <ExternalLink size={12} />
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            )}
          </motion.div>

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
        <div className="xl:col-span-3 space-y-4">

          {/* Stats */}
          <motion.div data-tour="dashboard-stats" initial="hidden" animate="visible" custom={1.5} variants={fadeInUp}>
            <h2 className="font-[family-name:var(--font-heading)] text-lg text-text mb-3">Ton parcours</h2>
            <div className="grid grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3">
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

          {/* Subscription */}
          {profile.subscription_start && (() => {
            const end = new Date(profile.subscription_start)
            end.setFullYear(end.getFullYear() + 1)
            const info = formatSubscriptionRemaining(end.toISOString())
            return (
              <motion.div initial="hidden" animate="visible" custom={2} variants={fadeInUp}>
                <Card className={`${info.urgent ? 'bg-amber-50/50 border-amber-200' : 'bg-[#FAF6F1] border-[#DCCFBF]'} lg:p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={16} className={info.urgent ? 'text-amber-600' : 'text-[#C6684F]'} />
                    <p className="text-xs font-semibold text-[#2C2C2C]">Mon accompagnement</p>
                  </div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <p className={`text-sm font-medium ${info.urgent ? 'text-amber-700' : 'text-[#2C2C2C]'}`}>
                      {info.label}
                    </p>
                    <p className="text-[10px] text-[#A09488]">
                      jusqu&apos;au {end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${info.urgent ? 'bg-amber-500' : 'bg-[#C6684F]'}`}
                      style={{ width: `${info.percent}%` }}
                    />
                  </div>
                  {info.urgent && (
                    <p className="text-[10px] text-amber-600 mt-1.5">
                      Contacte Marjorie pour renouveler ton accompagnement
                    </p>
                  )}
                </Card>
              </motion.div>
            )
          })()}

          {/* Inspiration */}
          <motion.div data-tour="dashboard-inspiration" initial="hidden" animate="visible" custom={2.5} variants={fadeInUp}>
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
