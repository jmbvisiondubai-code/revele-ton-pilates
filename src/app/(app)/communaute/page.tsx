'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, HandMetal, Dumbbell, Star, MessageCircle, Send, Pin, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, Avatar, Button } from '@/components/ui'
import { formatRelativeDate } from '@/lib/utils'
import type { CommunityPost, ReactionType } from '@/types/database'

const REACTIONS: { type: ReactionType; icon: React.ReactNode; label: string }[] = [
  { type: 'coeur', icon: <Heart size={15} />, label: '❤️' },
  { type: 'applaudissement', icon: <HandMetal size={15} />, label: '👏' },
  { type: 'muscle', icon: <Dumbbell size={15} />, label: '💪' },
  { type: 'etoile', icon: <Star size={15} />, label: '⭐' },
]

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  edited_at?: string | null
  profiles?: { first_name: string; avatar_url: string | null }
}

type PostWithMeta = CommunityPost & {
  reaction_counts: Record<ReactionType, number>
  user_reactions: ReactionType[]
  comment_count: number
  comments?: Comment[]
}

const DEMO_POSTS: PostWithMeta[] = [
  {
    id: 'demo-1',
    user_id: 'demo',
    content: 'Première séance du matin faite ! Je me sens tellement bien après. Merci Marjorie pour cette énergie 🌿',
    image_url: null, is_pinned: false, is_from_marjorie: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    profiles: { first_name: 'Sophie', avatar_url: null },
    reaction_counts: { coeur: 5, applaudissement: 3, muscle: 2, etoile: 0 },
    user_reactions: [], comment_count: 2,
  },
  {
    id: 'demo-2',
    user_id: 'marjorie',
    content: 'Bonjour à toutes ! Un rappel bienveillant : même 15 minutes de pratique comptent. Votre corps vous dit merci 💛',
    image_url: null, is_pinned: true, is_from_marjorie: true,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    profiles: { first_name: 'Marjorie', avatar_url: null },
    reaction_counts: { coeur: 12, applaudissement: 8, muscle: 4, etoile: 6 },
    user_reactions: [], comment_count: 4,
  },
]

