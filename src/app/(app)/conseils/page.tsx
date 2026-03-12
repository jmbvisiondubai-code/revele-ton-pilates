'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Clock, Sparkles, ExternalLink, ArrowLeft, ChevronRight } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card, BadgePill, Chip } from '@/components/ui'
import type { Article, ArticleCategory, Recommendation } from '@/types/database'

type Tab = 'rien_que_pour_toi' | 'inspiration'

const ARTICLE_CATS: Record<ArticleCategory, { label: string; emoji: string }> = {
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

function getRecCat(key: string | null) {
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

function excerpt(text: string, max = 120) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export default function ConseilsPage() {
  const [tab, setTab] = useState<Tab>('rien_que_pour_toi')
  const [personalRecs, setPersonalRecs] = useState<Recommendation[]>([])
  const [generalRecs, setGeneralRecs] = useState<Recommendation[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [articleFilter, setArticleFilter] = useState<ArticleCategory | 'all'>('all')
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openRec, setOpenRec] = useState<Recommendation | null>(null)
  const [openArticle, setOpenArticle] = useState<Article | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const [{ data: personal }, { data: general }, { data: arts }] = await Promise.all([
        supabase.from('recommendations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('recommendations').select('*').is('user_id', null).order('created_at', { ascending: false }),
        supabase.from('articles').select('*').eq('is_published', true).order('created_at', { ascending: false }),
      ])
      if (personal) { setPersonalRecs(personal as Recommendation[]); setUnread(personal.filter((r: Recommendation) => !r.is_read).length) }
      if (general) setGeneralRecs(general as Recommendation[])
      if (arts) setArticles(arts as Article[])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function markAsRead(rec: Recommendation) {
    if (rec.is_read) return
    await supabase.from('recommendations').update({ is_read: true }).eq('id', rec.id)
    setPersonalRecs(prev => prev.map(r => r.id === rec.id ? { ...r, is_read: true } : r))
    setUnread(prev => Math.max(0, prev - 1))
  }

  function openPersonalRec(rec: Recommendation) {
    setOpenRec(rec)
    markAsRead(rec)
  }

  const filteredArticles = articleFilter === 'all' ? articles : articles.filter(a => a.category === articleFilter)

  // ── Article detail view ──────────────────────────────────────────────
  if (openArticle) {
    const cat = ARTICLE_CATS[openArticle.category]
    return (
      <div className="px-5 pt-4 pb-8 lg:px-8 max-w-3xl mx-auto">
        <button onClick={() => setOpenArticle(null)}
          className="flex items-center gap-2 text-sm text-[#6B6359] hover:text-[#2C2C2C] mb-5 transition-colors">
          <ArrowLeft size={16} /> Retour aux conseils
        </button>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {openArticle.thumbnail_url && (
            <div className="rounded-2xl overflow-hidden mb-5 aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={openArticle.thumbnail_url} alt={openArticle.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <BadgePill variant="accent">{cat?.emoji} {cat?.label}</BadgePill>
            {openArticle.reading_time_minutes && (
              <span className="text-xs text-[#6B6359] flex items-center gap-1"><Clock size={12} />{openArticle.reading_time_minutes} min</span>
            )}
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl lg:text-3xl text-[#2C2C2C] leading-snug mb-4">
            {openArticle.title}
          </h1>
          <div className="prose prose-sm max-w-none text-[#2C2C2C] leading-relaxed whitespace-pre-wrap text-[15px]">
            {openArticle.content}
          </div>
          {openArticle.marjorie_note && (
            <div className="mt-6 bg-[#F2E8DF] rounded-2xl p-4">
              <p className="text-sm text-[#6B6359] italic">
                <span className="font-semibold text-[#C6684F] not-italic">Le mot de Marjorie : </span>
                {openArticle.marjorie_note}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  // ── Rec detail view ──────────────────────────────────────────────────
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

  // ── Main list view ───────────────────────────────────────────────────
  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Conseils</h1>
        <p className="text-text-secondary mt-1 text-sm">De Marjorie, rien que pour toi</p>
      </div>

      {/* Tabs — 2 only */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6">
        {([
          { key: 'rien_que_pour_toi', label: '✨ Juste pour toi', badge: unread },
          { key: 'inspiration', label: '🌿 Inspiration' },
        ] as { key: Tab; label: string; badge?: number }[]).map(t => (
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
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <AnimatePresence mode="wait">

          {/* ── JUSTE POUR TOI ── */}
          {tab === 'rien_que_pour_toi' && (
            <motion.div key="pour_toi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {personalRecs.length === 0 ? (
                <div className="text-center py-16 text-text-secondary">
                  <Sparkles size={36} className="mx-auto mb-3 text-[#DCCFBF]" />
                  <p className="font-medium">Rien pour l'instant</p>
                  <p className="text-sm text-text-muted mt-1">Marjorie te préparera quelque chose de spécial ici.</p>
                </div>
              ) : (
                personalRecs.map((rec, i) => (
                  <motion.button key={rec.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => openPersonalRec(rec)}
                    className="w-full text-left"
                  >
                    <div className={`rounded-2xl border overflow-hidden transition-all active:scale-[.98] ${
                      !rec.is_read ? 'bg-[#C6684F]/5 border-[#C6684F]/30' : 'bg-white border-[#DCCFBF]'
                    }`}>
                      {rec.link_thumbnail_url && (
                        <div className="relative w-full aspect-video overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={rec.link_thumbnail_url} alt={rec.title} className="w-full h-full object-cover" />
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

          {/* ── INSPIRATION (general tips + articles) ── */}
          {tab === 'inspiration' && (
            <motion.div key="inspiration" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

              {/* General tips */}
              {generalRecs.length > 0 && (
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-lg text-[#2C2C2C] mb-3">Conseils de Marjorie</h2>
                  <div className="space-y-3">
                    {generalRecs.map((rec, i) => (
                      <motion.button key={rec.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => setOpenRec(rec)}
                        className="w-full text-left"
                      >
                        <div className="bg-white border border-[#DCCFBF] rounded-2xl overflow-hidden active:scale-[.98] transition-all">
                          {rec.link_thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={rec.link_thumbnail_url} alt={rec.title} className="w-full h-32 object-cover" />
                          )}
                          <div className="p-4 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#F2E8DF] flex items-center justify-center text-lg flex-shrink-0">
                              {getRecCat(rec.category).emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-semibold text-[#C6684F] uppercase tracking-wide">{getRecCat(rec.category).label}</span>
                              <p className="text-sm font-semibold text-[#2C2C2C] leading-snug mt-0.5">{rec.title}</p>
                              {rec.message && <p className="text-sm text-[#6B6359] mt-1">{excerpt(rec.message)}</p>}
                            </div>
                            <ChevronRight size={14} className="text-[#DCCFBF] flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Articles */}
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg text-[#2C2C2C] mb-3">Articles & Bien-être</h2>

                {/* Filter chips */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-4 scrollbar-hide">
                  <Chip label="Tous" selected={articleFilter === 'all'} onClick={() => setArticleFilter('all')} />
                  {(Object.entries(ARTICLE_CATS) as [ArticleCategory, { label: string; emoji: string }][]).map(([val, { label, emoji }]) => (
                    <Chip key={val} label={label} icon={<span>{emoji}</span>} selected={articleFilter === val} onClick={() => setArticleFilter(val)} />
                  ))}
                </div>

                {filteredArticles.length === 0 ? (
                  <div className="text-center py-10">
                    <BookOpen size={32} className="mx-auto text-[#DCCFBF] mb-3" />
                    <p className="text-[#6B6359] text-sm">Aucun article pour l'instant.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredArticles.map((article, i) => (
                      <motion.button key={article.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => setOpenArticle(article)}
                        className="w-full text-left"
                      >
                        <Card hover className="p-0 overflow-hidden">
                          <div className="flex gap-0">
                            {article.thumbnail_url && (
                              <div className="w-24 lg:w-32 flex-shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={article.thumbnail_url} alt={article.title} className="w-full h-full object-cover rounded-l-[var(--radius-lg)]" style={{ minHeight: 90 }} />
                              </div>
                            )}
                            <div className="flex-1 p-4">
                              <div className="flex items-center gap-2 mb-1.5">
                                <BadgePill variant="accent">
                                  {ARTICLE_CATS[article.category]?.emoji} {ARTICLE_CATS[article.category]?.label}
                                </BadgePill>
                                {article.reading_time_minutes && (
                                  <span className="text-xs text-text-muted flex items-center gap-1 flex-shrink-0">
                                    <Clock size={11} />{article.reading_time_minutes} min
                                  </span>
                                )}
                              </div>
                              <h3 className="font-[family-name:var(--font-heading)] text-base text-text leading-snug">{article.title}</h3>
                              {article.content && (
                                <p className="text-xs text-[#6B6359] mt-1 line-clamp-2">{excerpt(article.content, 100)}</p>
                              )}
                            </div>
                            <div className="flex items-center pr-3">
                              <ChevronRight size={14} className="text-[#DCCFBF]" />
                            </div>
                          </div>
                        </Card>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {generalRecs.length === 0 && filteredArticles.length === 0 && (
                <div className="text-center py-16 text-text-secondary">
                  <BookOpen size={36} className="mx-auto mb-3 text-[#DCCFBF]" />
                  <p className="font-medium">Rien encore ici</p>
                  <p className="text-sm text-text-muted mt-1">Des conseils et articles arriveront bientôt.</p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      )}
    </div>
  )
}
