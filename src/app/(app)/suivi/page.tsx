'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight, Trophy, Clock, Sparkles, Flame,
  ArrowLeft, ExternalLink, BookOpen, Calendar, Target,
  Award, Play, TrendingUp, Star,
} from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card } from '@/components/ui'
import type { Recommendation, Profile, Badge, SessionType } from '@/types/database'

const REC_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'mouvement', label: 'Mouvement', emoji: '🧘‍♀️' },
  { key: 'nutrition', label: 'Nutrition', emoji: '🥗' },
  { key: 'bien_etre', label: 'Bien-être', emoji: '🌿' },
  { key: 'mindset', label: 'Mindset', emoji: '🧠' },
  { key: 'cours', label: 'Cours', emoji: '🎯' },
  { key: 'autre', label: 'Autre', emoji: '💬' },
]

const LEVEL_LABELS: Record<string, string> = {
  debutante: 'Débutante',
  initiee: 'Initiée',
  intermediaire: 'Intermédiaire',
  avancee: 'Avancée',
}

const LEVEL_ORDER = ['debutante', 'initiee', 'intermediaire', 'avancee']

const GOAL_LABELS: Record<string, { label: string; emoji: string }> = {
  posture: { label: 'Posture', emoji: '🧍‍♀️' },
  souplesse: { label: 'Souplesse', emoji: '🤸‍♀️' },
  renforcement: { label: 'Renforcement', emoji: '💪' },
  gestion_stress: { label: 'Gestion du stress', emoji: '🧘' },
  post_partum: { label: 'Post-partum', emoji: '🤱' },
  soulagement_douleurs: { label: 'Soulagement douleurs', emoji: '🩹' },
  tonicite: { label: 'Tonicité', emoji: '⚡' },
  energie: { label: 'Énergie', emoji: '🔋' },
  connexion_corps_esprit: { label: 'Corps & esprit', emoji: '🌸' },
}

const DAY_LABELS: Record<string, string> = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu',
  vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
}
const ALL_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

const SESSION_TYPE_LABELS: Record<SessionType, { label: string; color: string }> = {
  vod: { label: 'VOD', color: '#C6684F' },
  live: { label: 'Live', color: '#7C6BAF' },
  libre: { label: 'Libre', color: '#5B9A6B' },
}

function getRecCat(key: string | null) {
  return REC_CATEGORIES.find(c => c.key === key) ?? { label: 'Conseil', emoji: '✨' }
}

function excerpt(text: string, max = 100) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

function openExternal(url: string) {
  const isIosPwa = (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isIosPwa) {
    navigator.clipboard.writeText(url).catch(() => {})
  } else {
    const a = document.createElement('a')
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
}

function relativeDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

type Tab = 'parcours' | 'recommandations'

interface Completion {
  id: string
  completed_at: string
  duration_watched_minutes: number | null
  session_type: SessionType
  libre_label: string | null
  courses: { title: string; duration_minutes: number } | null
}

interface EarnedBadge extends Badge {
  earned_at: string
}

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (d: number) => ({ opacity: 1, y: 0, transition: { delay: d * 0.08, duration: 0.4, ease: 'easeOut' as const } }),
}

