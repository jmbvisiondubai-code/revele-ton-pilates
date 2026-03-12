'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Pin, PinOff, MoreHorizontal, Pencil, Trash2, Check, X, Link as LinkIcon, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, Avatar, Button } from '@/components/ui'
import { formatRelativeDate } from '@/lib/utils'
import type { CommunityPost, ReactionType } from '@/types/database'

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'coeur',          emoji: '❤️',  label: 'Adore' },
  { type: 'applaudissement', emoji: '👏', label: 'Bravo' },
  { type: 'muscle',         emoji: '💪',  label: 'Force' },
  { type: 'etoile',         emoji: '⭐',  label: 'Super' },
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
    id: 'demo-2', user_id: 'marjorie',
    content: 'Bonjour à toutes ! Un rappel bienveillant : même 15 minutes de pratique comptent. Votre corps vous dit merci 💛',
    image_url: null, is_pinned: true, is_from_marjorie: true,
    link_url: null, link_label: null, edited_at: null,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    profiles: { first_name: 'Marjorie', avatar_url: null },
    reaction_counts: { coeur: 12, applaudissement: 8, muscle: 4, etoile: 6 },
    user_reactions: [], comment_count: 4,
  },
  {
    id: 'demo-1', user_id: 'demo',
    content: 'Première séance du matin faite ! Je me sens tellement bien après. Merci Marjorie pour cette énergie 🌿',
    image_url: null, is_pinned: false, is_from_marjorie: false,
    link_url: null, link_label: null, edited_at: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    profiles: { first_name: 'Sophie', avatar_url: null },
    reaction_counts: { coeur: 5, applaudissement: 3, muscle: 0, etoile: 0 },
    user_reactions: [], comment_count: 2,
  },
]

