'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Moon,
  Trash2,
  Pencil,
  MoreVertical,
  ArrowLeft,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useDataCache, isCacheValid } from '@/stores/data-cache'
import { AddToCalendar } from '@/components/add-to-calendar'
import { getGreeting, formatDuration, formatSubscriptionRemaining } from '@/lib/utils'
import { PracticeLogModal } from '@/components/practice-log-modal'
import type { Profile, DailyInspiration, LiveSession, LiveSessionType, PrivateAppointment, SessionType, CourseCompletion } from '@/types/database'

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

const SESSION_ICONS: Record<SessionType, { icon: typeof Play; color: string; label: string }> = {
  vod: { icon: Play, color: '#C6684F', label: 'Cours VOD' },
  live: { icon: Radio, color: '#C6684F', label: 'Cours live' },
  libre: { icon: Dumbbell, color: '#7C3AED', label: 'Pratique libre' },
  repos: { icon: Moon, color: '#6B8E7B', label: 'Jour de repos' },
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

// Helper: get YYYY-MM-DD string from a Date in local timezone
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardPage() {
  const router = useRouter()
  const { profile, setProfile } = useAuthStore()
  const cache = useDataCache()
  const [codeCopied, setCodeCopied] = useState(false)

  // Journal state
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)
  const [weekCompletions, setWeekCompletions] = useState<Record<string, CourseCompletion[]>>({})
  const [completionsLoaded, setCompletionsLoaded] = useState(false)
  const [justValidated, setJustValidated] = useState<string | null>(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [viewingCompletion, setViewingCompletion] = useState<CourseCompletion | null>(null)
  const [showDetailMenu, setShowDetailMenu] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      const isFuture = d > now && !isToday
      const dateKey = toDateKey(d)
      return { label, date: d, isToday, isFuture, dateKey, index: i }
    })
  })()

  // Default selected day = today
  const todayIndex = weekDays.findIndex(d => d.isToday)
  const activeIndex = selectedDayIndex ?? todayIndex
  const activeDay = weekDays[activeIndex]

  // Fetch week completions
  const fetchWeekCompletions = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const mondayKey = weekDays[0].dateKey
    const sundayDate = new Date(weekDays[6].date)
    sundayDate.setDate(sundayDate.getDate() + 1)
    const sundayKey = toDateKey(sundayDate)

    const { data } = await supabase
      .from('course_completions')
      .select('*')
      .eq('user_id', user.id)
      .gte('completed_at', mondayKey)
      .lt('completed_at', sundayKey)
      .order('completed_at', { ascending: true })

    if (data) {
      const grouped: Record<string, CourseCompletion[]> = {}
      for (const c of data as CourseCompletion[]) {
        const key = c.completed_at.split('T')[0]
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(c)
      }
      setWeekCompletions(grouped)
    }
    setCompletionsLoaded(true)
  }, [weekDays])

  useEffect(() => {
    fetchWeekCompletions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Delete a completion
  async function handleDeleteCompletion(completionId: string) {
    setDeletingId(completionId)
    const supabase = createClient()
    const { error } = await supabase.from('course_completions').delete().eq('id', completionId)
    if (!error) {
      // Recalculate stats
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: result } = await supabase.rpc('recalculate_user_stats', { p_user_id: user.id })
        if (result) {
          useAuthStore.getState().updateProfile({
            total_sessions: (result as { total_sessions: number }).total_sessions,
            total_practice_minutes: (result as { total_practice_minutes: number }).total_practice_minutes,
            current_streak: (result as { current_streak: number }).current_streak,
            longest_streak: (result as { longest_streak: number }).longest_streak,
          })
        }
      }
      await fetchWeekCompletions()
    }
    setDeletingId(null)
  }

  // On log success — trigger animation + refresh
  function handleLogSuccess() {
    const dateKey = activeDay?.dateKey
    if (dateKey) {
      setJustValidated(dateKey)
      setTimeout(() => setJustValidated(null), 1200)
    }
    fetchWeekCompletions()
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse-soft text-text-secondary">Chargement de ton espace...</div>
      </div>
    )
  }

  const sessionsThisWeek = Math.min(profile.total_sessions, profile.weekly_rhythm)
  const weeklyPercent = Math.round(Math.min(100, (sessionsThisWeek / Math.max(1, profile.weekly_rhythm)) * 100))

  // Activities for selected day
  const activeDayCompletions = activeDay ? (weekCompletions[activeDay.dateKey] || []) : []
  const activeDayHasActivity = activeDayCompletions.length > 0

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

      {/* ─── TOP BAR: greeting + streak ─── */}
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

      {/* ─── À VENIR ─── */}
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

      {/* ─── MES COURS ─── */}
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

      {/* ─── MON JOURNAL — interactive weekly tracker ─── */}
      <motion.div initial="hidden" animate="visible" custom={1.5} variants={fadeInUp} className="mb-10">
        <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-4">Mon journal</h2>
        <div className="rounded-2xl bg-white border border-[#E8DDD4] overflow-hidden">
          {/* Week dots */}
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center justify-between">
              {weekDays.map((day) => {
                const hasCompletions = (weekCompletions[day.dateKey] || []).length > 0
                const isSelected = day.index === activeIndex
                const isAnimating = justValidated === day.dateKey

                return (
                  <button
                    key={day.label}
                    onClick={() => setSelectedDayIndex(day.index)}
                    className="flex flex-col items-center gap-2.5 group"
                  >
                    <span className={`text-[10px] font-bold tracking-wider transition-colors ${
                      isSelected ? 'text-[#1D1D1F]' : 'text-[#AEAEB2]'
                    }`}>
                      {day.label}.
                    </span>

                    <div className="relative w-9 h-9" style={{ perspective: '200px' }}>
                      <AnimatePresence mode="wait">
                        {isAnimating ? (
                          // Coin-flip animation: terracotta → green
                          <motion.div
                            key="flip"
                            className="absolute inset-0 rounded-full bg-[#34C759] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(52,199,89,0.35)]"
                            initial={{ rotateY: -90, scale: 0.8 }}
                            animate={{
                              rotateY: [-90, 10, -5, 0],
                              scale: [0.8, 1.15, 1.05, 1],
                              y: [0, -6, -2, 0],
                            }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.35, duration: 0.3, type: 'spring', stiffness: 400 }}
                            >
                              <Check size={16} strokeWidth={3} />
                            </motion.div>
                          </motion.div>
                        ) : hasCompletions ? (
                          // Completed day — green with check
                          <motion.div
                            key="done"
                            className={`absolute inset-0 rounded-full bg-[#34C759] text-white flex items-center justify-center transition-shadow ${
                              isSelected ? 'shadow-[0_2px_10px_rgba(52,199,89,0.35)] ring-2 ring-[#34C759]/30' : ''
                            }`}
                            initial={false}
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </motion.div>
                        ) : day.isToday ? (
                          // Today — terracotta with date number
                          <motion.div
                            key="today"
                            className={`absolute inset-0 rounded-full bg-[#C6684F] text-white flex items-center justify-center shadow-[0_2px_8px_rgba(198,104,79,0.3)] ${
                              isSelected ? 'ring-2 ring-[#C6684F]/30' : ''
                            }`}
                            initial={false}
                          >
                            <span className="text-[12px] font-bold">{day.date.getDate()}</span>
                          </motion.div>
                        ) : day.isFuture ? (
                          // Future — gray dot
                          <motion.div
                            key="future"
                            className={`absolute inset-0 rounded-full bg-[#F5F5F7] flex items-center justify-center ${
                              isSelected ? 'ring-2 ring-[#E8DDD4]' : ''
                            }`}
                            initial={false}
                          >
                            <span className="w-2 h-2 rounded-full bg-[#D1CCC5]" />
                          </motion.div>
                        ) : (
                          // Past without completion — terracotta outline (missed)
                          <motion.div
                            key="missed"
                            className={`absolute inset-0 rounded-full border-2 border-dashed border-[#E8DDD4] flex items-center justify-center ${
                              isSelected ? 'ring-2 ring-[#E8DDD4] bg-[#FAF6F1]' : ''
                            }`}
                            initial={false}
                          >
                            <span className="text-[11px] font-medium text-[#D1CCC5]">{day.date.getDate()}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected day detail + activities */}
          <div className="border-t border-[#F0EBE5] px-4 py-4">
            {/* Day header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-[#1D1D1F] capitalize">
                {activeDay && format(activeDay.date, "EEEE d MMMM", { locale: fr })}
              </p>
              {!activeDay?.isFuture && (
                <button
                  onClick={() => setShowLogModal(true)}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-[#C6684F] hover:text-[#b05a42] transition-colors"
                >
                  <Plus size={14} />
                  Ajouter
                </button>
              )}
            </div>

            {/* Activities list — click to open detail */}
            {activeDayCompletions.length > 0 ? (
              <div className="space-y-2">
                {activeDayCompletions.map((c) => {
                  const info = SESSION_ICONS[c.session_type] || SESSION_ICONS.libre
                  const Icon = info.icon
                  return (
                    <motion.button
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setViewingCompletion(c); setShowDetailMenu(false) }}
                      className="w-full flex items-center gap-3 bg-[#FAF6F1] rounded-xl px-3.5 py-3 hover:bg-[#F0EBE5] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${info.color}12` }}>
                        <Icon size={15} style={{ color: info.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1D1D1F]">
                          {c.session_type === 'repos' ? 'Jour de repos' : info.label}
                          {c.libre_label && <span className="text-[#86868B]"> · {c.libre_label}</span>}
                        </p>
                        {c.session_type !== 'repos' && c.duration_watched_minutes != null && c.duration_watched_minutes > 0 && (
                          <p className="text-[11px] text-[#9B8E82]">{c.duration_watched_minutes} min</p>
                        )}
                      </div>
                      {c.rating && (
                        <span className="text-[16px]">
                          {c.rating === 1 ? '😓' : c.rating === 2 ? '😐' : c.rating === 3 ? '🙂' : c.rating === 4 ? '😊' : '🤩'}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-[#D1CCC5] flex-shrink-0" />
                    </motion.button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-3">
                {activeDay?.isFuture ? (
                  <p className="text-[13px] text-[#D1CCC5]">Jour à venir</p>
                ) : (
                  <p className="text-[13px] text-[#9B8E82]">Aucune activité enregistrée</p>
                )}
              </div>
            )}
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

      {/* ─── MON ACCOMPAGNEMENT ─── */}
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

      {/* ─── Activity detail sheet ─── */}
      <AnimatePresence>
        {viewingCompletion && (() => {
          const c = viewingCompletion
          const info = SESSION_ICONS[c.session_type] || SESSION_ICONS.libre
          const Icon = info.icon
          const ratingEmoji = c.rating === 1 ? '😓 Difficile' : c.rating === 2 ? '😐 Moyen' : c.rating === 3 ? '🙂 Bien' : c.rating === 4 ? '😊 Super' : c.rating === 5 ? '🤩 Incroyable' : null
          const completedTime = c.completed_at.includes('T') ? format(new Date(c.completed_at), "HH'h'mm", { locale: fr }) : null

          return (
            <motion.div
              key="detail-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => { setViewingCompletion(null); setShowDetailMenu(false) }}
            >
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-white rounded-t-3xl lg:rounded-3xl w-full max-w-lg shadow-2xl mx-0 lg:mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Detail header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4">
                  <button
                    onClick={() => { setViewingCompletion(null); setShowDetailMenu(false) }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#9B8E82] hover:bg-[#F0EBE5] transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h3 className="text-[14px] font-bold text-[#1D1D1F] uppercase tracking-[0.08em]">
                    Détail activité
                  </h3>
                  {/* 3-dot menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDetailMenu(!showDetailMenu)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#9B8E82] hover:bg-[#F0EBE5] transition-colors"
                    >
                      <MoreVertical size={18} />
                    </button>
                    <AnimatePresence>
                      {showDetailMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-11 z-20 bg-white border border-[#E8DDD4] rounded-xl shadow-lg overflow-hidden min-w-[160px]"
                        >
                          <button
                            onClick={() => {
                              setShowDetailMenu(false)
                              setViewingCompletion(null)
                              // Delete then re-open log modal to "edit"
                              handleDeleteCompletion(c.id).then(() => {
                                setShowLogModal(true)
                              })
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-[#1D1D1F] hover:bg-[#FAF6F1] transition-colors text-left"
                          >
                            <Pencil size={14} className="text-[#9B8E82]" />
                            Modifier
                          </button>
                          <div className="border-t border-[#F0EBE5]" />
                          <button
                            onClick={() => {
                              setShowDetailMenu(false)
                              setViewingCompletion(null)
                              handleDeleteCompletion(c.id)
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors text-left"
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Activity detail content */}
                <div className="px-5 pb-6">
                  {/* Big icon + type */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${info.color}12` }}>
                      <Icon size={28} style={{ color: info.color }} />
                    </div>
                    <div>
                      <h4 className="text-[18px] font-bold text-[#1D1D1F]">
                        {c.session_type === 'repos' ? 'Jour de repos' : info.label}
                      </h4>
                      {c.libre_label && (
                        <p className="text-[13px] text-[#86868B] mt-0.5">{c.libre_label}</p>
                      )}
                      {completedTime && (
                        <p className="text-[12px] text-[#9B8E82] mt-0.5">{completedTime}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {c.session_type !== 'repos' && c.duration_watched_minutes != null && c.duration_watched_minutes > 0 && (
                      <div className="bg-[#FAF6F1] rounded-xl px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9B8E82] mb-1">Durée</p>
                        <p className="text-[20px] font-bold text-[#1D1D1F]">{c.duration_watched_minutes} <span className="text-[13px] font-medium text-[#9B8E82]">min</span></p>
                      </div>
                    )}
                    {c.session_type === 'repos' && (
                      <div className="bg-[#F0F7F2] rounded-xl px-4 py-3 col-span-2">
                        <div className="flex items-center gap-2">
                          <Moon size={16} className="text-[#6B8E7B]" />
                          <p className="text-[14px] font-medium text-[#1D1D1F]">Journée de récupération</p>
                        </div>
                        <p className="text-[12px] text-[#6B8E7B] mt-1">Ta série continue, ton corps récupère</p>
                      </div>
                    )}
                    {ratingEmoji && (
                      <div className="bg-[#FAF6F1] rounded-xl px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9B8E82] mb-1">Ressenti</p>
                        <p className="text-[16px]">{ratingEmoji}</p>
                      </div>
                    )}
                  </div>

                  {/* Type badge */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ backgroundColor: `${info.color}12`, color: info.color }}>
                      <Icon size={12} />
                      {c.session_type === 'vod' ? 'VOD' : c.session_type === 'live' ? 'Live' : c.session_type === 'libre' ? 'Libre' : 'Repos'}
                    </span>
                    {c.feedback && (
                      <span className="text-[12px] text-[#9B8E82] truncate">{c.feedback}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Practice log modal */}
      <PracticeLogModal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSuccess={handleLogSuccess}
        defaultDate={activeDay?.dateKey}
      />

    </div>
  )
}
