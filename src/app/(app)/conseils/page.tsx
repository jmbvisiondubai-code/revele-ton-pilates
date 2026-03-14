'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Clock, ExternalLink, ArrowLeft, ChevronRight, Send, Trash2, Heart, Pencil, MoreHorizontal, X, Check } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, BadgePill, Chip } from '@/components/ui'
import type { Article, ArticleCategory, ArticleComment } from '@/types/database'

const ARTICLE_CATS: Record<ArticleCategory, { label: string; emoji: string }> = {
  pratique: { label: 'Pratique', emoji: '🧘‍♀️' },
  nutrition: { label: 'Nutrition', emoji: '🥗' },
  bien_etre: { label: 'Bien-être', emoji: '🌿' },
  recuperation: { label: 'Récupération', emoji: '💆‍♀️' },
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

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ConseilsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [articleFilter, setArticleFilter] = useState<ArticleCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [openArticle, setOpenArticle] = useState<Article | null>(null)
  const [comments, setComments] = useState<ArticleComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [commentMenu, setCommentMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()
  const { profile, setProfile } = useAuthStore()
  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setCurrentUserId(user.id)
      // Ensure profile is loaded in the auth store (needed for isAdmin)
      if (!profile) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) setProfile(prof)
      }
      const { data: arts } = await supabase
        .from('articles').select('*').eq('is_published', true).is('deleted_at', null).order('published_at', { ascending: false, nullsFirst: false })
      if (arts) setArticles(arts as Article[])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadComments(articleId: string) {
    const { data: rawComments } = await supabase
      .from('article_comments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: true })
    if (!rawComments?.length) { setComments([]); return }
    const commentIds = rawComments.map(c => c.id)
    const userIds = [...new Set(rawComments.map(c => c.user_id))]
    const [{ data: profiles }, { data: likes }] = await Promise.all([
      supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
      supabase.from('article_comment_likes').select('comment_id, user_id').in('comment_id', commentIds),
    ])
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
    const likesByComment = new Map<string, { count: number; mine: boolean }>()
    for (const l of likes ?? []) {
      const entry = likesByComment.get(l.comment_id) ?? { count: 0, mine: false }
      entry.count++
      if (l.user_id === currentUserId) entry.mine = true
      likesByComment.set(l.comment_id, entry)
    }
    setComments(rawComments.map(c => ({
      ...c,
      profiles: profileMap.get(c.user_id) ?? undefined,
      like_count: likesByComment.get(c.id)?.count ?? 0,
      liked_by_me: likesByComment.get(c.id)?.mine ?? false,
    })) as ArticleComment[])
  }

  function handleOpenArticle(article: Article) {
    setOpenArticle(article)
    setComments([])
    setCommentText('')
    loadComments(article.id)
    window.history.pushState({ articleOpen: true }, '')
  }

  function closeArticle() {
    setOpenArticle(null)
  }

  // Handle hardware back button / browser back
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      if (openArticle) {
        e.preventDefault()
        setOpenArticle(null)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [openArticle])

  async function postComment() {
    setCommentError(null)
    if (!commentText.trim() || !openArticle || !currentUserId) {
      setCommentError(`Impossible d'envoyer (userId: ${currentUserId ? 'ok' : 'manquant'})`)
      return
    }
    setPostingComment(true)
    try {
      const { data, error } = await supabase
        .from('article_comments')
        .insert({ article_id: openArticle.id, user_id: currentUserId, content: commentText.trim() })
        .select('*')
        .single()
      if (error) {
        setCommentError(`Erreur: ${error.message} (${error.code})`)
        return
      }
      if (data) {
        const { data: prof } = await supabase.from('profiles').select('username, avatar_url').eq('id', currentUserId).single()
        const comment: ArticleComment = { ...data, profiles: prof ?? undefined, like_count: 0, liked_by_me: false }
        setComments(prev => [...prev, comment])
        setCommentText('')
      }
    } catch (err: unknown) {
      setCommentError(`Exception: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPostingComment(false)
    }
  }

  async function handleDeleteComment(id: string) {
    await supabase.from('article_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
    setConfirmDelete(null)
  }

  async function handleEditComment(id: string) {
    if (!editContent.trim()) return
    const { error } = await supabase.from('article_comments').update({ content: editContent.trim(), edited_at: new Date().toISOString() }).eq('id', id)
    if (!error) {
      setComments(prev => prev.map(c => c.id === id ? { ...c, content: editContent.trim(), edited_at: new Date().toISOString() } : c))
    }
    setEditingComment(null)
    setEditContent('')
  }

  async function toggleCommentLike(commentId: string, liked: boolean) {
    if (!currentUserId) return
    setComments(prev => prev.map(c => c.id !== commentId ? c : {
      ...c, liked_by_me: !liked, like_count: liked ? c.like_count - 1 : c.like_count + 1,
    }))
    if (liked) {
      await supabase.from('article_comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
    } else {
      await supabase.from('article_comment_likes').insert({ comment_id: commentId, user_id: currentUserId })
    }
  }

  const filteredArticles = articleFilter === 'all' ? articles : articles.filter(a => a.category === articleFilter)
  const recentArticles = articles.slice(0, 3)

  // ── Article detail view ──────────────────────────────────────────────
  if (openArticle) {
    const cat = ARTICLE_CATS[openArticle.category]
    return (
      <div className="px-5 pt-4 pb-8 lg:px-8 max-w-5xl mx-auto">
        <button onClick={() => { closeArticle(); window.history.back() }}
          className="flex items-center gap-2.5 text-sm font-medium text-white bg-[#C6684F] hover:bg-[#b05a42] px-4 py-2 rounded-xl mb-5 transition-colors shadow-sm">
          <ArrowLeft size={16} /> Retour aux articles
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
            {openArticle.published_at && (
              <span className="text-xs text-[#DCCFBF]">{formatDate(openArticle.published_at)}</span>
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

          {/* VOD link compact card */}
          {openArticle.vod_link_url && (
            <button onClick={() => openExternal(openArticle.vod_link_url!)}
              className="mt-6 w-full flex items-center gap-3 bg-white border border-[#DCCFBF] rounded-2xl overflow-hidden hover:border-[#C6684F] transition-colors active:scale-[.98]">
              {openArticle.vod_link_thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={openArticle.vod_link_thumbnail} alt="" className="w-20 h-16 object-cover flex-shrink-0" />
              ) : (
                <div className="w-20 h-16 bg-[#F2E8DF] flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎯</span>
                </div>
              )}
              <div className="flex-1 text-left py-3 pr-3">
                <p className="text-[10px] font-semibold text-[#C6684F] uppercase tracking-wide mb-0.5">Cours associé</p>
                <p className="text-sm font-medium text-[#2C2C2C] leading-snug">
                  {openArticle.vod_link_label || 'Voir le cours'}
                </p>
              </div>
              <ExternalLink size={14} className="text-[#C6684F] mr-4 flex-shrink-0" />
            </button>
          )}

          {/* Comments section */}
          <div className="mt-8">
            <h2 className="font-[family-name:var(--font-heading)] text-lg text-[#2C2C2C] mb-4">
              Commentaires {comments.length > 0 && <span className="text-sm font-normal text-[#6B6359]">({comments.length})</span>}
            </h2>

            {comments.length === 0 && (
              <p className="text-sm text-[#6B6359] mb-4">Sois la première à laisser un commentaire ✨</p>
            )}

            <div className="space-y-3 mb-5">
              {comments.map(c => {
                const isMyComment = c.user_id === currentUserId
                const canDelete = isMyComment || isAdmin
                const isEditing = editingComment === c.id
                return (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F2E8DF] flex items-center justify-center text-sm font-semibold text-[#C6684F] flex-shrink-0 overflow-hidden">
                      {c.profiles?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        c.profiles?.username?.[0]?.toUpperCase() ?? '?'
                      )}
                    </div>
                    <div className="flex-1 bg-white border border-[#DCCFBF] rounded-2xl rounded-tl-sm p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#2C2C2C]">
                          {c.profiles?.username ?? 'Anonyme'}
                          {c.edited_at && <span className="text-[10px] text-[#DCCFBF] font-normal ml-1">(modifié)</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#DCCFBF]">
                            {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                          {(isMyComment || canDelete) && (
                            <div className="relative">
                              <button onClick={() => setCommentMenu(commentMenu === c.id ? null : c.id)} className="text-[#DCCFBF] hover:text-[#6B6359] transition-colors">
                                <MoreHorizontal size={14} />
                              </button>
                              {commentMenu === c.id && (
                                <div className="absolute right-0 top-5 bg-white border border-[#DCCFBF] rounded-xl shadow-lg py-1 z-20 min-w-[130px]">
                                  {isMyComment && (
                                    <button onClick={() => { setEditingComment(c.id); setEditContent(c.content); setCommentMenu(null) }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#2C2C2C] hover:bg-[#F2E8DF] transition-colors">
                                      <Pencil size={12} /> Modifier
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button onClick={() => { setConfirmDelete(c.id); setCommentMenu(null) }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                                      <Trash2 size={12} /> Supprimer
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="flex gap-2 items-end mt-1">
                          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2}
                            className="flex-1 border border-[#DCCFBF] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F] resize-none bg-[#FAFAFA]" />
                          <button onClick={() => handleEditComment(c.id)} className="text-[#C6684F] hover:text-[#b05a42]"><Check size={16} /></button>
                          <button onClick={() => { setEditingComment(null); setEditContent('') }} className="text-[#DCCFBF] hover:text-[#6B6359]"><X size={16} /></button>
                        </div>
                      ) : (
                        <p className="text-sm text-[#2C2C2C] leading-relaxed">{c.content}</p>
                      )}
                      <div className="flex items-center mt-2">
                        <button onClick={() => toggleCommentLike(c.id, c.liked_by_me)}
                          className={`flex items-center gap-1 text-[11px] transition-colors ${c.liked_by_me ? 'text-[#C6684F]' : 'text-[#DCCFBF] hover:text-[#C6684F]'}`}>
                          <Heart size={12} fill={c.liked_by_me ? '#C6684F' : 'none'} />
                          {c.like_count > 0 && <span>{c.like_count}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Comment error */}
            {commentError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {commentError}
              </div>
            )}

            {/* Comment input */}
            <div className="flex gap-3 items-end">
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Écris ton commentaire..."
                rows={2}
                className="flex-1 border border-[#DCCFBF] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#C6684F] resize-none bg-white"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
              />
              <button
                onClick={() => { postComment() }}
                disabled={postingComment || !commentText.trim()}
                className="w-10 h-10 bg-[#C6684F] rounded-full flex items-center justify-center text-white hover:bg-[#b05a42] disabled:opacity-40 transition-colors flex-shrink-0 mb-0.5"
              >
                {postingComment
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={15} />
                }
              </button>
            </div>
          </div>

          {/* Delete confirmation modal */}
          <AnimatePresence>
            {confirmDelete && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6"
                onClick={() => setConfirmDelete(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
                  <p className="text-sm font-semibold text-[#2C2C2C] mb-2">Supprimer ce commentaire ?</p>
                  <p className="text-xs text-[#6B6359] mb-5">Cette action est irréversible.</p>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setConfirmDelete(null)}
                      className="px-4 py-2 text-xs font-medium text-[#6B6359] bg-[#F2E8DF] rounded-xl hover:bg-[#EDE5DA] transition-colors">
                      Annuler
                    </button>
                    <button onClick={() => handleDeleteComment(confirmDelete)}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#C94F4F] rounded-xl hover:bg-[#b04444] transition-colors">
                      Supprimer
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    )
  }

  // ── Main list view ───────────────────────────────────────────────────
  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 xl:px-12 lg:pt-8 max-w-5xl mx-auto">
      <div className="mb-5 lg:mb-8">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl lg:text-4xl text-text">Conseils</h1>
        <p className="text-text-secondary mt-1 text-sm lg:text-base">Articles et conseils pour toutes</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">

              {/* Récent — blocs compacts */}
              {recentArticles.length > 0 && (
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-lg text-[#2C2C2C] mb-3">Récent</h2>
                  <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                    {recentArticles.map((article, i) => {
                      const cat = ARTICLE_CATS[article.category]
                      return (
                        <motion.button key={article.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => handleOpenArticle(article)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-3 bg-white border border-[#DCCFBF] rounded-xl px-4 py-3 hover:border-[#C6684F]/40 transition-colors">
                            <span className="text-base flex-shrink-0">{cat?.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-[#2C2C2C] truncate">{article.title}</h3>
                              <p className="text-[11px] text-[#A09488]">{cat?.label}</p>
                            </div>
                            <ChevronRight size={14} className="text-[#DCCFBF] flex-shrink-0" />
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* All articles with filter */}
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg text-[#2C2C2C] mb-3">Tous les articles</h2>

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
                  <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                    {filteredArticles.map((article, i) => (
                      <motion.button key={article.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => handleOpenArticle(article)}
                        className="w-full text-left"
                      >
                        <Card hover className="p-0 overflow-hidden">
                          <div className="flex gap-0">
                            {article.thumbnail_url ? (
                              <div className="w-24 lg:w-32 flex-shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={article.thumbnail_url} alt={article.title} className="w-full h-full object-cover rounded-l-[var(--radius-lg)]" style={{ minHeight: 90 }} />
                              </div>
                            ) : (
                              <div className="w-24 lg:w-28 flex-shrink-0 bg-[#F2E8DF] flex items-center justify-center rounded-l-[var(--radius-lg)]" style={{ minHeight: 90 }}>
                                <span className="text-2xl">{ARTICLE_CATS[article.category]?.emoji}</span>
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

        </div>
      )}
    </div>
  )
}