export default function SuiviPage() {
  const [tab, setTab] = useState<Tab>('parcours')
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [unreadRecs, setUnreadRecs] = useState(0)
  const [openRec, setOpenRec] = useState<Recommendation | null>(null)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [recentCompletions, setRecentCompletions] = useState<Completion[]>([])
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([])

  const supabase = createClient()
  const { profile, setProfile } = useAuthStore()

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Ensure profile is in store (fresh fetch)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const prof = profileData as Profile | null
      if (prof) { setProfile(prof); setUserProfile(prof) }

      // Fetch in parallel: recommendations, completions, weekly count, badges
      const startOfWeek = new Date()
      startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)) // Monday
      startOfWeek.setHours(0, 0, 0, 0)

      const [recsRes, completionsRes, weekCountRes, allBadgesRes, userBadgesRes] = await Promise.all([
        supabase.from('recommendations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('course_completions')
          .select('id, completed_at, duration_watched_minutes, session_type, libre_label, courses(title, duration_minutes)')
          .eq('user_id', user.id).order('completed_at', { ascending: false }).limit(10),
        supabase.from('course_completions').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).gte('completed_at', startOfWeek.toISOString()),
        supabase.from('badges').select('*'),
        supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id),
      ])

      if (recsRes.data) {
        setRecs(recsRes.data as Recommendation[])
        setUnreadRecs(recsRes.data.filter((r: Recommendation) => !r.is_read).length)
      }

      if (completionsRes.data) setRecentCompletions(completionsRes.data as unknown as Completion[])
      setSessionsThisWeek(weekCountRes.count ?? 0)

      if (allBadgesRes.data && userBadgesRes.data) {
        const earned: EarnedBadge[] = []
        for (const ub of userBadgesRes.data) {
          const badge = allBadgesRes.data.find(b => b.id === ub.badge_id)
          if (badge) earned.push({ ...badge, earned_at: ub.earned_at } as EarnedBadge)
        }
        earned.sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
        setEarnedBadges(earned)
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function markRecAsRead(rec: Recommendation) {
    if (rec.is_read) return
    await supabase.from('recommendations').update({ is_read: true }).eq('id', rec.id)
    setRecs(prev => prev.map(r => r.id === rec.id ? { ...r, is_read: true } : r))
    setUnreadRecs(prev => Math.max(0, prev - 1))
  }

  function handleOpenRec(rec: Recommendation) {
    setOpenRec(rec)
    markRecAsRead(rec)
  }

  // ── Recommendation detail view ──────────────────────────────────────
  if (openRec) {
    const cat = getRecCat(openRec.category)
    return (
      <div className="px-5 pt-4 pb-8 lg:px-8 xl:px-12 max-w-5xl mx-auto">
        <button onClick={() => setOpenRec(null)}
          className="flex items-center gap-2 text-sm text-[#6B6359] hover:text-[#2C2C2C] mb-5 transition-colors">
          <ArrowLeft size={16} /> Retour
        </button>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {openRec.link_thumbnail_url && (
            <div className="rounded-2xl overflow-hidden mb-5 aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={openRec.link_thumbnail_url} alt={openRec.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{cat.emoji}</span>
            <span className="text-xs font-semibold text-[#C6684F] uppercase tracking-wide">{cat.label}</span>
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl lg:text-3xl text-[#2C2C2C] leading-snug mb-4">
            {openRec.title}
          </h1>
          {openRec.message && (
            <p className="text-[15px] text-[#2C2C2C] leading-relaxed whitespace-pre-wrap">{openRec.message}</p>
          )}
          {openRec.link_url && (
            <button onClick={() => openExternal(openRec.link_url!)}
              className="mt-6 flex items-center gap-2 bg-[#C6684F] text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-[#b05a42] transition">
              <ExternalLink size={15} /> {openRec.link_label || 'Voir le lien'}
            </button>
          )}
          <p className="text-xs text-[#DCCFBF] mt-5">
            {new Date(openRec.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </motion.div>
      </div>
    )
  }

  // ── Main page ───────────────────────────────────────────────────────
  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 xl:px-12 lg:pt-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 lg:mb-8">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl lg:text-4xl text-text">Mon suivi</h1>
        <p className="text-text-secondary mt-1 text-sm lg:text-base">Ton espace personnel avec Marjorie</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6 lg:max-w-md">
        {([
          { key: 'parcours' as Tab, label: 'Mon parcours' },
          { key: 'recommandations' as Tab, label: 'Conseils', badge: unreadRecs },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 relative py-2 lg:py-2.5 rounded-lg text-sm lg:text-base font-medium transition-all ${
              tab === t.key ? 'bg-white text-[#C6684F] shadow-sm' : 'text-[#6B6359] hover:text-[#2C2C2C]'
            }`}
          >
            {t.label}
            {(t.badge ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C6684F] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── RECOMMANDATIONS TAB ── */}
          {tab === 'recommandations' && (
            <motion.div initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="space-y-3">
              {recs.length === 0 ? (
                <div className="text-center py-16 text-text-secondary">
                  <Sparkles size={36} className="mx-auto mb-3 text-[#DCCFBF]" />
                  <p className="font-medium">Rien pour l&apos;instant</p>
                  <p className="text-sm text-text-muted mt-1">Marjorie te preparera quelque chose de special ici.</p>
                </div>
              ) : (
                recs.map((rec, i) => (
                  <motion.button key={rec.id} initial="hidden" animate="visible" custom={i * 0.5} variants={fadeInUp}
                    onClick={() => handleOpenRec(rec)} className="w-full text-left"
                  >
                    <div className={`rounded-2xl border overflow-hidden transition-all active:scale-[.98] ${
                      !rec.is_read ? 'bg-[#C6684F]/5 border-[#C6684F]/30' : 'bg-white border-[#DCCFBF]'
                    }`}>
                      {rec.link_thumbnail_url && (
                        <div className="relative w-full aspect-video overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={rec.link_thumbnail_url} alt={rec.title} className="w-full h-full object-cover" loading="lazy" />
                          {!rec.is_read && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#C6684F] rounded-full shadow" />}
                        </div>
                      )}
                      <div className="p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#F2E8DF] flex items-center justify-center text-lg flex-shrink-0">
                          {getRecCat(rec.category).emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-semibold text-[#C6684F] uppercase tracking-wide">{getRecCat(rec.category).label}</span>
                            {!rec.is_read && !rec.link_thumbnail_url && <span className="w-2 h-2 bg-[#C6684F] rounded-full flex-shrink-0" />}
                          </div>
                          <p className="text-sm font-semibold text-[#2C2C2C] leading-snug">{rec.title}</p>
                          {rec.message && (
                            <p className="text-sm text-[#6B6359] mt-1 leading-relaxed">{excerpt(rec.message)}</p>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-[#DCCFBF] flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </motion.div>
          )}

          {/* ── MON PARCOURS TAB ── */}
          {tab === 'parcours' && userProfile && (
            <motion.div initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="space-y-6">

              {/* ─── Stats grid ─── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <Card className="text-center py-5">
                  <Trophy size={24} className="mx-auto text-[#C6684F] mb-2" />
                  <p className="text-3xl font-bold text-[#2C2C2C]">{userProfile.total_sessions}</p>
                  <p className="text-xs text-[#6B6359] mt-0.5">sessions</p>
                </Card>
                <Card className="text-center py-5">
                  <Clock size={24} className="mx-auto text-[#C6684F] mb-2" />
                  <p className="text-3xl font-bold text-[#2C2C2C]">{formatDuration(userProfile.total_practice_minutes)}</p>
                  <p className="text-xs text-[#6B6359] mt-0.5">de pratique</p>
                </Card>
                <Card className="text-center py-5">
                  <Flame size={24} className="mx-auto text-[#C6684F] mb-2" />
                  <p className="text-3xl font-bold text-[#2C2C2C]">{userProfile.current_streak}</p>
                  <p className="text-xs text-[#6B6359] mt-0.5">jours de suite</p>
                </Card>
                <Card className="text-center py-5">
                  <Sparkles size={24} className="mx-auto text-[#C6684F] mb-2" />
                  <p className="text-3xl font-bold text-[#2C2C2C]">{userProfile.longest_streak}</p>
                  <p className="text-xs text-[#6B6359] mt-0.5">meilleure serie</p>
                </Card>
              </div>

              {/* ─── Weekly progress ─── */}
              {userProfile.weekly_rhythm > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} className="text-[#C6684F]" />
                    <p className="text-sm font-semibold text-[#2C2C2C]">Objectif de la semaine</p>
                    <span className="ml-auto text-sm text-[#C6684F] font-bold">
                      {sessionsThisWeek}/{userProfile.weekly_rhythm}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-[#F2E8DF] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#C6684F] to-[#D4856F] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (sessionsThisWeek / userProfile.weekly_rhythm) * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  {sessionsThisWeek >= userProfile.weekly_rhythm && (
                    <p className="text-xs text-[#5B9A6B] font-medium mt-2 flex items-center gap-1">
                      <Star size={12} /> Objectif atteint, bravo !
                    </p>
                  )}
                </Card>
              )}

              {/* ─── Preferred days ─── */}
              {userProfile.preferred_days.length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={16} className="text-[#C6684F]" />
                    <p className="text-sm font-semibold text-[#2C2C2C]">Ton planning</p>
                    {userProfile.preferred_time && (
                      <span className="ml-auto text-xs text-[#6B6359] bg-[#F2E8DF] px-2.5 py-0.5 rounded-full capitalize">
                        {userProfile.preferred_time}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {ALL_DAYS.map(day => {
                      const isPreferred = userProfile.preferred_days.includes(day)
                      return (
                        <div key={day} className={`flex-1 py-2.5 rounded-xl text-center text-sm font-semibold transition-all ${
                          isPreferred
                            ? 'bg-[#C6684F] text-white shadow-sm shadow-[#C6684F]/25'
                            : 'bg-[#F2E8DF] text-[#A09488]'
                        }`}>
                          {DAY_LABELS[day] ?? day.slice(0, 3)}
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* ─── Level progression ─── */}
              {userProfile.practice_level && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-[#C6684F]" />
                    <p className="text-sm font-semibold text-[#2C2C2C]">Progression</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {LEVEL_ORDER.map((lvl, i) => {
                      const currentIdx = LEVEL_ORDER.indexOf(userProfile.practice_level!)
                      const isReached = i <= currentIdx
                      const isCurrent = i === currentIdx
                      return (
                        <div key={lvl} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className={`w-full h-2 rounded-full transition-all ${
                            isReached ? 'bg-[#C6684F]' : 'bg-[#F2E8DF]'
                          }`} />
                          <span className={`text-[10px] font-medium ${
                            isCurrent ? 'text-[#C6684F] font-bold' : isReached ? 'text-[#6B6359]' : 'text-[#BFAE9F]'
                          }`}>
                            {LEVEL_LABELS[lvl] ?? lvl}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {userProfile.start_level && userProfile.start_level !== userProfile.practice_level && (
                    <p className="text-xs text-[#6B6359] mt-3 flex items-center gap-1">
                      <BookOpen size={12} />
                      Niveau de depart : <span className="font-medium capitalize">{LEVEL_LABELS[userProfile.start_level] ?? userProfile.start_level}</span>
                    </p>
                  )}
                </Card>
              )}

              {/* ─── Goals ─── */}
              {userProfile.goals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#2C2C2C] mb-3 flex items-center gap-2">
                    <Target size={15} className="text-[#C6684F]" /> Tes objectifs
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {userProfile.goals.map(g => {
                      const info = GOAL_LABELS[g]
                      return (
                        <div key={g} className="flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-[#EDE5DA]">
                          <span className="text-lg">{info?.emoji ?? '🎯'}</span>
                          <span className="text-xs font-medium text-[#2C2C2C]">{info?.label ?? g.replace(/_/g, ' ')}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ─── Earned badges ─── */}
              {earnedBadges.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#2C2C2C] mb-3 flex items-center gap-2">
                    <Award size={15} className="text-[#C6684F]" /> Badges obtenus
                    <span className="ml-auto text-xs text-[#A09488] font-normal">{earnedBadges.length} badge{earnedBadges.length > 1 ? 's' : ''}</span>
                  </h3>
                  <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                    {earnedBadges.slice(0, 8).map(badge => (
                      <motion.div
                        key={badge.id}
                        className="flex flex-col items-center text-center p-3 bg-white rounded-2xl border border-[#EDE5DA]"
                        whileHover={{ y: -2 }}
                      >
                        <span className="text-2xl mb-1.5">{badge.icon}</span>
                        <p className="text-[11px] font-semibold text-[#2C2C2C] leading-tight">{badge.name}</p>
                        <p className="text-[9px] text-[#A09488] mt-0.5">
                          {new Date(badge.earned_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Recent sessions ─── */}
              {recentCompletions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#2C2C2C] mb-3 flex items-center gap-2">
                    <Play size={15} className="text-[#C6684F]" /> Dernières séances
                  </h3>
                  <div className="space-y-2">
                    {recentCompletions.slice(0, 6).map(c => {
                      const typeInfo = SESSION_TYPE_LABELS[c.session_type] ?? SESSION_TYPE_LABELS.vod
                      const title = c.courses?.title ?? c.libre_label ?? 'Séance libre'
                      const duration = c.duration_watched_minutes ?? c.courses?.duration_minutes ?? 0
                      return (
                        <Card key={c.id} className="!p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${typeInfo.color}15` }}>
                              <Play size={14} style={{ color: typeInfo.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#2C2C2C] truncate">{title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color }}>
                                  {typeInfo.label}
                                </span>
                                {duration > 0 && (
                                  <span className="text-[10px] text-[#A09488]">{formatDuration(duration)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-[#BFAE9F] flex-shrink-0">{relativeDate(c.completed_at)}</span>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ─── Member since ─── */}
              <p className="text-xs text-[#DCCFBF] text-center pt-2">
                Membre depuis {new Date(userProfile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
