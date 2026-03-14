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
  Radio,
  ExternalLink,
  Dumbbell,
  Play,
  Copy,
  Check,
  Video,
  MessageCircle,
  Flame,
  Plus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useDataCache, isCacheValid } from '@/stores/data-cache'
// UI components used: none from shared lib (using inline styles)
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

  const sessionsThisWeek = Math.min(profile.total_sessions, profile.weekly_rhythm)
  const weeklyPercent = Math.round(Math.min(100, (sessionsThisWeek / Math.max(1, profile.weekly_rhythm)) * 100))

  // Build week days for the weekly tracker
  const weekDays = (() => {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    const labels = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
    // Start from monday
    const weekLabels = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
    return weekLabels.map((label, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const isToday = d.toDateString() === now.toDateString()
      const isPast = d < now && !isToday
      return { label, date: d, isToday, isPast }
    })
  })()

  // SVG circular progress helper
  const CircleProgress = ({ value, max, size = 44, color = '#34C759' }: { value: number; max: number; size?: number; color?: string }) => {
    const radius = (size - 6) / 2
    const circumference = 2 * Math.PI * radius
    const progress = Math.min(value / Math.max(1, max), 1)
    const offset = circumference * (1 - progress)
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#F0EBE5" strokeWidth={3} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={3}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#1D1D1F]">
          {value}/{max}
        </span>
      </div>
    )
  }

  return (
    <div className="px-5 pt-6 pb-8 lg:px-8 xl:px-12 lg:pt-8 max-w-2xl lg:max-w-3xl mx-auto">

      {/* ─── TOP BAR: greeting + streak (like Whoop avatar + streak) ─── */}
      {(() => {
        const greeting = getGreeting(profile.username)
        return (
          <motion.div data-tour="dashboard-greeting" initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#C6684F] to-[#D4956B] flex items-center justify-center text-white font-bold text-base">
                  {(profile.first_name || profile.username || '?')[0].toUpperCase()}
                </div>
                <div>
                  <h1 className="font-[family-name:var(--font-heading)] text-[20px] text-[#1D1D1F] leading-tight">
                    {greeting.message}
                  </h1>
                  <p className="text-[12px] text-[#86868B] mt-0.5 capitalize">
                    {format(new Date(), "EEEE d MMMM", { locale: fr })}
                  </p>
                </div>
              </div>
              <Link href="/serie" className="flex items-center gap-1.5 bg-[#C6684F]/10 rounded-full px-3 py-1.5 hover:bg-[#C6684F]/20 transition-colors">
                <Flame size={16} className="text-[#C6684F]" />
                <span className="text-[15px] font-bold text-[#C6684F]">{profile.current_streak}</span>
              </Link>
            </div>
          </motion.div>
        )
      })()}

      {/* ─── À VENIR — prochains events en priorité ─── */}
      {(nextLive || privateAppt || unreadMsg.count > 0) && (
        <motion.div initial="hidden" animate="visible" custom={0.5} variants={fadeInUp} className="mb-10">
          <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">À venir</h2>
          <div className="rounded-2xl bg-white border border-[#E8DDD4] overflow-hidden divide-y divide-[#F0EBE5]">

            {nextLive && (
              <Link href="/cours" className="flex items-center gap-3 px-5 py-4 hover:bg-[#FAF6F1] transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-[#C6684F] to-[#D4956B] rounded-full flex items-center justify-center flex-shrink-0">
                  <Radio size={15} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">{nextLive.title}</p>
                  <p className="text-[12px] text-[#86868B] capitalize">
                    {format(new Date(nextLive.scheduled_at), "EEEE d MMMM · HH'h'mm", { locale: fr })}
                    <span className="ml-1">· {nextLive.duration_minutes} min</span>
                  </p>
                </div>
                <ChevronRight size={16} className="text-[#D1CCC5] flex-shrink-0" />
              </Link>
            )}

            {privateAppt && (
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <CalendarClock size={15} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">{privateAppt.title}</p>
                  <p className="text-[12px] text-[#86868B] capitalize">
                    {format(new Date(privateAppt.scheduled_at), "EEEE d MMMM · HH'h'mm", { locale: fr })}
                  </p>
                </div>
                {privateAppt.meeting_url && (
                  <a href={privateAppt.meeting_url} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] font-semibold text-[#7C3AED] flex items-center gap-1 hover:underline">
                    <Video size={13} /> Visio
                  </a>
                )}
              </div>
            )}

            {unreadMsg.count > 0 && (
              <Link href="/messages" className="flex items-center gap-3 px-5 py-4 hover:bg-[#FAF6F1] transition-colors">
                <div className="relative w-10 h-10 bg-[#C6684F]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={15} className="text-[#C6684F]" />
                  <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 bg-[#C6684F] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadMsg.count}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    {unreadMsg.senderName ? `${unreadMsg.senderName} t'a écrit` : 'Nouveau message'}
                  </p>
                  {unreadMsg.lastContent && (
                    <p className="text-[12px] text-[#86868B] truncate">{unreadMsg.lastContent}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-[#D1CCC5] flex-shrink-0" />
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── MES COURS — programme + replay en accès rapide ─── */}
      {(featured || replayUrl) && (
        <motion.div data-tour="dashboard-programmes" initial="hidden" animate="visible" custom={1} variants={fadeInUp} className="mb-10">
          <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Mes cours</h2>
          <div className="rounded-2xl bg-white border border-[#E8DDD4] divide-y divide-[#F0EBE5] overflow-hidden">

            {featured && (
              <button onClick={() => openExternal(featured.url)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#FAF6F1] transition-colors text-left">
                {featured.image ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={featured.image} alt={featured.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#C6684F]/5 flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={18} className="text-[#C6684F]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1D1D1F] truncate">{featured.title}</p>
                  <p className="text-[12px] text-[#86868B]">{featured.description || 'Programme de la semaine'}</p>
                </div>
                <ExternalLink size={14} className="text-[#D1CCC5] flex-shrink-0" />
              </button>
            )}

            {replayUrl && (
              <button onClick={() => openExternal(replayUrl)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#FAF6F1] transition-colors text-left">
                {replayImage ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={replayImage} alt="Replay" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/5 flex items-center justify-center flex-shrink-0">
                    <Play size={18} className="text-[#7C3AED] ml-0.5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">Replay dernier cours</p>
                  {replayCode ? (
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] text-[#86868B]">
                        Mot de passe : <span className="font-mono font-bold text-[#7C3AED]">{replayCode}</span>
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(replayCode)
                          setCodeCopied(true)
                          setTimeout(() => setCodeCopied(false), 2000)
                        }}
                        className="p-1 rounded-md hover:bg-[#7C3AED]/10 text-[#7C3AED]"
                      >
                        {codeCopied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#86868B]">Dernier cours collectif</p>
                  )}
                </div>
                <ExternalLink size={14} className="text-[#D1CCC5] flex-shrink-0" />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── MON JOURNAL — weekly dots ─── */}
      <motion.div initial="hidden" animate="visible" custom={1.5} variants={fadeInUp} className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold text-[#1D1D1F]">Mon journal</h2>
          <Link href="/suivi" className="text-[12px] font-semibold text-[#C6684F] flex items-center gap-0.5">
            Voir tout <ChevronRight size={14} />
          </Link>
        </div>
        <div className="rounded-2xl bg-white border border-[#E8DDD4] px-4 py-5">
          <div className="flex items-center justify-between">
            {weekDays.map((day) => (
              <div key={day.label} className="flex flex-col items-center gap-2.5">
                <span className={`text-[10px] font-bold tracking-wider ${day.isToday ? 'text-[#1D1D1F]' : 'text-[#AEAEB2]'}`}>
                  {day.label}.
                </span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  day.isToday
                    ? 'bg-[#C6684F] text-white shadow-[0_2px_8px_rgba(198,104,79,0.3)]'
                    : day.isPast
                    ? 'bg-[#34C759] text-white'
                    : 'bg-[#F5F5F7]'
                }`}>
                  {day.isPast ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : day.isToday ? (
                    <span className="text-[12px] font-bold">{day.date.getDate()}</span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#D1CCC5]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ─── MON OBJECTIF ─── */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeInUp} className="mb-10">
        <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Mon objectif</h2>
        <div className="rounded-2xl bg-white border border-[#E8DDD4] overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <p className="text-[12px] text-[#86868B] mb-3">{profile.weekly_rhythm} sessions par semaine</p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-[32px] font-bold text-[#1D1D1F] leading-none">{weeklyPercent}%</span>
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#86868B]">accompli</span>
            </div>
            <div className="h-2 bg-[#F0EBE5] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[#34C759]"
                initial={{ width: 0 }}
                animate={{ width: `${weeklyPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
          <div className="border-t border-[#F0EBE5] divide-y divide-[#F0EBE5]">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[14px] text-[#1D1D1F]">Sessions cette semaine</span>
              <CircleProgress value={sessionsThisWeek} max={profile.weekly_rhythm} color="#34C759" />
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[14px] text-[#1D1D1F]">Série en cours</span>
              <CircleProgress value={profile.current_streak} max={Math.max(profile.current_streak, profile.longest_streak)} color="#C6684F" />
            </div>
          </div>
          <div className="px-5 pb-5 pt-3">
            <Link href="/suivi"
              className="block w-full py-3 rounded-xl bg-[#F0EBE5] text-center text-[13px] font-bold tracking-[0.08em] uppercase text-[#1D1D1F] hover:bg-[#E8DDD4] transition-colors">
              Voir mon suivi
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── MON TABLEAU DE BORD ─── */}
      <motion.div data-tour="dashboard-stats" initial="hidden" animate="visible" custom={2.5} variants={fadeInUp} className="mb-10">
        <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Mon tableau de bord</h2>
        <div className="rounded-2xl bg-white border border-[#E8DDD4] divide-y divide-[#F0EBE5]">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Trophy size={18} className="text-[#C6684F]" />
              <span className="text-[14px] text-[#1D1D1F]">Sessions totales</span>
            </div>
            <span className="text-[22px] font-bold text-[#1D1D1F]">{profile.total_sessions}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-[#C6684F]" />
              <span className="text-[14px] text-[#1D1D1F]">Temps de pratique</span>
            </div>
            <span className="text-[22px] font-bold text-[#1D1D1F]">{formatDuration(profile.total_practice_minutes)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-[#C6684F]" />
              <span className="text-[14px] text-[#1D1D1F]">Meilleure série</span>
            </div>
            <div className="text-right">
              <span className="text-[22px] font-bold text-[#1D1D1F]">{profile.longest_streak}</span>
              <span className="text-[12px] text-[#AEAEB2] ml-1">jours</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── MON ACCOMPAGNEMENT — fixed percentage ─── */}
      {profile.subscription_start && (() => {
        const end = new Date(profile.subscription_start)
        end.setFullYear(end.getFullYear() + 1)
        const info = formatSubscriptionRemaining(end.toISOString())
        return (
          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeInUp} className="mb-10">
            <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Mon accompagnement</h2>
            <div className={`rounded-2xl border overflow-hidden ${info.urgent ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-[#E8DDD4]'}`}>
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[15px] font-bold ${info.urgent ? 'text-amber-700' : 'text-[#1D1D1F]'}`}>
                    {info.label}
                  </span>
                  <Calendar size={16} className={info.urgent ? 'text-amber-600' : 'text-[#C6684F]'} />
                </div>
                <p className="text-[12px] text-[#86868B] mb-3">
                  jusqu&apos;au {end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <div className="h-2 bg-[#F0EBE5] rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${info.urgent ? 'bg-amber-500' : 'bg-[#C6684F]'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${info.percent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[11px] text-[#9B8E82] mt-2">{info.daysLeft > 0 ? `${info.daysLeft} jours restants` : ''}</p>
              </div>
              {info.urgent && (
                <div className="border-t border-amber-200 px-5 py-3">
                  <p className="text-[12px] text-amber-600 font-medium">
                    Contacte Marjorie pour renouveler ton accompagnement
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )
      })()}

    </div>
  )
}
