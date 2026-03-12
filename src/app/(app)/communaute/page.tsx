'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, HandMetal, Dumbbell, Star, MessageCircle, Send, Pin, PinOff, MoreHorizontal, Pencil, Trash2, Check, X, Link as LinkIcon, Image as ImageIcon, ExternalLink } from 'lucide-react'
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
    id: 'demo-2',
    user_id: 'marjorie',
    content: 'Bonjour à toutes ! Un rappel bienveillant : même 15 minutes de pratique comptent. Votre corps vous dit merci 💛',
    image_url: null, is_pinned: true, is_from_marjorie: true,
    link_url: null, link_label: null, edited_at: null,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    profiles: { first_name: 'Marjorie', avatar_url: null },
    reaction_counts: { coeur: 12, applaudissement: 8, muscle: 4, etoile: 6 },
    user_reactions: [], comment_count: 4,
  },
  {
    id: 'demo-1',
    user_id: 'demo',
    content: 'Première séance du matin faite ! Je me sens tellement bien après. Merci Marjorie pour cette énergie 🌿',
    image_url: null, is_pinned: false, is_from_marjorie: false,
    link_url: null, link_label: null, edited_at: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    profiles: { first_name: 'Sophie', avatar_url: null },
    reaction_counts: { coeur: 5, applaudissement: 3, muscle: 2, etoile: 0 },
    user_reactions: [], comment_count: 2,
  },
]

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