function openExternal(url: string) {
  const isIosPwa = (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isIosPwa) { navigator.clipboard.writeText(url).catch(() => {}) }
  else {
    const a = document.createElement('a')
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
}

// ── Reaction badge (floating on bubble, Facebook Messenger style) ────────────
function ReactionBadge({ post }: { post: PostWithMeta }) {
  const totalCount = Object.values(post.reaction_counts).reduce((a, b) => a + b, 0)
  const topReactions = REACTIONS.filter(r => post.reaction_counts[r.type] > 0).slice(0, 3)
  if (totalCount === 0) return null
  return (
    <div className="flex items-center gap-0.5 bg-white rounded-full shadow-md border border-[#DCCFBF]/60 px-1.5 py-0.5">
      {topReactions.map(r => (
        <span key={r.type} className="text-xs leading-none">{r.emoji}</span>
      ))}
      {totalCount > 1 && <span className="text-[10px] text-[#6B6359] font-medium ml-0.5">{totalCount}</span>}
    </div>
  )
}

// ── Reaction button (Facebook style: tap=❤️, long-press=picker) ─────────────
function ReactionButton({ post, myId, onReact, isOwn }: {
  post: PostWithMeta
  myId: string | null
  onReact: (postId: string, type: ReactionType) => void
  isOwn: boolean
}) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const myReaction = post.user_reactions[0] as ReactionType | undefined

  // Close picker when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Long press → open picker, short tap → toggle ❤️
  function handlePressStart() {
    timerRef.current = setTimeout(() => { setOpen(true) }, 400)
  }
  function handlePressEnd(e: React.TouchEvent | React.MouseEvent) {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      if (!open) {
        e.preventDefault()
        onReact(post.id, 'coeur')
      }
    }
  }

  function pick(type: ReactionType) {
    onReact(post.id, type)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Reaction picker popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`absolute bottom-9 ${isOwn ? 'right-0' : 'left-0'} bg-white rounded-full shadow-xl border border-[#DCCFBF] px-3 py-2 flex gap-2 z-30 whitespace-nowrap`}
          >
            {REACTIONS.map(({ type, emoji, label }) => (
              <button
                key={type}
                onClick={() => pick(type)}
                title={label}
                className={`relative text-2xl transition-transform hover:scale-125 active:scale-110 ${post.user_reactions.includes(type) ? 'scale-110 -translate-y-1' : ''}`}
              >
                {emoji}
                {post.user_reactions.includes(type) && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#C6684F] rounded-full" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimal reaction trigger — just an emoji, no border when idle */}
      <button
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={() => { if (timerRef.current) clearTimeout(timerRef.current) }}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onMouseEnter={() => { timerRef.current = setTimeout(() => setOpen(true), 600) }}
        className={`text-sm select-none transition-transform active:scale-125 ${myReaction ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
        title="Réagir (maintenir pour choisir)"
      >
        {myReaction ? REACTIONS.find(r => r.type === myReaction)?.emoji : '🤍'}
      </button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
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
  // pinnedExpanded removed — pinned messages are always visible

  const { profile } = useAuthStore()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const isAdmin = profile?.is_admin === true
  const myId = profile?.id ?? currentUserId

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setCurrentUserId(user.id) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPosts() {
    if (!isSupabaseConfigured()) { setPosts(DEMO_POSTS); return }
    const { data: postsData } = await supabase
      .from('community_posts').select('*, profiles(first_name, avatar_url)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    if (!postsData) return
    const postIds = postsData.map((p: CommunityPost) => p.id)
    const { data: reactions } = await supabase.from('post_reactions').select('post_id, reaction_type, user_id').in('post_id', postIds)
    const { data: comments } = await supabase.from('post_comments').select('post_id, id').in('post_id', postIds)
    const enriched: PostWithMeta[] = postsData.map((post: CommunityPost) => {
      const pr = reactions?.filter((r: { post_id: string }) => r.post_id === post.id) ?? []
      const reaction_counts: Record<ReactionType, number> = { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }
      pr.forEach((r: { reaction_type: string }) => { reaction_counts[r.reaction_type as ReactionType]++ })
      const user_reactions = pr.filter((r: { user_id: string }) => r.user_id === profile?.id).map((r: { reaction_type: string }) => r.reaction_type as ReactionType)
      const comment_count = comments?.filter((c: { post_id: string }) => c.post_id === post.id).length ?? 0
      return { ...post, reaction_counts, user_reactions, comment_count }
    })
    setPosts(enriched)
  }

  useEffect(() => {
    loadPosts()
    if (!isSupabaseConfigured()) return
    channelRef.current = supabase.channel('community')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, async (payload) => {
        const { data } = await supabase.from('community_posts').select('*, profiles(first_name, avatar_url)').eq('id', payload.new.id).single()
        if (data) {
          const post: PostWithMeta = { ...data, reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }, user_reactions: [], comment_count: 0 }
          setPosts(prev => prev.find(p => p.id === post.id) ? prev : [post, ...prev])
        }
      })
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetPostForm() {
    setNewPost(''); setPostImageUrl(''); setPostLinkUrl(''); setPostLinkLabel('')
    setShowImageInput(false); setShowLinkInput(false)
  }

  async function handlePost() {
    if (!newPost.trim() || !profile) return
    setIsPosting(true)
    if (!isSupabaseConfigured()) {
      const op: PostWithMeta = {
        id: `temp-${Date.now()}`, user_id: profile.id, content: newPost.trim(),
        image_url: postImageUrl.trim() || null, is_pinned: false, is_from_marjorie: isAdmin,
        link_url: postLinkUrl.trim() || null, link_label: postLinkLabel.trim() || null, edited_at: null,
        created_at: new Date().toISOString(),
        profiles: { first_name: profile.first_name, avatar_url: profile.avatar_url },
        reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }, user_reactions: [], comment_count: 0,
      }
      setPosts(prev => [op, ...prev]); resetPostForm(); setIsPosting(false); return
    }
    const { data, error } = await supabase.from('community_posts').insert({
      user_id: profile.id, content: newPost.trim(), image_url: postImageUrl.trim() || null,
      is_from_marjorie: isAdmin, link_url: postLinkUrl.trim() || null, link_label: postLinkLabel.trim() || null,
    }).select('*, profiles(first_name, avatar_url)').single()
    if (!error && data) {
      setPosts(prev => [{ ...data, reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }, user_reactions: [], comment_count: 0 }, ...prev])
      resetPostForm()
    }
    setIsPosting(false)
  }

  async function handleEditPost(postId: string) {
    if (!editPostContent.trim()) return
    const { error } = await supabase.from('community_posts').update({ content: editPostContent.trim(), edited_at: new Date().toISOString() }).eq('id', postId)
    if (!error) setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: editPostContent.trim() } : p))
    setEditingPost(null); setEditPostContent('')
  }

  async function handleDeletePost(postId: string) {
    const { error } = await supabase.from('community_posts').delete().eq('id', postId)
    if (!error) setPosts(prev => prev.filter(p => p.id !== postId))
    setDeletingPost(null)
  }

  async function togglePin(postId: string, currentPinned: boolean) {
    const { error } = await supabase.from('community_posts').update({ is_pinned: !currentPinned }).eq('id', postId)
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

  const toggleReaction = useCallback(async (postId: string, type: ReactionType) => {
    if (!profile || !isSupabaseConfigured()) return
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const hasReacted = post.user_reactions.includes(type)
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const newCounts = { ...p.reaction_counts }
      newCounts[type] = hasReacted ? Math.max(0, newCounts[type] - 1) : newCounts[type] + 1
      return { ...p, reaction_counts: newCounts, user_reactions: hasReacted ? p.user_reactions.filter(r => r !== type) : [...p.user_reactions, type] }
    }))
    if (hasReacted) {
      await supabase.from('post_reactions').delete().eq('user_id', profile.id).eq('post_id', postId).eq('reaction_type', type)
    } else {
      await supabase.from('post_reactions').insert({ user_id: profile.id, post_id: postId, reaction_type: type })
    }
  }, [posts, profile, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadComments(postId: string) {
    if (openComments === postId) { setOpenComments(null); return }
    setOpenComments(postId)
    if (!isSupabaseConfigured()) return
    const { data } = await supabase.from('post_comments')
      .select('id, user_id, content, created_at, edited_at, profiles(first_name, avatar_url)')
      .eq('post_id', postId).order('created_at', { ascending: true })
    if (data) setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: data as unknown as Comment[] } : p))
  }

  async function submitComment(postId: string) {
    if (!newComment.trim() || !profile || !isSupabaseConfigured()) return
    setIsCommenting(true)
    const { data } = await supabase.from('post_comments')
      .insert({ user_id: profile.id, post_id: postId, content: newComment.trim() })
      .select('id, user_id, content, created_at, edited_at, profiles(first_name, avatar_url)').single()
    if (data) {
      setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, comment_count: p.comment_count + 1, comments: [...(p.comments ?? []), data as unknown as Comment] }))
      setNewComment('')
    }
    setIsCommenting(false)
  }

  async function handleEditComment(postId: string, commentId: string) {
    if (!editCommentContent.trim()) return
    const { error } = await supabase.from('post_comments').update({ content: editCommentContent.trim(), edited_at: new Date().toISOString() }).eq('id', commentId)
    if (!error) {
      setPosts(prev => prev.map(p => p.id !== postId ? p : {
        ...p, comments: p.comments?.map(c => c.id === commentId ? { ...c, content: editCommentContent.trim(), edited_at: new Date().toISOString() } : c)
      }))
    }
    setEditingComment(null); setEditCommentContent('')
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
    if (!error) setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, comment_count: p.comment_count - 1, comments: p.comments?.filter(c => c.id !== commentId) }))
  }

  const pinnedPosts = posts.filter(p => p.is_pinned && p.is_from_marjorie)
  const feedPosts = posts.filter(p => !p.is_pinned || !p.is_from_marjorie)

  return (
    <div className="px-4 pt-6 pb-24 lg:px-8 lg:pt-8 max-w-5xl mx-auto">
      {(postMenu || commentMenu) && (
        <div className="fixed inset-0 z-10" onClick={() => { setPostMenu(null); setCommentMenu(null) }} />
      )}

      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Communauté</h1>
        <p className="text-text-secondary mt-1">Partage, inspire et célèbre ensemble</p>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Sidebar compose */}
        <div className="lg:col-span-1 lg:order-2 space-y-4 mb-6 lg:mb-0">
          <Card>
            <div className="flex gap-3">
              <Avatar src={profile?.avatar_url} fallback={profile?.first_name} size="md" />
              <div className="flex-1">
                <textarea
                  placeholder={isAdmin ? "Écris un message pour ta communauté..." : "Partage ton expérience, une victoire, un ressenti..."}
                  value={newPost} onChange={e => setNewPost(e.target.value)} rows={3}
                  className="w-full resize-none bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
                />
                {isAdmin && (
                  <div className="space-y-2 mt-1">
                    {showImageInput && (
                      <div className="flex items-center gap-2">
                        <ImageIcon size={13} className="text-[#6B6359] flex-shrink-0" />
                        <input type="url" placeholder="URL de l'image..." value={postImageUrl} onChange={e => setPostImageUrl(e.target.value)}
                          className="flex-1 text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
                        <button onClick={() => { setShowImageInput(false); setPostImageUrl('') }} className="text-[#DCCFBF] hover:text-[#C6684F]"><X size={13} /></button>
                      </div>
                    )}
                    {showLinkInput && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <LinkIcon size={13} className="text-[#6B6359] flex-shrink-0" />
                          <input type="url" placeholder="URL du lien..." value={postLinkUrl} onChange={e => setPostLinkUrl(e.target.value)}
                            className="flex-1 text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
                          <button onClick={() => { setShowLinkInput(false); setPostLinkUrl(''); setPostLinkLabel('') }} className="text-[#DCCFBF] hover:text-[#C6684F]"><X size={13} /></button>
                        </div>
                        {postLinkUrl && (
                          <input type="text" placeholder="Texte du bouton (ex : Voir le cours)" value={postLinkLabel} onChange={e => setPostLinkLabel(e.target.value)}
                            className="w-full text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] ml-5" />
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
                  {isAdmin ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowImageInput(v => !v)}
                        className={`p-1.5 rounded-lg transition-colors ${showImageInput ? 'text-[#C6684F] bg-[#C6684F]/10' : 'text-[#6B6359] hover:bg-[#F2E8DF]'}`}>
                        <ImageIcon size={15} />
                      </button>
                      <button onClick={() => setShowLinkInput(v => !v)}
                        className={`p-1.5 rounded-lg transition-colors ${showLinkInput ? 'text-[#C6684F] bg-[#C6684F]/10' : 'text-[#6B6359] hover:bg-[#F2E8DF]'}`}>
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
            <p className="font-[family-name:var(--font-heading)] text-base italic text-text leading-relaxed">"Ensemble, on va plus loin."</p>
            <p className="text-sm text-text-secondary mt-1">— Marjorie</p>
          </Card>
        </div>

        {/* Feed column */}
        <div className="lg:col-span-2 lg:order-1">

          {/* ── Pinned messages from Marjorie — sticky at top ── */}
          {pinnedPosts.length > 0 && (
            <div className="sticky top-0 z-20 space-y-3 -mx-4 lg:mx-0 px-4 lg:px-0 pt-2 pb-4 mb-4 bg-[#FAF6F1]/95 backdrop-blur-sm border-b border-[#C6684F]/15">
              {pinnedPosts.map((post) => (
                <div key={post.id} className="relative rounded-2xl bg-gradient-to-br from-[#FDF0EB] to-[#FAF6F1] border-2 border-[#C6684F]/30 px-4 py-3 shadow-sm">
                  {/* Pin badge */}
                  <div className="absolute -top-2.5 left-3 flex items-center gap-1 bg-[#C6684F] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                    <Pin size={10} />
                    Épinglé
                  </div>

                  <div className="flex items-start gap-3 mt-1">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <Avatar src={post.profiles?.avatar_url} fallback={post.profiles?.first_name} size="md" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-[#C6684F] rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-white">✦</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-bold text-[#C6684F]">Marjorie</span>
                        <span className="text-[9px] font-semibold bg-[#C6684F] text-white px-1.5 py-0.5 rounded-full">Coach</span>
                        <span className="text-[10px] text-[#DCCFBF]">{formatRelativeDate(post.created_at)}</span>
                        {post.edited_at && <span className="text-[10px] text-[#DCCFBF]">(modifié)</span>}
                      </div>
                      <p className="text-sm text-[#2C2C2C] leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      {post.image_url && (
                        <div className="mt-2 rounded-xl overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={post.image_url} alt="" className="w-full object-cover max-h-60" />
                        </div>
                      )}
                      {post.link_url && (
                        <button onClick={() => openExternal(post.link_url!)}
                          className="mt-2 flex items-center gap-2 bg-white/70 border border-[#DCCFBF] rounded-xl p-2.5 hover:border-[#C6684F]/50 transition-colors text-left">
                          <div className="w-7 h-7 rounded-lg bg-[#C6684F]/10 flex items-center justify-center flex-shrink-0">
                            <ExternalLink size={12} className="text-[#C6684F]" />
                          </div>
                          <span className="text-xs font-medium text-[#2C2C2C] leading-snug">{post.link_label || 'Voir le lien'}</span>
                          <ExternalLink size={11} className="text-[#C6684F] flex-shrink-0" />
                        </button>
                      )}
                      {/* Reactions on pinned */}
                      <div className="flex items-center gap-3 mt-2">
                        <ReactionButton post={post} myId={myId} onReact={toggleReaction} isOwn={false} />
                        <button onClick={() => loadComments(post.id)}
                          className={`text-sm transition-all select-none ${openComments === post.id ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}>
                          <MessageCircle size={14} />
                        </button>
                        {post.comment_count > 0 && (
                          <span className="text-[10px] text-[#6B6359]">{post.comment_count}</span>
                        )}
                        <div className="ml-auto">
                          <ReactionBadge post={post} />
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => togglePin(post.id, true)}
                        title="Désépingler"
                        className="flex-shrink-0 p-1.5 rounded-full text-[#C6684F]/40 hover:text-[#C6684F] hover:bg-[#C6684F]/10 transition-colors">
                        <PinOff size={14} />
                      </button>
                    )}
                  </div>

                  {/* Comments for pinned */}
                  <AnimatePresence>
                    {openComments === post.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mt-3 ml-11 space-y-2 border-t border-[#DCCFBF]/30 pt-2">
                        {(post.comments ?? []).map(comment => {
                          const isMyComment = !!myId && myId === comment.user_id
                          return (
                            <div key={comment.id} className="flex items-start gap-2">
                              <Avatar src={comment.profiles?.avatar_url} fallback={comment.profiles?.first_name} size="sm" />
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-[#6B6359] font-medium">{isMyComment ? 'Toi' : comment.profiles?.first_name}</span>
                                <div className="rounded-xl bg-white/70 border border-[#DCCFBF]/40 px-3 py-1.5 text-xs text-[#2C2C2C]">
                                  {comment.content}
                                  {comment.edited_at && <span className="text-[9px] text-[#DCCFBF] ml-1">(modifié)</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {profile && (
                          <div className="flex gap-2 items-center pt-1">
                            <Avatar src={profile.avatar_url} fallback={profile.first_name} size="sm" />
                            <div className="flex-1 flex gap-2">
                              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment(post.id)}
                                placeholder="Répondre..."
                                className="flex-1 bg-white border border-[#DCCFBF] text-xs placeholder:text-text-muted rounded-full px-3 py-2 focus:outline-none focus:border-[#C6684F]" />
                              <button onClick={() => submitComment(post.id)} disabled={isCommenting || !newComment.trim()} className="text-[#C6684F] disabled:opacity-40">
                                <Send size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* ── Regular feed ── */}
          {feedPosts.length === 0 && posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">Sois la première à partager quelque chose !</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {feedPosts.map((post, i) => {
                  const isOwn = !!myId && myId === post.user_id
                  const isEditingThisPost = editingPost === post.id
                  const isDeletingThisPost = deletingPost === post.id

                  return (
                    <motion.div key={post.id} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i < 5 ? i * 0.04 : 0 }}>
                      <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

                        {/* Avatar */}
                        <div className="flex-shrink-0 self-end mb-1">
                          {post.is_from_marjorie ? (
                            <div className="relative">
                              <Avatar src={post.profiles?.avatar_url} fallback={post.profiles?.first_name} size="sm" />
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#C6684F] rounded-full flex items-center justify-center">
                                <span className="text-[8px] text-white">✦</span>
                              </div>
                            </div>
                          ) : (
                            <Avatar src={post.profiles?.avatar_url} fallback={post.profiles?.first_name} size="sm" />
                          )}
                        </div>

                        {/* Content column */}
                        <div className={`flex flex-col gap-1.5 min-w-0 max-w-[78%] ${isOwn ? 'items-end' : 'items-start'}`}>

                          {/* Name + date + menu */}
                          <div className={`flex items-center gap-2 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            {post.is_from_marjorie ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#C6684F]">Marjorie</span>
                                <span className="text-[9px] font-semibold bg-[#C6684F] text-white px-1.5 py-0.5 rounded-full">Coach</span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-[#2C2C2C]">{isOwn ? 'Toi' : (post.profiles?.first_name || 'Membre')}</span>
                            )}
                            <span className="text-[10px] text-[#DCCFBF]">{formatRelativeDate(post.created_at)}</span>
                            {post.edited_at && <span className="text-[10px] text-[#DCCFBF]">(modifié)</span>}

                            {(isOwn || isAdmin) && !isEditingThisPost && (
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}
                                  className="w-5 h-5 flex items-center justify-center text-[#DCCFBF] hover:text-[#6B6359]">
                                  <MoreHorizontal size={13} />
                                </button>
                                <AnimatePresence>
                                  {postMenu === post.id && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                                      className={`absolute top-6 z-20 bg-white rounded-xl shadow-lg border border-[#DCCFBF] overflow-hidden min-w-[150px] ${isOwn ? 'right-0' : 'left-0'}`}>
                                      {isOwn && (
                                        <button onClick={() => { setEditingPost(post.id); setEditPostContent(post.content); setPostMenu(null) }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-elevated text-left">
                                          <Pencil size={13} /> Modifier
                                        </button>
                                      )}
                                      {isAdmin && (
                                        <button onClick={() => { togglePin(post.id, post.is_pinned); setPostMenu(null) }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-elevated text-left">
                                          {post.is_pinned ? <><PinOff size={13} /> Désépingler</> : <><Pin size={13} /> Épingler</>}
                                        </button>
                                      )}
                                      {(isOwn || isAdmin) && (
                                        <button onClick={() => { setDeletingPost(post.id); setPostMenu(null) }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-light text-left">
                                          <Trash2 size={13} /> Supprimer
                                        </button>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>

                          {isDeletingThisPost && (
                            <div className="bg-error-light rounded-xl p-3 flex items-center justify-between gap-3 w-full">
                              <p className="text-xs text-error">Supprimer ce message ?</p>
                              <div className="flex gap-2">
                                <button onClick={() => setDeletingPost(null)} className="text-xs text-text-secondary">Annuler</button>
                                <button onClick={() => handleDeletePost(post.id)} className="text-xs font-semibold text-error">Supprimer</button>
                              </div>
                            </div>
                          )}

                          {/* Bubble */}
                          {isEditingThisPost ? (
                            <div className="w-full">
                              <textarea value={editPostContent} onChange={e => setEditPostContent(e.target.value)} rows={3} autoFocus
                                className="w-full resize-none bg-bg-elevated text-sm text-text rounded-xl px-3 py-2 focus:outline-none border border-border-light" />
                              <div className="flex gap-2 mt-1.5 justify-end">
                                <button onClick={() => { setEditingPost(null); setEditPostContent('') }}
                                  className="flex items-center gap-1 text-xs text-text-secondary px-2.5 py-1.5 rounded-full hover:bg-bg-elevated">
                                  <X size={12} /> Annuler
                                </button>
                                <button onClick={() => handleEditPost(post.id)}
                                  className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1.5 rounded-full">
                                  <Check size={12} /> Enregistrer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className={`rounded-2xl px-4 py-3 ${
                                isOwn ? 'bg-[#F2E8DF] rounded-br-sm'
                                : post.is_from_marjorie ? 'bg-gradient-to-br from-[#FDF0EB] to-[#FAF6F1] border-2 border-[#C6684F]/30 rounded-bl-sm'
                                : 'bg-white border border-[#DCCFBF] rounded-bl-sm'
                              }`}>
                                <p className="text-sm text-[#2C2C2C] leading-relaxed whitespace-pre-wrap">{post.content}</p>
                                {post.image_url && (
                                  <div className="mt-2 rounded-xl overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={post.image_url} alt="" className="w-full object-cover max-h-60" />
                                  </div>
                                )}
                                {post.link_url && (
                                  <button onClick={() => openExternal(post.link_url!)}
                                    className="mt-2 w-full flex items-center gap-2 bg-white/70 border border-[#DCCFBF] rounded-xl p-2.5 hover:border-[#C6684F]/50 transition-colors text-left">
                                    <div className="w-7 h-7 rounded-lg bg-[#C6684F]/10 flex items-center justify-center flex-shrink-0">
                                      <ExternalLink size={12} className="text-[#C6684F]" />
                                    </div>
                                    <span className="text-xs font-medium text-[#2C2C2C] flex-1 leading-snug">{post.link_label || post.link_url}</span>
                                    <ExternalLink size={11} className="text-[#C6684F] flex-shrink-0" />
                                  </button>
                                )}
                              </div>
                              {/* Floating reaction badge (Facebook Messenger style) */}
                              <div className={`absolute -bottom-2.5 ${isOwn ? 'left-2' : 'right-2'}`}>
                                <ReactionBadge post={post} />
                              </div>
                            </div>
                          )}

                          {/* Reaction + Comment actions (minimal, under bubble) */}
                          <div className={`flex items-center gap-3 mt-0.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <ReactionButton post={post} myId={myId} onReact={toggleReaction} isOwn={isOwn} />
                            <button onClick={() => loadComments(post.id)}
                              className={`text-sm transition-all select-none ${openComments === post.id ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}>
                              <MessageCircle size={14} />
                            </button>
                            {post.comment_count > 0 && (
                              <span className="text-[10px] text-[#6B6359]">{post.comment_count}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comments — full width */}
                      <AnimatePresence>
                        {openComments === post.id && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="mt-2 ml-9 space-y-2">
                            {(post.comments ?? []).map(comment => {
                              const isMyComment = !!myId && myId === comment.user_id
                              return (
                                <div key={comment.id} className={`flex items-end gap-2 group ${isMyComment ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <Avatar src={comment.profiles?.avatar_url} fallback={comment.profiles?.first_name} size="sm" />
                                  <div className={`flex-1 min-w-0 flex flex-col gap-0.5 ${isMyComment ? 'items-end' : 'items-start'}`}>
                                    <span className="text-[10px] text-[#6B6359] px-1">{isMyComment ? 'Toi' : comment.profiles?.first_name}</span>
                                    {editingComment === comment.id ? (
                                      <div className="w-full">
                                        <input value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)}
                                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleEditComment(post.id, comment.id)}
                                          autoFocus className="w-full bg-bg-elevated text-xs text-text rounded-xl px-3 py-2 focus:outline-none border border-primary/30" />
                                        <div className="flex gap-2 mt-1 justify-end">
                                          <button onClick={() => { setEditingComment(null); setEditCommentContent('') }} className="text-[10px] text-text-secondary">Annuler</button>
                                          <button onClick={() => handleEditComment(post.id, comment.id)} className="text-[10px] font-semibold text-primary">Enregistrer</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className={`relative rounded-2xl px-3 py-2 text-xs text-[#2C2C2C] leading-relaxed ${isMyComment ? 'bg-[#F2E8DF] rounded-br-sm' : 'bg-white border border-[#DCCFBF] rounded-bl-sm'}`}>
                                        {comment.content}
                                        {comment.edited_at && <span className="text-[9px] text-[#DCCFBF] ml-1">(modifié)</span>}
                                        {isMyComment && (
                                          <div className="relative inline-block ml-1" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => setCommentMenu(commentMenu === comment.id ? null : comment.id)}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[#DCCFBF] hover:text-[#6B6359]">
                                              <MoreHorizontal size={11} />
                                            </button>
                                            <AnimatePresence>
                                              {commentMenu === comment.id && (
                                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                                  className="absolute right-0 bottom-5 z-20 bg-white rounded-xl shadow-lg border border-[#DCCFBF] overflow-hidden min-w-[120px]">
                                                  <button onClick={() => { setEditingComment(comment.id); setEditCommentContent(comment.content); setCommentMenu(null) }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-bg-elevated text-left">
                                                    <Pencil size={11} /> Modifier
                                                  </button>
                                                  <button onClick={() => { handleDeleteComment(post.id, comment.id); setCommentMenu(null) }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-error hover:bg-error-light text-left">
                                                    <Trash2 size={11} /> Supprimer
                                                  </button>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            {profile && (
                              <div className="flex gap-2 items-center pt-1">
                                <Avatar src={profile.avatar_url} fallback={profile.first_name} size="sm" />
                                <div className="flex-1 flex gap-2">
                                  <input value={newComment} onChange={e => setNewComment(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment(post.id)}
                                    placeholder="Répondre..."
                                    className="flex-1 bg-white border border-[#DCCFBF] text-xs placeholder:text-text-muted rounded-full px-3 py-2 focus:outline-none focus:border-[#C6684F]" />
                                  <button onClick={() => submitComment(post.id)} disabled={isCommenting || !newComment.trim()} className="text-[#C6684F] disabled:opacity-40">
                                    <Send size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
