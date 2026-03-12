'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Clock, Bookmark, Sparkles, ExternalLink, Users } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card, BadgePill, Chip } from '@/components/ui'
import type { Article, ArticleCategory, Recommendation } from '@/types/database'

type Tab = 'pour_toi' | 'pour_toutes' | 'articles'

const articleCategoryLabels: Record<ArticleCategory, { label: string; emoji: string }> = {
  pratique: { label: 'Pratique', emoji: '🧘‍♀️' },
  nutrition: { label: 'Nutrition', emoji: '🥗' },
  bien_etre: { label: 'Bien-être', emoji: '🌿' },
  recuperation: { label: 'Récupération', emoji: '💆‍♀️' },
}

export const REC_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'mouvement', label: 'Mouvement', emoji: '🧘‍♀️' },
  { key: 'nutrition', label: 'Nutrition', emoji: '🥗' },
  { key: 'bien_etre', label: 'Bien-être', emoji: '🌿' },
  { key: 'mindset', label: 'Mindset', emoji: '🧠' },
  { key: 'cours', label: 'Cours', emoji: '🎯' },
  { key: 'autre', label: 'Autre', emoji: '💬' },
]

function getCatMeta(key: string | null) {
  return REC_CATEGORIES.find(c => c.key === key) ?? { label: 'Conseil', emoji: '✨' }
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

export default function ConseilsPage() {
  const [tab, setTab] = useState<Tab>('pour_toi')
  const [personalRecs, setPersonalRecs] = useState<Recommendation[]>([])
  const [generalRecs, setGeneralRecs] = useState<Recommendation[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [articleCategory, setArticleCategory] = useState<ArticleCategory | 'all'>('all')
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [{ data: personal }, { data: general }] = await Promise.all([
        supabase.from('recommendations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('recommendations').select('*').is('user_id', null).order('created_at', { ascending: false }),
      ])

      if (personal) {
        setPersonalRecs(personal as Recommendation[])
        setUnread(personal.filter((r: Recommendation) => !r.is_read).length)
      }
      if (general) setGeneralRecs(general as Recommendation[])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    async function loadArticles() {
      let query = supabase.from('articles').select('*').eq('is_published', true).order('created_at', { ascending: false })
      if (articleCategory !== 'all') query = query.eq('category', articleCategory)
      const { data } = await query
      if (data) setArticles(data as Article[])
    }
    loadArticles()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleCategory])

  async function markAsRead(recId: string) {
    await supabase.from('recommendations').update({ is_read: true }).eq('id', recId)
    setPersonalRecs(prev => prev.map(r => r.id === recId ? { ...r, is_read: true } : r))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'pour_toi', label: 'Pour toi', badge: unread },
    { key: 'pour_toutes', label: 'Pour toutes' },
    { key: 'articles', label: 'Articles' },
  ]

  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Conseils</h1>
        <p className="text-text-secondary mt-1 text-sm">Les recommandations de Marjorie & bien-être</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 relative flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
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
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* ── POUR TOI ── */}
          {tab === 'pour_toi' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {personalRecs.length === 0 ? (
                <div className="text-center py-16 text-text-secondary">
                  <Sparkles size={36} className="mx-auto mb-3 text-[#DCCFBF]" />
                  <p className="font-medium">Pas encore de conseils personnalisés</p>
                  <p className="text-sm text-text-muted mt-1">Marjorie te fera des suggestions ici dès qu'elle en aura pour toi.</p>
                </div>
              ) : (
                personalRecs.map(rec => (
                  <RecCard key={rec.id} rec={rec} onRead={() => !rec.is_read && markAsRead(rec.id)} />
                ))
              )}
            </motion.div>
          )}

          {/* ── POUR TOUTES ── */}
          {tab === 'pour_toutes' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {generalRecs.length === 0 ? (
                <div className="text-center py-16 text-text-secondary">
                  <Users size={36} className="mx-auto mb-3 text-[#DCCFBF]" />
                  <p className="font-medium">Aucun conseil général pour l'instant</p>
                  <p className="text-sm text-text-muted mt-1">Les conseils et astuces de Marjorie apparaîtront ici.</p>
                </div>
              ) : (
                generalRecs.map(rec => (
                  <RecCard key={rec.id} rec={rec} />
                ))
              )}
            </motion.div>
          )}

          {/* ── ARTICLES ── */}
          {tab === 'articles' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-5 scrollbar-hide">
                <Chip label="Tous" selected={articleCategory === 'all'} onClick={() => setArticleCategory('all')} />
                {(Object.entries(articleCategoryLabels) as [ArticleCategory, { label: string; emoji: string }][]).map(([value, { label, emoji }]) => (
                  <Chip key={value} label={label} icon={<span>{emoji}</span>} selected={articleCategory === value} onClick={() => setArticleCategory(value)} />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {articles.length === 0 ? (
                  <div className="text-center py-12 col-span-2">
                    <BookOpen size={36} className="mx-auto text-[#DCCFBF] mb-3" />
                    <p className="text-text-secondary">De nouveaux articles arrivent bientôt...</p>
                  </div>
                ) : (
                  articles.map((article, i) => (
                    <motion.div key={article.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card hover>
                        {article.thumbnail_url && (
                          <div className="relative h-40 -mx-5 -mt-5 mb-4 rounded-t-[var(--radius-lg)] overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={article.thumbnail_url} alt={article.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <BadgePill variant="accent">
                                {articleCategoryLabels[article.category]?.emoji} {articleCategoryLabels[article.category]?.label}
                              </BadgePill>
                              {article.reading_time_minutes && (
                                <span className="text-xs text-text-muted flex items-center gap-1">
                                  <Clock size={12} />{article.reading_time_minutes} min
                                </span>
                              )}
                            </div>
                            <h3 className="font-[family-name:var(--font-heading)] text-lg text-text leading-snug">{article.title}</h3>
                          </div>
                          <button type="button" className="p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer flex-shrink-0">
                            <Bookmark size={18} />
                          </button>
                        </div>
                        {article.marjorie_note && (
                          <div className="mt-3 pt-3 border-t border-border-light">
                            <p className="text-xs text-text-secondary italic">
                              <span className="font-semibold text-primary not-italic">Le mot de Marjorie : </span>
                              {article.marjorie_note}
                            </p>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

function RecCard({ rec, onRead }: { rec: Recommendation; onRead?: () => void }) {
  const cat = getCatMeta(rec.category)
  return (
    <div
      onClick={onRead}
      className={`rounded-2xl border overflow-hidden transition ${
        onRead && !rec.is_read ? 'bg-[#C6684F]/5 border-[#C6684F]/30 cursor-pointer' : 'bg-white border-[#DCCFBF]'
      }`}
    >
      {rec.link_thumbnail_url && (
        <div className="relative w-full aspect-video overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rec.link_thumbnail_url} alt={rec.title} className="w-full h-full object-cover" />
          {onRead && !rec.is_read && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#C6684F] rounded-full shadow" />}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F2E8DF] flex items-center justify-center text-lg flex-shrink-0">
            {cat.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold text-[#C6684F] uppercase tracking-wide">{cat.label}</span>
              {onRead && !rec.is_read && !rec.link_thumbnail_url && <span className="w-2 h-2 bg-[#C6684F] rounded-full" />}
            </div>
            <p className="text-sm font-semibold text-[#2C2C2C] leading-snug">{rec.title}</p>
            {rec.message && <p className="text-sm text-[#6B6359] mt-1 leading-relaxed">{rec.message}</p>}
            {rec.link_url && (
              <button
                onClick={e => { e.stopPropagation(); openExternal(rec.link_url!) }}
                className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#C6684F] hover:underline"
              >
                <ExternalLink size={11} /> {rec.link_label || 'Voir le lien'}
              </button>
            )}
            <p className="text-[11px] text-[#DCCFBF] mt-2">
              {new Date(rec.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {onRead && !rec.is_read ? ' · Appuie pour marquer comme lu' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
