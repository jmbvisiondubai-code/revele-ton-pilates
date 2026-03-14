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
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useDataCache, isCacheValid } from '@/stores/data-cache'
import { StreakBadge } from '@/components/ui'
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

  return (
    <div className="px-5 pt-6 pb-8 lg:px-8 xl:px-12 lg:pt-8 max-w-2xl lg:max-w-3xl mx-auto">

      {/* Header — clean greeting + streak */}
      {(() => {
        const greeting = getGreeting(profile.username)
        return (
          <motion.div data-tour="dashboard-greeting" initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#C6684F] tracking-wide">{greeting.salut}</p>
                <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[#2C2C2C] leading-snug mt-0.5">
                  {greeting.message}
                </h1>
              </div>
              <StreakBadge count={profile.current_streak} />
            </div>
          </motion.div>
        )
      })()}

      <div className="space-y-3">

        {/* Unread messages — compact notification */}
        {unreadMsg.count > 0 && (
          <motion.div data-tour="dashboard-unread" initial="hidden" animate="visible" custom={0.5} variants={fadeInUp}>
            <Link href="/messages">
              <div className="group flex items-center gap-3 rounded-2xl bg-white border border-[#E8DDD4] p-4 hover:border-[#C6684F]/30 transition-colors">
                <div className="relative w-9 h-9 bg-[#C6684F]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={16} className="text-[#C6684F]" />
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-[#C6684F] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadMsg.count}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2C2C2C]">
                    {unreadMsg.senderName ? `${unreadMsg.senderName} t'a écrit` : 'Nouveau message'}
                  </p>
                  {unreadMsg.lastContent && (
                    <p className="text-xs text-[#9B8E82] truncate">{unreadMsg.lastContent}</p>
                  )}
                </div>
                <ChevronRight size={14} className="text-[#DCCFBF] group-hover:text-[#C6684F] flex-shrink-0 transition-colors" />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Next live — clean card */}
        {nextLive && (
          <motion.div initial="hidden" animate="visible" custom={1} variants={fadeInUp}>
            <Link href="/cours">
              <div className="group rounded-2xl bg-white border border-[#E8DDD4] p-4 hover:border-[#C6684F]/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#C6684F] to-[#D4956B] rounded-full flex items-center justify-center flex-shrink-0">
                    <Radio size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-[#C6684F] flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C6684F] opacity-50" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C6684F]" />
                      </span>
                      {SESSION_TYPE_LABELS[nextLive.session_type] ?? 'Prochain live'}
                    </p>
                    <h3 className="font-[family-name:var(--font-heading)] text-base text-[#2C2C2C] mt-0.5">{nextLive.title}</h3>
                    <p className="text-[13px] text-[#9B8E82] capitalize mt-0.5">
                      {format(new Date(nextLive.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                      <span className="text-[#C6684F]/60 ml-1">{nextLive.duration_minutes} min</span>
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-[#DCCFBF] group-hover:text-[#C6684F] flex-shrink-0 transition-colors" />
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Private appointment — compact */}
        {privateAppt && (
          <motion.div initial="hidden" animate="visible" custom={1.5} variants={fadeInUp}>
            <div className="rounded-2xl bg-white border border-[#E8DDD4] p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <CalendarClock size={16} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[#7C3AED]">RDV privé</p>
                  <h3 className="font-[family-name:var(--font-heading)] text-base text-[#2C2C2C] mt-0.5">{privateAppt.title}</h3>
                  <p className="text-[13px] text-[#9B8E82] capitalize mt-0.5">
                    {format(new Date(privateAppt.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                  </p>
                </div>
              </div>
              {(privateAppt.meeting_url || true) && (
                <div className="flex items-center gap-2 mt-3 pl-[52px]">
                  {privateAppt.meeting_url && (
                    <a href={privateAppt.meeting_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                      onClick={e => e.stopPropagation()}>
                      <Video size={12} /> Rejoindre
                    </a>
                  )}
                  <div onClick={e => e.stopPropagation()}>
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
              )}
            </div>
          </motion.div>
        )}

        {/* Stats — inline compact row */}
        <motion.div data-tour="dashboard-stats" initial="hidden" animate="visible" custom={2} variants={fadeInUp}>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white border border-[#E8DDD4] p-3 text-center">
              <Trophy size={18} className="mx-auto text-[#C6684F] mb-1" />
              <p className="text-xl font-bold text-[#2C2C2C]">{profile.total_sessions}</p>
              <p className="text-[11px] text-[#9B8E82]">sessions</p>
            </div>
            <div className="rounded-2xl bg-white border border-[#E8DDD4] p-3 text-center">
              <Clock size={18} className="mx-auto text-[#C6684F] mb-1" />
              <p className="text-xl font-bold text-[#2C2C2C]">{formatDuration(profile.total_practice_minutes)}</p>
              <p className="text-[11px] text-[#9B8E82]">de pratique</p>
            </div>
            <div className="rounded-2xl bg-white border border-[#E8DDD4] p-3 text-center">
              <Sparkles size={18} className="mx-auto text-[#C6684F] mb-1" />
              <p className="text-xl font-bold text-[#2C2C2C]">{profile.longest_streak}</p>
              <p className="text-[11px] text-[#9B8E82]">meilleure série</p>
            </div>
          </div>
        </motion.div>

        {/* Programme Hebdo + Replay — compact side by side */}
        <motion.div data-tour="dashboard-programmes" initial="hidden" animate="visible" custom={2.5} variants={fadeInUp} className="grid grid-cols-2 gap-3">
          {featured && (
            <button onClick={() => openExternal(featured.url)} className="w-full text-left">
              <div className="group rounded-2xl bg-white border border-[#E8DDD4] p-0 overflow-hidden hover:border-[#C6684F]/30 transition-colors h-full">
                {featured.image ? (
                  <div className="w-full h-24 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={featured.image} alt={featured.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-16 bg-[#C6684F]/5 flex items-center justify-center">
                    <Dumbbell size={20} className="text-[#C6684F]" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold text-[#2C2C2C] truncate">{featured.title}</p>
                  <p className="text-[11px] text-[#9B8E82] mt-0.5 flex items-center gap-1">
                    Accéder <ExternalLink size={10} />
                  </p>
                </div>
              </div>
            </button>
          )}

          {replayUrl && (
            <button onClick={() => openExternal(replayUrl)} className="w-full text-left">
              <div className="group rounded-2xl bg-white border border-[#E8DDD4] p-0 overflow-hidden hover:border-[#7C3AED]/30 transition-colors h-full">
                {replayImage ? (
                  <div className="w-full h-24 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={replayImage} alt="Replay" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-16 bg-[#7C3AED]/5 flex items-center justify-center">
                    <Play size={20} className="text-[#7C3AED] ml-0.5" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold text-[#2C2C2C]">Replay</p>
                  {replayCode ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[11px] text-[#9B8E82]">
                        MDP : <span className="font-mono font-bold text-[#7C3AED]">{replayCode}</span>
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(replayCode)
                          setCodeCopied(true)
                          setTimeout(() => setCodeCopied(false), 2000)
                        }}
                        className="p-0.5 rounded text-[#7C3AED]"
                      >
                        {codeCopied ? <Check size={10} /> : <Copy size={10} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#9B8E82] mt-0.5 flex items-center gap-1">
                      Regarder <ExternalLink size={10} />
                    </p>
                  )}
                </div>
              </div>
            </button>
          )}
        </motion.div>

        {/* Subscription — compact inline */}
        {profile.subscription_start && (() => {
          const end = new Date(profile.subscription_start)
          end.setFullYear(end.getFullYear() + 1)
          const info = formatSubscriptionRemaining(end.toISOString())
          return (
            <motion.div initial="hidden" animate="visible" custom={3} variants={fadeInUp}>
              <div className={`rounded-2xl border p-4 ${info.urgent ? 'bg-amber-50/50 border-amber-200' : 'bg-[#FAF6F1] border-[#E8DDD4]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className={info.urgent ? 'text-amber-600' : 'text-[#C6684F]'} />
                    <p className="text-xs font-semibold text-[#2C2C2C]">Mon accompagnement</p>
                  </div>
                  <p className="text-[10px] text-[#9B8E82]">
                    jusqu&apos;au {end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${info.urgent ? 'bg-amber-500' : 'bg-[#C6684F]'}`}
                    style={{ width: `${info.percent}%` }}
                  />
                </div>
              </div>
            </motion.div>
          )
        })()}

      </div>
    </div>
  )
}