export default function CommunautePage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([])
  const [newPost, setNewPost] = useState('')
  const [postImageUrl, setPostImageUrl] = useState('')
  const [postLinkUrl, setPostLinkUrl] = useState('')
  const [postLinkLabel, setPostLinkLabel] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)

  const [postMenu, setPostMenu] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editPostContent, setEditPostContent] = useState('')
  const [deletingPost, setDeletingPost] = useState<string | null>(null)

  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  const [commentMenu, setCommentMenu] = useState<string | null>(null)

  const { profile } = useAuthStore()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const myId = profile?.id ?? currentUserId

  async function loadPosts() {
    if (!isSupabaseConfigured()) { setPosts(DEMO_POSTS); return }

    const { data: postsData } = await supabase
      .from('community_posts')
      .select('*, profiles(first_name, avatar_url)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (!postsData) return

    const postIds = postsData.map((p: CommunityPost) => p.id)
    const { data: reactions } = await supabase
      .from('post_reactions').select('post_id, reaction_type, user_id').in('post_id', postIds)
    const { data: comments } = await supabase
      .from('post_comments').select('post_id, id').in('post_id', postIds)

    const enriched: PostWithMeta[] = postsData.map((post: CommunityPost) => {
      const postReactions = reactions?.filter((r: { post_id: string }) => r.post_id === post.id) ?? []
      const reaction_counts: Record<ReactionType, number> = { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }
      postReactions.forEach((r: { reaction_type: string }) => { reaction_counts[r.reaction_type as ReactionType]++ })
      const user_reactions = postReactions.filter((r: { user_id: string }) => r.user_id === profile?.id).map((r: { reaction_type: string }) => r.reaction_type as ReactionType)
      const comment_count = comments?.filter((c: { post_id: string }) => c.post_id === post.id).length ?? 0
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
        image_url: postImageUrl.trim() || null, is_pinned: false,
        is_from_marjorie: isAdmin,
        link_url: postLinkUrl.trim() || null, link_label: postLinkLabel.trim() || null, edited_at: null,
        created_at: new Date().toISOString(),
        profiles: { first_name: profile.first_name, avatar_url: profile.avatar_url },
        reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 },
        user_reactions: [], comment_count: 0,
      }
      setPosts(prev => [optimistic, ...prev])
      resetPostForm()
      setIsPosting(false)
      return
    }

    const { data, error } = await supabase
      .from('community_posts').insert({
        user_id: profile.id,
        content: newPost.trim(),
        image_url: postImageUrl.trim() || null,
        is_from_marjorie: isAdmin,
        link_url: postLinkUrl.trim() || null,
        link_label: postLinkLabel.trim() || null,
      })
      .select('*, profiles(first_name, avatar_url)').single()

    if (!error && data) {
      setPosts(prev => [{ ...data, reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }, user_reactions: [], comment_count: 0 }, ...prev])
      resetPostForm()
    }
    setIsPosting(false)
  }

  function resetPostForm() {
    setNewPost(''); setPostImageUrl(''); setPostLinkUrl(''); setPostLinkLabel('')
    setShowImageInput(false); setShowLinkInput(false)
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

  async function togglePin(postId: string, currentPinned: boolean) {
    const { error } = await supabase
      .from('community_posts').update({ is_pinned: !currentPinned }).eq('id', postId)
    if (!error) {
      setPosts(prev => {
        const updated = prev.map(p => p.id === postId ? { ...p, is_pinned: !currentPinned } : p)
        return [...updated].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1
          if (!a.is_pinned && b.is_pinned) return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      })
    }
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
    <div className="px-5 pt-6 pb-24 lg:px-8 lg:pt-8 max-w-5xl mx-auto">
      {(postMenu || commentMenu) && (
        <div className="fixed inset-0 z-10" onClick={() => { setPostMenu(null); setCommentMenu(null) }} />
      )}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Communauté</h1>
        <p className="text-text-secondary mt-1">Partage, inspire et célèbre ensemble</p>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Sidebar desktop — compose + quote */}
        <div className="lg:col-span-1 lg:order-2 space-y-4 mb-6 lg:mb-0">
          <Card>
            <div className="flex gap-3">
              <Avatar src={profile?.avatar_url} fallback={profile?.first_name} size="md" />
              <div className="flex-1">
                <textarea
                  placeholder={isAdmin ? "Écris un message pour ta communauté..." : "Partage ton expérience, une victoire, un ressenti..."}
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  rows={3}
                  className="w-full resize-none bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
                />

                {/* Admin extras: image + link */}
                {isAdmin && (
                  <div className="space-y-2 mt-2">
                    {showImageInput && (
                      <div className="flex items-center gap-2">
                        <ImageIcon size={13} className="text-[#6B6359] flex-shrink-0" />
                        <input
                          type="url"
                          placeholder="URL de l'image..."
                          value={postImageUrl}
                          onChange={e => setPostImageUrl(e.target.value)}
                          className="flex-1 text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
                        />
                        <button onClick={() => { setShowImageInput(false); setPostImageUrl('') }} className="text-[#DCCFBF] hover:text-[#C6684F]">
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    {showLinkInput && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <LinkIcon size={13} className="text-[#6B6359] flex-shrink-0" />
                          <input
                            type="url"
                            placeholder="URL du lien..."
                            value={postLinkUrl}
                            onChange={e => setPostLinkUrl(e.target.value)}
                            className="flex-1 text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
                          />
                          <button onClick={() => { setShowLinkInput(false); setPostLinkUrl(''); setPostLinkLabel('') }} className="text-[#DCCFBF] hover:text-[#C6684F]">
                            <X size={13} />
                          </button>
                        </div>
                        {postLinkUrl && (
                          <input
                            type="text"
                            placeholder="Texte du bouton (ex : Voir le cours)"
                            value={postLinkLabel}
                            onChange={e => setPostLinkLabel(e.target.value)}
                            className="w-full text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] ml-5"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
                  {/* Admin attachment buttons */}
                  {isAdmin ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowImageInput(v => !v)}
                        className={`p-1.5 rounded-lg transition-colors ${showImageInput ? 'text-[#C6684F] bg-[#C6684F]/10' : 'text-[#6B6359] hover:bg-[#F2E8DF]'}`}
                        title="Ajouter une image"
                      >
                        <ImageIcon size={15} />
                      </button>
                      <button
                        onClick={() => setShowLinkInput(v => !v)}
                        className={`p-1.5 rounded-lg transition-colors ${showLinkInput ? 'text-[#C6684F] bg-[#C6684F]/10' : 'text-[#6B6359] hover:bg-[#F2E8DF]'}`}
                        title="Ajouter un lien"
                      >
                        <LinkIcon size={15} />
                      </button>
                    </div>
                  ) : <div />}
                  <Button size="sm" onClick={handlePost} isLoading={isPosting} disabled={!newPost.trim()}>
                    <Send size={14} />Publier
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-primary/5 border-primary/10 hidden lg:block">
            <p className="font-[family-name:var(--font-heading)] text-base italic text-text leading-relaxed">
              "Ensemble, on va plus loin."
            </p>
            <p className="text-sm text-text-secondary mt-1">— Marjorie</p>
          </Card>
        </div>

        {/* Feed */}
        <div className="lg:col-span-2 lg:order-1">
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">Sois la première à partager quelque chose !</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {posts.map((post, i) => {
                  const isOwner = !!myId && myId === post.user_id
                  const canModerate = isAdmin
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
                      {/* Marjorie card — warm distinct style */}
                      {post.is_from_marjorie ? (
                        <div className={`rounded-2xl overflow-hidden border-2 ${post.is_pinned ? 'border-[#C6684F]' : 'border-[#C6684F]/30'} bg-gradient-to-br from-[#FDF0EB] to-[#FAF6F1]`}>
                          {/* Pinned banner */}
                          {post.is_pinned && (
                            <div className="bg-[#C6684F] px-4 py-1.5 flex items-center gap-1.5">
                              <Pin size={11} className="text-white" />
                              <span className="text-[11px] font-bold text-white uppercase tracking-wider">Épinglé</span>
                            </div>
                          )}

                          <div className="p-4">
                            {/* Header Marjorie */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className="relative">
                                <Avatar src={post.profiles?.avatar_url} fallback={post.profiles?.first_name} size="sm" />
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#C6684F] rounded-full flex items-center justify-center">
                                  <span className="text-[8px]">✦</span>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#C6684F]">Marjorie</span>
                                  <span className="text-[10px] font-semibold bg-[#C6684F] text-white px-1.5 py-0.5 rounded-full">Coach</span>
                                </div>
                                <p className="text-xs text-[#6B6359]">{formatRelativeDate(post.created_at)}</p>
                              </div>
                              {(isOwner || canModerate) && !isEditingThisPost && (
                                <div className="relative" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B6359] hover:bg-[#F2E8DF] transition-colors"
                                  >
                                    <MoreHorizontal size={15} />
                                  </button>
                                  <PostMenu
                                    isOpen={postMenu === post.id}
                                    isOwner={isOwner}
                                    isAdmin={canModerate}
                                    isPinned={post.is_pinned}
                                    onEdit={() => { setEditingPost(post.id); setEditPostContent(post.content); setPostMenu(null) }}
                                    onDelete={() => { setDeletingPost(post.id); setPostMenu(null) }}
                                    onPin={() => { togglePin(post.id, post.is_pinned); setPostMenu(null) }}
                                  />
                                </div>
                              )}
                            </div>

                            {isDeletingThisPost && (
                              <DeleteConfirm onCancel={() => setDeletingPost(null)} onConfirm={() => handleDeletePost(post.id)} />
                            )}

                            {isEditingThisPost ? (
                              <EditPostForm
                                value={editPostContent}
                                onChange={setEditPostContent}
                                onSave={() => handleEditPost(post.id)}
                                onCancel={() => { setEditingPost(null); setEditPostContent('') }}
                              />
                            ) : (
                              <p className="text-sm text-[#2C2C2C] leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
                            )}

                            {post.image_url && (
                              <div className="mb-3 rounded-xl overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={post.image_url} alt="" className="w-full object-cover max-h-72" />
                              </div>
                            )}

                            {post.link_url && (
                              <button onClick={() => openExternal(post.link_url!)}
                                className="mb-3 w-full flex items-center gap-3 bg-white border border-[#C6684F]/20 rounded-xl p-3 hover:border-[#C6684F]/50 transition-colors active:scale-[.98]">
                                <div className="w-8 h-8 rounded-lg bg-[#C6684F]/10 flex items-center justify-center flex-shrink-0">
                                  <ExternalLink size={14} className="text-[#C6684F]" />
                                </div>
                                <span className="text-sm font-medium text-[#2C2C2C] flex-1 text-left">
                                  {post.link_label || post.link_url}
                                </span>
                                <ExternalLink size={12} className="text-[#C6684F] flex-shrink-0" />
                              </button>
                            )}

                            <PostActions
                              post={post}
                              myId={myId}
                              onReaction={toggleReaction}
                              onComment={() => loadComments(post.id)}
                              openComments={openComments}
                            />

                            <CommentsSection
                              post={post}
                              openComments={openComments}
                              myId={myId}
                              profile={profile}
                              newComment={newComment}
                              setNewComment={setNewComment}
                              isCommenting={isCommenting}
                              editingComment={editingComment}
                              editCommentContent={editCommentContent}
                              setEditCommentContent={setEditCommentContent}
                              commentMenu={commentMenu}
                              setCommentMenu={setCommentMenu}
                              onSubmitComment={submitComment}
                              onEditComment={handleEditComment}
                              onDeleteComment={handleDeleteComment}
                              onStartEditComment={(id, content) => { setEditingComment(id); setEditCommentContent(content); setCommentMenu(null) }}
                              onCancelEditComment={() => { setEditingComment(null); setEditCommentContent('') }}
                            />
                          </div>
                        </div>
                      ) : (
                        /* Regular client post */
                        <Card className={post.is_pinned ? 'ring-1 ring-[#C6684F]/20' : ''}>
                          {post.is_pinned && (
                            <div className="flex items-center gap-1 mb-2 text-xs text-[#C6684F] font-semibold">
                              <Pin size={11} /> Épinglé
                            </div>
                          )}

                          <div className="flex items-center gap-3 mb-3">
                            <Avatar src={post.profiles?.avatar_url} fallback={post.profiles?.first_name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm text-text">{post.profiles?.first_name || 'Membre'}</span>
                              <p className="text-xs text-text-muted">{formatRelativeDate(post.created_at)}</p>
                            </div>
                            {(isOwner || canModerate) && !isEditingThisPost && (
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:bg-bg-elevated transition-colors"
                                >
                                  <MoreHorizontal size={15} />
                                </button>
                                <PostMenu
                                  isOpen={postMenu === post.id}
                                  isOwner={isOwner}
                                  isAdmin={canModerate}
                                  isPinned={post.is_pinned}
                                  onEdit={() => { setEditingPost(post.id); setEditPostContent(post.content); setPostMenu(null) }}
                                  onDelete={() => { setDeletingPost(post.id); setPostMenu(null) }}
                                  onPin={() => { togglePin(post.id, post.is_pinned); setPostMenu(null) }}
                                />
                              </div>
                            )}
                          </div>

                          {isDeletingThisPost && (
                            <DeleteConfirm onCancel={() => setDeletingPost(null)} onConfirm={() => handleDeletePost(post.id)} />
                          )}

                          {isEditingThisPost ? (
                            <EditPostForm
                              value={editPostContent}
                              onChange={setEditPostContent}
                              onSave={() => handleEditPost(post.id)}
                              onCancel={() => { setEditingPost(null); setEditPostContent('') }}
                            />
                          ) : (
                            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
                          )}

                          {post.image_url && (
                            <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={post.image_url} alt="" className="w-full object-cover max-h-64" />
                            </div>
                          )}

                          <PostActions
                            post={post}
                            myId={myId}
                            onReaction={toggleReaction}
                            onComment={() => loadComments(post.id)}
                            openComments={openComments}
                          />

                          <CommentsSection
                            post={post}
                            openComments={openComments}
                            myId={myId}
                            profile={profile}
                            newComment={newComment}
                            setNewComment={setNewComment}
                            isCommenting={isCommenting}
                            editingComment={editingComment}
                            editCommentContent={editCommentContent}
                            setEditCommentContent={setEditCommentContent}
                            commentMenu={commentMenu}
                            setCommentMenu={setCommentMenu}
                            onSubmitComment={submitComment}
                            onEditComment={handleEditComment}
                            onDeleteComment={handleDeleteComment}
                            onStartEditComment={(id, content) => { setEditingComment(id); setEditCommentContent(content); setCommentMenu(null) }}
                            onCancelEditComment={() => { setEditingComment(null); setEditCommentContent('') }}
                          />
                        </Card>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PostMenu({ isOpen, isOwner, isAdmin, isPinned, onEdit, onDelete, onPin }: {
  isOpen: boolean; isOwner: boolean; isAdmin: boolean; isPinned: boolean
  onEdit: () => void; onDelete: () => void; onPin: () => void
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -4 }}
          className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-border-light overflow-hidden min-w-[150px]"
        >
          {isOwner && (
            <button onClick={onEdit} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-elevated text-left">
              <Pencil size={13} /> Modifier
            </button>
          )}
          {isAdmin && (
            <button onClick={onPin} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-elevated text-left">
              {isPinned ? <><PinOff size={13} /> Désépingler</> : <><Pin size={13} /> Épingler</>}
            </button>
          )}
          {(isOwner || isAdmin) && (
            <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-light text-left">
              <Trash2 size={13} /> Supprimer
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="mb-3 p-3 bg-error-light rounded-xl flex items-center justify-between gap-3">
      <p className="text-xs text-error">Supprimer ce message ?</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="text-xs text-text-secondary hover:text-text">Annuler</button>
        <button onClick={onConfirm} className="text-xs font-semibold text-error">Supprimer</button>
      </div>
    </div>
  )
}

function EditPostForm({ value, onChange, onSave, onCancel }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="mb-3">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        autoFocus
        className="w-full resize-none bg-bg-elevated text-sm text-text rounded-xl px-3 py-2 focus:outline-none border border-border-light"
      />
      <div className="flex gap-2 mt-2 justify-end">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs text-text-secondary px-2.5 py-1.5 rounded-full hover:bg-bg-elevated">
          <X size={12} /> Annuler
        </button>
        <button onClick={onSave} className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1.5 rounded-full">
          <Check size={12} /> Enregistrer
        </button>
      </div>
    </div>
  )
}

function PostActions({ post, myId, onReaction, onComment, openComments }: {
  post: PostWithMeta
  myId: string | null
  onReaction: (postId: string, type: ReactionType) => void
  onComment: () => void
  openComments: string | null
}) {
  return (
    <div className="flex items-center gap-1.5 pt-3 border-t border-border-light flex-wrap">
      {REACTIONS.map(({ type, icon }) => {
        const count = post.reaction_counts[type]
        const active = post.user_reactions.includes(type)
        return (
          <button
            key={type}
            onClick={() => onReaction(post.id, type)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${active ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:bg-bg-elevated'}`}
          >
            {icon}
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
      <button
        onClick={onComment}
        className={`ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${openComments === post.id ? 'text-primary bg-primary/10' : 'text-text-muted hover:bg-bg-elevated'}`}
      >
        <MessageCircle size={13} />
        {post.comment_count > 0 ? post.comment_count : 'Commenter'}
      </button>
    </div>
  )
}

type Profile = { id: string; first_name: string; avatar_url: string | null; is_admin: boolean } | null

function CommentsSection({ post, openComments, myId, profile, newComment, setNewComment, isCommenting,
  editingComment, editCommentContent, setEditCommentContent, commentMenu, setCommentMenu,
  onSubmitComment, onEditComment, onDeleteComment, onStartEditComment, onCancelEditComment }: {
  post: PostWithMeta; openComments: string | null; myId: string | null; profile: Profile
  newComment: string; setNewComment: (v: string) => void; isCommenting: boolean
  editingComment: string | null; editCommentContent: string; setEditCommentContent: (v: string) => void
  commentMenu: string | null; setCommentMenu: (v: string | null) => void
  onSubmitComment: (postId: string) => void; onEditComment: (postId: string, commentId: string) => void
  onDeleteComment: (postId: string, commentId: string) => void
  onStartEditComment: (id: string, content: string) => void; onCancelEditComment: () => void
}) {
  return (
    <AnimatePresence>
      {openComments === post.id && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 pt-3 border-t border-border-light space-y-3"
        >
          {(post.comments ?? []).map(comment => {
            const isMyComment = !!myId && myId === comment.user_id
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
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onEditComment(post.id, comment.id)}
                        autoFocus
                        className="w-full bg-bg-elevated text-xs text-text rounded-xl px-3 py-2 focus:outline-none border border-primary/30"
                      />
                      <div className="flex gap-2 mt-1 justify-end">
                        <button onClick={onCancelEditComment} className="text-[10px] text-text-secondary">Annuler</button>
                        <button onClick={() => onEditComment(post.id, comment.id)} className="text-[10px] font-semibold text-primary">Enregistrer</button>
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
                                    onClick={() => onStartEditComment(comment.id, comment.content)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-bg-elevated text-left"
                                  >
                                    <Pencil size={11} /> Modifier
                                  </button>
                                  <button
                                    onClick={() => { onDeleteComment(post.id, comment.id); setCommentMenu(null) }}
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
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSubmitComment(post.id)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 bg-bg-elevated text-xs text-text placeholder:text-text-muted rounded-xl px-3 py-2 focus:outline-none"
                />
                <button
                  onClick={() => onSubmitComment(post.id)}
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
  )
}