export default function CommunautePage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([])
  const [newPost, setNewPost] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)

  // Edit/delete state pour les posts
  const [postMenu, setPostMenu] = useState<string | null>(null)       // id du post avec menu ouvert
  const [editingPost, setEditingPost] = useState<string | null>(null)  // id du post en cours d'édition
  const [editPostContent, setEditPostContent] = useState('')
  const [deletingPost, setDeletingPost] = useState<string | null>(null) // id du post en cours de suppression

  // Edit/delete state pour les commentaires
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  const [commentMenu, setCommentMenu] = useState<string | null>(null)

  const { profile } = useAuthStore()
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  async function loadPosts() {
    if (!isSupabaseConfigured()) { setPosts(DEMO_POSTS); return }

    const { data: postsData } = await supabase
      .from('community_posts')
      .select('*, profiles(first_name, avatar_url)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)

    if (!postsData) return

    const postIds = postsData.map(p => p.id)
    const { data: reactions } = await supabase
      .from('post_reactions').select('post_id, reaction_type, user_id').in('post_id', postIds)
    const { data: comments } = await supabase
      .from('post_comments').select('post_id, id').in('post_id', postIds)

    const enriched: PostWithMeta[] = postsData.map(post => {
      const postReactions = reactions?.filter(r => r.post_id === post.id) ?? []
      const reaction_counts: Record<ReactionType, number> = { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }
      postReactions.forEach(r => { reaction_counts[r.reaction_type as ReactionType]++ })
      const user_reactions = postReactions.filter(r => r.user_id === profile?.id).map(r => r.reaction_type as ReactionType)
      const comment_count = comments?.filter(c => c.post_id === post.id).length ?? 0
      return { ...post, reaction_counts, user_reactions, comment_count }
    })
    setPosts(enriched)
  }

  useEffect(() => {
    loadPosts()
    if (!isSupabaseConfigured()) return

    channelRef.current = supabase
      .channel('community')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, async (payload) => {
        const { data } = await supabase
          .from('community_posts').select('*, profiles(first_name, avatar_url)').eq('id', payload.new.id).single()
        if (data) {
          const post: PostWithMeta = { ...data, reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }, user_reactions: [], comment_count: 0 }
          setPosts(prev => prev.find(p => p.id === post.id) ? prev : [post, ...prev])
        }
      })
      .subscribe()

    return () => { channelRef.current?.unsubscribe() }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps


  async function handlePost() {
    if (!newPost.trim() || !profile) return
    setIsPosting(true)

    if (!isSupabaseConfigured()) {
      const optimistic: PostWithMeta = {
        id: `temp-${Date.now()}`, user_id: profile.id, content: newPost.trim(),
        image_url: null, is_pinned: false, is_from_marjorie: false,
        created_at: new Date().toISOString(),
        profiles: { first_name: profile.first_name, avatar_url: profile.avatar_url },
        reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 },
        user_reactions: [], comment_count: 0,
      }
      setPosts(prev => [optimistic, ...prev])
      setNewPost('')
      setIsPosting(false)
      return
    }

    const { data, error } = await supabase
      .from('community_posts').insert({ user_id: profile.id, content: newPost.trim() })
      .select('*, profiles(first_name, avatar_url)').single()

    if (!error && data) {
      setPosts(prev => [{ ...data, reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }, user_reactions: [], comment_count: 0 }, ...prev])
      setNewPost('')
    }
    setIsPosting(false)
  }

  async function handleEditPost(postId: string) {
    if (!editPostContent.trim()) return
    const { error } = await supabase
      .from('community_posts')
      .update({ content: editPostContent.trim(), edited_at: new Date().toISOString() })
      .eq('id', postId)
    if (!error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: editPostContent.trim() } : p))
    }
    setEditingPost(null)
    setEditPostContent('')
  }

  async function handleDeletePost(postId: string) {
    const { error } = await supabase.from('community_posts').delete().eq('id', postId)
    if (!error) setPosts(prev => prev.filter(p => p.id !== postId))
    setDeletingPost(null)
  }

  async function toggleReaction(postId: string, type: ReactionType) {
    if (!profile || !isSupabaseConfigured()) return
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const hasReacted = post.user_reactions.includes(type)

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const newCounts = { ...p.reaction_counts }
      const newUserReactions = hasReacted ? p.user_reactions.filter(r => r !== type) : [...p.user_reactions, type]
      newCounts[type] = hasReacted ? Math.max(0, newCounts[type] - 1) : newCounts[type] + 1
      return { ...p, reaction_counts: newCounts, user_reactions: newUserReactions }
    }))

    if (hasReacted) {
      await supabase.from('post_reactions').delete().eq('user_id', profile.id).eq('post_id', postId).eq('reaction_type', type)
    } else {
      await supabase.from('post_reactions').insert({ user_id: profile.id, post_id: postId, reaction_type: type })
    }
  }

  async function loadComments(postId: string) {
    if (openComments === postId) { setOpenComments(null); return }
    setOpenComments(postId)
    if (!isSupabaseConfigured()) return

    const { data } = await supabase
      .from('post_comments')
      .select('id, user_id, content, created_at, edited_at, profiles(first_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (data) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: data as unknown as Comment[] } : p))
    }
  }

  async function submitComment(postId: string) {
    if (!newComment.trim() || !profile || !isSupabaseConfigured()) return
    setIsCommenting(true)

    const { data } = await supabase
      .from('post_comments')
      .insert({ user_id: profile.id, post_id: postId, content: newComment.trim() })
      .select('id, user_id, content, created_at, edited_at, profiles(first_name, avatar_url)')
      .single()

    if (data) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p
        return { ...p, comment_count: p.comment_count + 1, comments: [...(p.comments ?? []), data as unknown as Comment] }
      }))
      setNewComment('')
    }
    setIsCommenting(false)
  }

  async function handleEditComment(postId: string, commentId: string) {
    if (!editCommentContent.trim()) return
    const { error } = await supabase
      .from('post_comments')
      .update({ content: editCommentContent.trim(), edited_at: new Date().toISOString() })
      .eq('id', commentId)
    if (!error) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p
        return { ...p, comments: p.comments?.map(c => c.id === commentId ? { ...c, content: editCommentContent.trim(), edited_at: new Date().toISOString() } : c) }
      }))
    }
    setEditingComment(null)
    setEditCommentContent('')
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
    if (!error) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p
        return { ...p, comment_count: p.comment_count - 1, comments: p.comments?.filter(c => c.id !== commentId) }
      }))
    }
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-lg mx-auto">
      {/* Backdrop transparent pour fermer les menus */}
      {(postMenu || commentMenu) && (
        <div className="fixed inset-0 z-10" onClick={() => { setPostMenu(null); setCommentMenu(null) }} />
      )}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Communauté</h1>
        <p className="text-text-secondary mt-1">Partage, inspire et célèbre ensemble</p>
      </div>

      {/* Nouveau post */}
      <Card className="mb-6">
        <div className="flex gap-3">
          <Avatar src={profile?.avatar_url} fallback={profile?.first_name} size="md" />
          <div className="flex-1">
            <textarea
              placeholder="Partage ton expérience, une victoire, un ressenti..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
            />
            <div className="flex items-center justify-end mt-2 pt-2 border-t border-border-light">
              <Button size="sm" onClick={handlePost} isLoading={isPosting} disabled={!newPost.trim()}>
                <Send size={14} />Publier
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-secondary">Sois la première à partager quelque chose !</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {posts.map((post, i) => {
              const isOwner = profile?.id === post.user_id
              const isEditingThisPost = editingPost === post.id
              const isDeletingThisPost = deletingPost === post.id

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                >
                  <Card className={post.is_from_marjorie ? 'border-primary/30 bg-primary/5' : ''}>
                    {/* En-tête du post */}
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar src={post.profiles?.avatar_url} fallback={post.profiles?.first_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-text">{post.profiles?.first_name || 'Membre'}</span>
                          {post.is_from_marjorie && (
                            <span className="text-[10px] font-semibold bg-primary text-white px-1.5 py-0.5 rounded-full">MARJORIE</span>
                          )}
                          {post.is_pinned && <Pin size={11} className="text-alert" />}
                        </div>
                        <p className="text-xs text-text-muted">{formatRelativeDate(post.created_at)}</p>
                      </div>

                      {/* Menu édition (seulement pour ses propres posts) */}
                      {isOwner && !isEditingThisPost && (
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:bg-bg-elevated transition-colors"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          <AnimatePresence>
                            {postMenu === post.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-border-light overflow-hidden min-w-[130px]"
                              >
                                <button
                                  onClick={() => { setEditingPost(post.id); setEditPostContent(post.content); setPostMenu(null) }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-elevated text-left"
                                >
                                  <Pencil size={13} /> Modifier
                                </button>
                                <button
                                  onClick={() => { setDeletingPost(post.id); setPostMenu(null) }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-light text-left"
                                >
                                  <Trash2 size={13} /> Supprimer
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    {/* Confirmation de suppression */}
                    {isDeletingThisPost && (
                      <div className="mb-3 p-3 bg-error-light rounded-xl flex items-center justify-between gap-3">
                        <p className="text-xs text-error">Supprimer ce message ?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDeletingPost(null)} className="text-xs text-text-secondary hover:text-text">Annuler</button>
                          <button onClick={() => handleDeletePost(post.id)} className="text-xs font-semibold text-error">Supprimer</button>
                        </div>
                      </div>
                    )}

                    {/* Contenu du post (ou édition) */}
                    {isEditingThisPost ? (
                      <div className="mb-3">
                        <textarea
                          value={editPostContent}
                          onChange={e => setEditPostContent(e.target.value)}
                          rows={3}
                          autoFocus
                          className="w-full resize-none bg-bg-elevated text-sm text-text rounded-xl px-3 py-2 focus:outline-none border border-border-light"
                        />
                        <div className="flex gap-2 mt-2 justify-end">
                          <button onClick={() => { setEditingPost(null); setEditPostContent('') }} className="flex items-center gap-1 text-xs text-text-secondary px-2.5 py-1.5 rounded-full hover:bg-bg-elevated">
                            <X size={12} /> Annuler
                          </button>
                          <button onClick={() => handleEditPost(post.id)} className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1.5 rounded-full">
                            <Check size={12} /> Enregistrer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
                    )}

                    {post.image_url && (
                      <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden">
                        <img src={post.image_url} alt="" className="w-full object-cover max-h-64" />
                      </div>
                    )}

                    {/* Réactions */}
                    <div className="flex items-center gap-1.5 pt-3 border-t border-border-light flex-wrap">
                      {REACTIONS.map(({ type, icon }) => {
                        const count = post.reaction_counts[type]
                        const active = post.user_reactions.includes(type)
                        return (
                          <button
                            key={type}
                            onClick={() => toggleReaction(post.id, type)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${active ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:bg-bg-elevated'}`}
                          >
                            {icon}
                            {count > 0 && <span>{count}</span>}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => loadComments(post.id)}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-text-muted hover:bg-bg-elevated transition-all cursor-pointer"
                      >
                        <MessageCircle size={13} />
                        {post.comment_count > 0 ? post.comment_count : 'Commenter'}
                      </button>
                    </div>

                    {/* Commentaires */}
                    <AnimatePresence>
                      {openComments === post.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t border-border-light space-y-3"
                        >
                          {(post.comments ?? []).map(comment => {
                            const isMyComment = profile?.id === comment.user_id
                            const isEditingThisComment = editingComment === comment.id

                            return (
                              <div key={comment.id} className="flex gap-2 group">
                                <Avatar src={comment.profiles?.avatar_url} fallback={comment.profiles?.first_name} size="sm" />
                                <div className="flex-1 min-w-0">
                                  {isEditingThisComment ? (
                                    <div>
                                      <input
                                        value={editCommentContent}
                                        onChange={e => setEditCommentContent(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleEditComment(post.id, comment.id)}
                                        autoFocus
                                        className="w-full bg-bg-elevated text-xs text-text rounded-xl px-3 py-2 focus:outline-none border border-primary/30"
                                      />
                                      <div className="flex gap-2 mt-1 justify-end">
                                        <button onClick={() => { setEditingComment(null); setEditCommentContent('') }} className="text-[10px] text-text-secondary">Annuler</button>
                                        <button onClick={() => handleEditComment(post.id, comment.id)} className="text-[10px] font-semibold text-primary">Enregistrer</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-bg-elevated rounded-xl px-3 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <span className="text-xs font-medium text-text">{comment.profiles?.first_name} </span>
                                          <span className="text-xs text-text">{comment.content}</span>
                                          {comment.edited_at && (
                                            <span className="text-[10px] text-text-muted ml-1">(modifié)</span>
                                          )}
                                        </div>
                                        {isMyComment && (
                                          <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                                            <button
                                              onClick={() => setCommentMenu(commentMenu === comment.id ? null : comment.id)}
                                              className="w-5 h-5 rounded-full flex items-center justify-center text-text-muted hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                              <MoreHorizontal size={12} />
                                            </button>
                                            <AnimatePresence>
                                              {commentMenu === comment.id && (
                                                <motion.div
                                                  initial={{ opacity: 0, scale: 0.9 }}
                                                  animate={{ opacity: 1, scale: 1 }}
                                                  exit={{ opacity: 0, scale: 0.9 }}
                                                  className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-lg border border-border-light overflow-hidden min-w-[120px]"
                                                >
                                                  <button
                                                    onClick={() => { setEditingComment(comment.id); setEditCommentContent(comment.content); setCommentMenu(null) }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-bg-elevated text-left"
                                                  >
                                                    <Pencil size={11} /> Modifier
                                                  </button>
                                                  <button
                                                    onClick={() => { handleDeleteComment(post.id, comment.id); setCommentMenu(null) }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-error hover:bg-error-light text-left"
                                                  >
                                                    <Trash2 size={11} /> Supprimer
                                                  </button>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}

                          {profile && (
                            <div className="flex gap-2">
                              <Avatar src={profile.avatar_url} fallback={profile.first_name} size="sm" />
                              <div className="flex-1 flex gap-2">
                                <input
                                  value={newComment}
                                  onChange={e => setNewComment(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment(post.id)}
                                  placeholder="Ajouter un commentaire..."
                                  className="flex-1 bg-bg-elevated text-xs text-text placeholder:text-text-muted rounded-xl px-3 py-2 focus:outline-none"
                                />
                                <button
                                  onClick={() => submitComment(post.id)}
                                  disabled={isCommenting || !newComment.trim()}
                                  className="text-primary disabled:opacity-40"
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
