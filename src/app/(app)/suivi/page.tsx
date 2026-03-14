'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, Trophy, Clock, Sparkles, Flame,
  ArrowLeft, ExternalLink, BookOpen, Calendar, Target,
  Award, Play, TrendingUp, Star, Trash2, Pencil, X,
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
  repos: { label: 'Repos', color: '#6B8E7B' },
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
  rating: number | null
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
  const [editingSession, setEditingSession] = useState<Completion | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editType, setEditType] = useState<SessionType>('vod')
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showAllSessions, setShowAllSessions] = useState(false)

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
        supabase.from('recommendations').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('course_completions')
          .select('id, completed_at, duration_watched_minutes, session_type, libre_label, rating, courses(title, duration_minutes)')
          .eq('user_id', user.id).order('completed_at', { ascending: false }),
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
    window.history.pushState({ recOpen: true }, '')
  }

  function closeRec() {
    setOpenRec(null)
  }

  // Handle hardware back button / browser back
  useEffect(() => {
    function onPopState() {
      if (openRec) {
        setOpenRec(null)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [openRec])

  // ── Edit / Delete sessions ──────────────────────────────────────────
  function startEdit(c: Completion) {
    setEditingSession(c)
    setEditLabel(c.libre_label || c.courses?.title || '')
    setEditDuration(String(c.duration_watched_minutes ?? c.courses?.duration_minutes ?? ''))
    setEditType(c.session_type)
  }

  async function saveEdit() {
    if (!editingSession) return
    setEditSaving(true)
    const updates: Record<string, unknown> = {
      duration_watched_minutes: parseInt(editDuration) || null,
      session_type: editType,
    }
    // For libre/live sessions, save the label
    if (editType === 'libre' || editType === 'live') {
      updates.libre_label = editLabel || (editType === 'libre' ? 'Séance libre' : 'Session live')
    }
    await supabase.from('course_completions').update(updates).eq('id', editingSession.id)

    // Recalculate stats
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.rpc('recalculate_user_stats', { p_user_id: user.id })
      const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (updatedProfile) { setProfile(updatedProfile); setUserProfile(updatedProfile) }
    }

    setRecentCompletions(prev => prev.map(c => c.id === editingSession.id
      ? { ...c, duration_watched_minutes: parseInt(editDuration) || null, session_type: editType, libre_label: updates.libre_label as string ?? c.libre_label }
      : c
    ))
    setEditingSession(null)
    setEditSaving(false)
  }

  async function deleteSession(id: string) {
    await supabase.from('course_completions').delete().eq('id', id)
    setRecentCompletions(prev => prev.filter(c => c.id !== id))
    setSessionsThisWeek(prev => Math.max(0, prev - 1))
    setConfirmDelete(null)
    // Recalculate stats
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.rpc('recalculate_user_stats', { p_user_id: user.id })
      const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (updatedProfile) { setProfile(updatedProfile); setUserProfile(updatedProfile) }
    }
  }

  // ── Recommendation detail view ──────────────────────────────────────
  if (openRec) {
    const cat = getRecCat(openRec.category)
    return (
      <div className="px-5 pt-4 pb-8 lg:px-8 xl:px-12 max-w-5xl mx-auto">
        <button onClick={() => { closeRec(); window.history.back() }}
          className="flex items-center gap-2.5 text-sm font-medium text-white bg-[#C6684F] hover:bg-[#b05a42] px-4 py-2 rounded-xl mb-5 transition-colors shadow-sm">
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
              <div data-tour="suivi-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
                    <span className="text-xs text-[#C6684F] font-semibold bg-[#C6684F]/10 px-2 py-0.5 rounded-full">
                      {userProfile.preferred_days.length}x/sem
                    </span>
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
                            : 'bg-[#F2E8DF] text-[#A09488] opacity-35'
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
                <div data-tour="suivi-badges">
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

              {/* ─── Sessions history — Whoop-style day timeline ─── */}
              {recentCompletions.length > 0 && (() => {
                // Group sessions by date
                const grouped = new Map<string, Completion[]>()
                recentCompletions.forEach(c => {
                  const dateKey = new Date(c.completed_at).toDateString()
                  if (!grouped.has(dateKey)) grouped.set(dateKey, [])
                  grouped.get(dateKey)!.push(c)
                })
                const days = [...grouped.entries()]
                const visibleDays = showAllSessions ? days : days.slice(0, 5)

                const today = new Date().toDateString()
                const yesterday = new Date(Date.now() - 86400000).toDateString()

                function dayLabel(dateStr: string) {
                  if (dateStr === today) return "Aujourd'hui"
                  if (dateStr === yesterday) return 'Hier'
                  const d = new Date(dateStr)
                  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                }

                return (
                  <div>
                    <h3 className="text-sm font-semibold text-[#2C2C2C] mb-3 flex items-center gap-2">
                      <Play size={15} className="text-[#C6684F]" /> Historique des séances
                      <span className="ml-auto text-xs text-[#A09488] font-normal">{recentCompletions.length} séance{recentCompletions.length > 1 ? 's' : ''}</span>
                    </h3>
                    <div className="space-y-4">
                      {visibleDays.map(([dateStr, sessions]) => {
                        const isToday = dateStr === today
                        const totalMin = sessions.reduce((s, c) => s + (c.duration_watched_minutes ?? c.courses?.duration_minutes ?? 0), 0)
                        return (
                          <div key={dateStr}>
                            {/* Day header */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isToday ? 'bg-[#C6684F]' : 'bg-[#DCCFBF]'}`} />
                              <p className={`text-[13px] font-semibold capitalize ${isToday ? 'text-[#C6684F]' : 'text-[#2C2C2C]'}`}>
                                {dayLabel(dateStr)}
                              </p>
                              <span className="text-[11px] text-[#A09488]">
                                {sessions.length} séance{sessions.length > 1 ? 's' : ''} · {formatDuration(totalMin)}
                              </span>
                            </div>
                            {/* Sessions for this day */}
                            <div className="ml-[5px] border-l-2 border-[#F0EAE2] pl-4 space-y-2">
                              {sessions.map(c => {
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
                                          <span className="text-[10px] text-[#BFAE9F]">
                                            {new Date(c.completed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={() => startEdit(c)}
                                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F2E8DF] transition-colors text-[#A09488] hover:text-[#6B6359]">
                                          <Pencil size={12} />
                                        </button>
                                        <button onClick={() => setConfirmDelete(c.id)}
                                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-[#A09488] hover:text-red-500">
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  </Card>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {days.length > 5 && (
                      <button
                        onClick={() => setShowAllSessions(v => !v)}
                        className="w-full mt-4 py-2.5 text-sm font-medium text-[#C6684F] bg-[#C6684F]/5 hover:bg-[#C6684F]/10 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        {showAllSessions ? 'Voir moins' : `Voir tout (${days.length} jours)`}
                        <ChevronRight size={14} className={`transition-transform ${showAllSessions ? 'rotate-90' : ''}`} />
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* ─── Member since ─── */}
              <p className="text-xs text-[#DCCFBF] text-center pt-2">
                Membre depuis {new Date(userProfile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            </motion.div>
          )}
        </>
      )}

      {/* ─── Edit session modal ─── */}
      <AnimatePresence>
        {editingSession && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              onClick={() => setEditingSession(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="fixed inset-4 z-[70] m-auto bg-white rounded-3xl shadow-2xl max-w-lg max-h-[85dvh] overflow-y-auto"
              style={{ height: 'fit-content' }}
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F0EAE2]">
                <p className="text-lg font-semibold text-[#2C2C2C]">Modifier la séance</p>
                <button onClick={() => setEditingSession(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F2E8DF] text-[#6B6359] hover:bg-[#EDE5DA] transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-5">
                {/* Session type selector */}
                <div>
                  <label className="text-sm font-medium text-[#6B6359] mb-2 block">Type de séance</label>
                  <div className="flex gap-2">
                    {(['vod', 'live', 'libre'] as const).map(t => {
                      const info = SESSION_TYPE_LABELS[t]
                      return (
                        <button
                          key={t}
                          onClick={() => setEditType(t)}
                          className={`flex-1 py-3 rounded-xl text-[15px] font-medium transition-colors border-2 ${
                            editType === t
                              ? 'border-[#C6684F] bg-[#C6684F]/10 text-[#C6684F]'
                              : 'border-[#EDE5DA] text-[#6B6359] hover:bg-[#FAF6F1]'
                          }`}
                        >
                          {info.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Label (for libre/live or override) */}
                {(editType === 'libre' || editType === 'live') && (
                  <div>
                    <label className="text-sm font-medium text-[#6B6359] mb-2 block">Nom de la séance</label>
                    <input
                      type="text"
                      autoCapitalize="words"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      placeholder={editType === 'libre' ? 'Ex : Pilates matinal' : 'Ex : Live Pilates avec Marjorie'}
                      className="w-full px-4 py-3.5 rounded-xl border border-[#EDE5DA] text-[15px] text-[#2C2C2C] placeholder:text-[#BFAE9F] focus:outline-none focus:border-[#C6684F] transition-colors"
                    />
                  </div>
                )}
                {editType === 'vod' && editingSession?.courses?.title && (
                  <div>
                    <label className="text-sm font-medium text-[#6B6359] mb-2 block">Cours</label>
                    <div className="px-4 py-3.5 rounded-xl border border-[#EDE5DA] bg-[#FAF6F1] text-[15px] text-[#6B6359]">
                      {editingSession.courses.title}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-[#6B6359] mb-2 block">Durée (minutes)</label>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={e => setEditDuration(e.target.value)}
                    placeholder="30"
                    min="1"
                    className="w-full px-4 py-3.5 rounded-xl border border-[#EDE5DA] text-[15px] text-[#2C2C2C] placeholder:text-[#BFAE9F] focus:outline-none focus:border-[#C6684F] transition-colors"
                  />
                  {/* Quick duration presets */}
                  <div className="flex gap-2 mt-3">
                    {[15, 20, 30, 45, 60].map(m => (
                      <button
                        key={m}
                        onClick={() => setEditDuration(String(m))}
                        className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                          editDuration === String(m)
                            ? 'bg-[#C6684F] text-white shadow-sm'
                            : 'bg-[#FAF6F1] text-[#6B6359] border border-[#EDE5DA] hover:bg-[#F2E8DF]'
                        }`}
                      >
                        {m}min
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="w-full py-3.5 rounded-xl bg-[#C6684F] text-white text-[15px] font-semibold hover:bg-[#B55A43] active:bg-[#A44F3A] transition-colors disabled:opacity-50"
                >
                  {editSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Delete confirmation modal ─── */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setConfirmDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed left-4 right-4 bottom-1/2 translate-y-1/2 z-[70] bg-white rounded-2xl shadow-2xl p-5 max-w-sm mx-auto"
            >
              <p className="text-sm font-semibold text-[#2C2C2C] mb-1">Supprimer cette séance ?</p>
              <p className="text-xs text-[#6B6359] mb-5">Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#EDE5DA] text-sm font-medium text-[#6B6359] hover:bg-[#FAF6F1] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => deleteSession(confirmDelete)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 active:bg-red-700 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
