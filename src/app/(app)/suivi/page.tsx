'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  MessageSquare, ChevronRight, Trophy, Clock, Sparkles, Flame,
  ArrowLeft, ExternalLink, BookOpen,
} from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card } from '@/components/ui'
import type { Recommendation, Profile } from '@/types/database'

const REC_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'mouvement', label: 'Mouvement', emoji: '🧘‍♀️' },
  { key: 'nutrition', label: 'Nutrition', emoji: '🥗' },
  { key: 'bien_etre', label: 'Bien-être', emoji: '🌿' },
  { key: 'mindset', label: 'Mindset', emoji: '🧠' },
  { key: 'cours', label: 'Cours', emoji: '🎯' },
  { key: 'autre', label: 'Autre', emoji: '💬' },
]

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

type Tab = 'messages' | 'recommandations' | 'parcours'

interface ConvPreview {
  partnerId: string
  partnerName: string
  partnerAvatar: string | null
  lastMessage: string
  lastAt: string
  unreadCount: number
}

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (d: number) => ({ opacity: 1, y: 0, transition: { delay: d * 0.08, duration: 0.4, ease: 'easeOut' } }),
}

export default function SuiviPage() {
  const [tab, setTab] = useState<Tab>('messages')
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [conversations, setConversations] = useState<ConvPreview[]>([])
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [unreadRecs, setUnreadRecs] = useState(0)
  const [openRec, setOpenRec] = useState<Recommendation | null>(null)

  const supabase = createClient()
  const { profile, setProfile } = useAuthStore()

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Ensure profile is in store
      let prof = profile
      if (!prof) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) { setProfile(data); prof = data }
      }
      setUserProfile(prof)

      // Fetch conversations (last message per partner)
      const { data: allMsgs } = await supabase
        .from('direct_messages')
        .select('sender_id, receiver_id, content, created_at, read_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (allMsgs) {
        const partnerMap = new Map<string, { lastMsg: string; lastAt: string; unread: number }>()
        for (const m of allMsgs) {
          const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id
          if (!partnerMap.has(partnerId)) {
            const isReceived = m.receiver_id === user.id
            partnerMap.set(partnerId, {
              lastMsg: m.content || '📎 Fichier',
              lastAt: m.created_at,
              unread: isReceived && !m.read_at ? 1 : 0,
            })
          } else {
            const entry = partnerMap.get(partnerId)!
            if (m.receiver_id === user.id && !m.read_at) entry.unread++
          }
        }

        const partnerIds = [...partnerMap.keys()]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', partnerIds)

        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
        const convs: ConvPreview[] = partnerIds.map(pid => {
          const entry = partnerMap.get(pid)!
          const p = profileMap.get(pid)
          return {
            partnerId: pid,
            partnerName: p?.username ?? 'Utilisateur',
            partnerAvatar: p?.avatar_url ?? null,
            lastMessage: entry.lastMsg,
            lastAt: entry.lastAt,
            unreadCount: entry.unread,
          }
        }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

        setConversations(convs)
      }

      // Fetch personal recommendations
      const { data: personal } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (personal) {
        setRecs(personal as Recommendation[])
        setUnreadRecs(personal.filter((r: Recommendation) => !r.is_read).length)
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
      <div className="px-5 pt-4 pb-8 lg:px-8 max-w-3xl mx-auto">
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
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Mon suivi</h1>
        <p className="text-text-secondary mt-1 text-sm">Ton espace personnel avec Marjorie</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6">
        {([
          { key: 'messages' as Tab, label: 'Messages' },
          { key: 'recommandations' as Tab, label: 'Conseils', badge: unreadRecs },
          { key: 'parcours' as Tab, label: 'Mon parcours' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 relative py-2 rounded-lg text-sm font-medium transition-all ${
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
          {/* ── MESSAGES TAB ── */}
          {tab === 'messages' && (
            <motion.div initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="space-y-3">
              {conversations.length === 0 ? (
                <div className="text-center py-16 text-text-secondary">
                  <MessageSquare size={36} className="mx-auto mb-3 text-[#DCCFBF]" />
                  <p className="font-medium">Aucune conversation</p>
                  <p className="text-sm text-text-muted mt-1">Tes messages avec Marjorie apparaitront ici.</p>
                </div>
              ) : (
                conversations.map((conv, i) => (
                  <motion.div key={conv.partnerId} initial="hidden" animate="visible" custom={i * 0.5} variants={fadeInUp}>
                    <Link href={`/messages?id=${conv.partnerId}`}>
                      <Card hover className="p-0">
                        <div className="flex items-center gap-3 p-4">
                          <div className="w-11 h-11 rounded-full bg-[#F2E8DF] flex items-center justify-center text-sm font-semibold text-[#C6684F] flex-shrink-0 overflow-hidden">
                            {conv.partnerAvatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={conv.partnerAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              conv.partnerName[0]?.toUpperCase() ?? '?'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-semibold text-[#2C2C2C]">{conv.partnerName}</span>
                              <span className="text-[10px] text-[#DCCFBF] flex-shrink-0">
                                {new Date(conv.lastAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B6359] truncate">{conv.lastMessage}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {conv.unreadCount > 0 && (
                              <span className="min-w-[20px] h-5 px-1 bg-[#C6684F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {conv.unreadCount}
                              </span>
                            )}
                            <ChevronRight size={14} className="text-[#DCCFBF]" />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

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
            <motion.div initial="hidden" animate="visible" custom={0} variants={fadeInUp} className="space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* Weekly progress */}
              {userProfile.weekly_rhythm > 0 && (
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#2C2C2C]">Objectif hebdomadaire</p>
                    <p className="text-sm text-[#C6684F] font-medium">
                      {Math.min(userProfile.total_sessions, userProfile.weekly_rhythm)}/{userProfile.weekly_rhythm}
                    </p>
                  </div>
                  <div className="w-full h-2.5 bg-[#F2E8DF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C6684F] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (userProfile.total_sessions / userProfile.weekly_rhythm) * 100)}%` }}
                    />
                  </div>
                </Card>
              )}

              {/* Goals */}
              {userProfile.goals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#2C2C2C] mb-3">Tes objectifs</h3>
                  <div className="flex flex-wrap gap-2">
                    {userProfile.goals.map(g => (
                      <span key={g} className="px-3 py-1.5 bg-[#F2E8DF] text-[#6B6359] text-xs font-medium rounded-full">
                        {g.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Practice level */}
              {userProfile.practice_level && (
                <Card className="bg-[#C6684F]/5 border-[#C6684F]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#C6684F]/10 flex items-center justify-center">
                      <BookOpen size={18} className="text-[#C6684F]" />
                    </div>
                    <div>
                      <p className="text-xs text-[#6B6359]">Niveau</p>
                      <p className="text-sm font-semibold text-[#2C2C2C] capitalize">{userProfile.practice_level.replace('e', 'e')}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Member since */}
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
