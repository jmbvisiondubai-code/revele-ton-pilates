'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Send, Pin, PinOff, MoreHorizontal, Pencil, Trash2, Check, X, Link as LinkIcon, Image as ImageIcon, ExternalLink, CornerUpLeft, Smile, ChevronDown, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, Avatar, Button } from '@/components/ui'
import { formatRelativeDate } from '@/lib/utils'
import type { CommunityPost, ReactionType } from '@/types/database'

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'pouce',          emoji: '👍🏻', label: 'Super' },
  { type: 'coeur',          emoji: '❤️',  label: 'Adore' },
  { type: 'applaudissement', emoji: '👏🏻', label: 'Bravo' },
  { type: 'priere',         emoji: '🙏🏻', label: 'Merci' },
  { type: 'muscle',         emoji: '💪🏻', label: 'Force' },
  { type: 'fete',           emoji: '🎉',  label: 'Youpi' },
  { type: 'feu',            emoji: '🔥',  label: 'Feu'   },
]

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  edited_at?: string | null
  profiles?: { first_name: string; avatar_url: string | null }
}

type ReactionUser = { user_id: string; reaction_type: ReactionType; first_name: string }

type PostWithMeta = CommunityPost & {
  reaction_counts: Record<ReactionType, number>
  user_reactions: ReactionType[]
  reaction_users: ReactionUser[]
  comment_count: number
  comments?: Comment[]
}

const DEMO_POSTS: PostWithMeta[] = [
  {
    id: 'demo-2', user_id: 'marjorie',
    content: 'Bonjour à toutes ! Un rappel bienveillant : même 15 minutes de pratique comptent. Votre corps vous dit merci 💛',
    image_url: null, is_pinned: true, is_from_marjorie: true,
    link_url: null, link_label: null, reply_to_id: null, reply_to_preview: null, reply_to_author: null, edited_at: null,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    profiles: { first_name: 'Marjorie', avatar_url: null },
    reaction_counts: { pouce: 5, coeur: 12, applaudissement: 8, priere: 3, muscle: 4, fete: 6, feu: 7 },
    user_reactions: [], reaction_users: [], comment_count: 4,
  },
  {
    id: 'demo-1', user_id: 'demo',
    content: 'Première séance du matin faite ! Je me sens tellement bien après. Merci Marjorie pour cette énergie 🌿',
    image_url: null, is_pinned: false, is_from_marjorie: false,
    link_url: null, link_label: null, reply_to_id: null, reply_to_preview: null, reply_to_author: null, edited_at: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    profiles: { first_name: 'Sophie', avatar_url: null },
    reaction_counts: { pouce: 3, coeur: 5, applaudissement: 3, priere: 0, muscle: 0, fete: 0, feu: 0 },
    user_reactions: [], reaction_users: [], comment_count: 2,
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

// ── Quick like button (tap = ❤️) ──────────────────────────────────────────────
function QuickLikeButton({ post, onReact }: {
  post: PostWithMeta
  onReact: (postId: string, type: ReactionType) => void
}) {
  return (
    <button
      onClick={() => onReact(post.id, 'coeur')}
      className={`select-none transition-all active:scale-125 ${post.user_reactions.includes('coeur') ? 'text-[#C6684F]' : 'text-[#DCCFBF] hover:text-[#C6684F]/60'}`}
      title="J'aime"
    >
      <Heart size={14} className={post.user_reactions.includes('coeur') ? 'fill-[#C6684F]' : ''} />
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CommunautePage() {
  const [isEmbedded, setIsEmbedded] = useState(false)
  useEffect(() => {
    try { setIsEmbedded(window.self !== window.top) } catch { setIsEmbedded(true) }
  }, [])

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
  const [openReactions, setOpenReactions] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ postId: string; isOwn: boolean; content: string; authorName: string } | null>(null)
  const [swipingPost, setSwipingPost] = useState<{ postId: string; deltaX: number } | null>(null)
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; authorName: string } | null>(null)
  const [doubleTapHeart, setDoubleTapHeart] = useState<string | null>(null)
  const [highlightPost, setHighlightPost] = useState<string | null>(null)
  const [hoverReactionPost, setHoverReactionPost] = useState<string | null>(null)

  const { profile } = useAuthStore()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const lastTapRef = useRef<{ postId: string; time: number } | null>(null)

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
    const { data: reactions } = await supabase.from('post_reactions').select('post_id, reaction_type, user_id, profiles(first_name)').in('post_id', postIds)
    const { data: comments } = await supabase.from('post_comments').select('post_id, id').in('post_id', postIds)
    const enriched: PostWithMeta[] = postsData.map((post: CommunityPost) => {
      const pr = reactions?.filter((r: { post_id: string }) => r.post_id === post.id) ?? []
      const reaction_counts: Record<ReactionType, number> = { pouce: 0, coeur: 0, applaudissement: 0, priere: 0, muscle: 0, fete: 0, feu: 0 }
      pr.forEach((r: { reaction_type: string }) => { reaction_counts[r.reaction_type as ReactionType]++ })
      const user_reactions = pr.filter((r: { user_id: string }) => r.user_id === profile?.id).map((r: { reaction_type: string }) => r.reaction_type as ReactionType)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reaction_users: ReactionUser[] = pr.map((r: any) => ({
        user_id: r.user_id, reaction_type: r.reaction_type as ReactionType,
        first_name: (Array.isArray(r.profiles) ? r.profiles[0]?.first_name : r.profiles?.first_name) ?? 'Membre',
      }))
      const comment_count = comments?.filter((c: { post_id: string }) => c.post_id === post.id).length ?? 0
      return { ...post, reaction_counts, user_reactions, reaction_users, comment_count }
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
          const post: PostWithMeta = { ...data, reaction_counts: { pouce: 0, coeur: 0, applaudissement: 0, priere: 0, muscle: 0, fete: 0, feu: 0 }, user_reactions: [], reaction_users: [], comment_count: 0 }
          setPosts(prev => prev.find(p => p.id === post.id) ? prev : [post, ...prev])
        }
      })
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (posts.length === 0) return
    messagesEndRef.current?.scrollIntoView({ behavior: isInitialLoad.current ? 'instant' : 'smooth' })
    isInitialLoad.current = false
  }, [posts.length])

  function resetPostForm() {
    setNewPost(''); setPostImageUrl(''); setPostLinkUrl(''); setPostLinkLabel('')
    setShowImageInput(false); setShowLinkInput(false); setReplyingTo(null)
  }

  async function handlePost() {
    if (!newPost.trim() || !profile) return
    setIsPosting(true)
    if (!isSupabaseConfigured()) {
      const op: PostWithMeta = {
        id: `temp-${Date.now()}`, user_id: profile.id, content: newPost.trim(),
        image_url: postImageUrl.trim() || null, is_pinned: false, is_from_marjorie: isAdmin,
        link_url: postLinkUrl.trim() || null, link_label: postLinkLabel.trim() || null,
        reply_to_id: replyingTo?.id ?? null, reply_to_preview: replyingTo ? replyingTo.content.slice(0, 120) : null, reply_to_author: replyingTo?.authorName ?? null,
        edited_at: null,
        created_at: new Date().toISOString(),
        profiles: { first_name: profile.first_name, avatar_url: profile.avatar_url },
        reaction_counts: { pouce: 0, coeur: 0, applaudissement: 0, priere: 0, muscle: 0, fete: 0, feu: 0 }, user_reactions: [], reaction_users: [], comment_count: 0,
      }
      setPosts(prev => [op, ...prev]); resetPostForm(); setIsPosting(false); return
    }
    const { data, error } = await supabase.from('community_posts').insert({
      user_id: profile.id, content: newPost.trim(), image_url: postImageUrl.trim() || null,
      is_from_marjorie: isAdmin, link_url: postLinkUrl.trim() || null, link_label: postLinkLabel.trim() || null,
      reply_to_id: replyingTo?.id ?? null,
      reply_to_preview: replyingTo ? replyingTo.content.slice(0, 120) : null,
      reply_to_author: replyingTo?.authorName ?? null,
    }).select('*, profiles(first_name, avatar_url)').single()
    if (!error && data) {
      setPosts(prev => [{ ...data, reaction_counts: { pouce: 0, coeur: 0, applaudissement: 0, priere: 0, muscle: 0, fete: 0, feu: 0 }, user_reactions: [], reaction_users: [], comment_count: 0 }, ...prev])
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
    const existing = post.user_reactions[0] as ReactionType | undefined
    const isSame = existing === type
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const newCounts = { ...p.reaction_counts }
      if (existing) newCounts[existing] = Math.max(0, newCounts[existing] - 1)
      if (!isSame) newCounts[type] = newCounts[type] + 1
      const newReactionUsers = p.reaction_users.filter(u => u.user_id !== profile.id)
      if (!isSame) newReactionUsers.push({ user_id: profile.id, reaction_type: type, first_name: profile.first_name })
      return { ...p, reaction_counts: newCounts, user_reactions: isSame ? [] : [type], reaction_users: newReactionUsers }
    }))
    // DB: remove any existing reaction first
    if (existing) {
      await supabase.from('post_reactions').delete().eq('user_id', profile.id).eq('post_id', postId)
    }
    // DB: add new if not toggling off
    if (!isSame) {
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

  // ── Gesture handlers (long press = picker, swipe right = reply) ──────────
  function startBubbleGesture(postId: string, isOwn: boolean, content: string, authorName: string, x: number, y: number) {
    touchStartRef.current = { x, y }
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => setContextMenu({ postId, isOwn, content, authorName }), 500)
  }
  function moveBubbleGesture(postId: string, x: number, y: number) {
    if (!touchStartRef.current) return
    const dx = x - touchStartRef.current.x
    const dy = Math.abs(y - touchStartRef.current.y)
    if (Math.abs(dx) > 8 || dy > 8) {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    }
    if (dx > 8 && dy < Math.abs(dx)) setSwipingPost({ postId, deltaX: Math.min(dx, 80) })
    else if (dy > 15) setSwipingPost(null)
  }
  function endBubbleGesture(postId: string, content: string, authorName: string) {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    // Double-tap detection (only if not swiping)
    if (!swipingPost) {
      const now = Date.now()
      if (lastTapRef.current?.postId === postId && now - lastTapRef.current.time < 350) {
        const alreadyLiked = posts.find(p => p.id === postId)?.user_reactions.includes('coeur')
        if (!alreadyLiked) toggleReaction(postId, 'coeur')
        setDoubleTapHeart(postId)
        setTimeout(() => setDoubleTapHeart(null), 700)
        lastTapRef.current = null
        return
      }
      lastTapRef.current = { postId, time: Date.now() }
    }
    if (swipingPost?.postId === postId && swipingPost.deltaX >= 60) {
      setReplyingTo({ id: postId, content, authorName })
    }
    setSwipingPost(null)
    touchStartRef.current = null
  }

  function scrollToPost(postId: string) {
    const el = document.getElementById(`post-${postId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightPost(postId)
    setTimeout(() => setHighlightPost(null), 1400)
  }

  const pinnedPosts = posts.filter(p => p.is_pinned && p.is_from_marjorie)
  const feedPosts = posts.filter(p => !p.is_pinned || !p.is_from_marjorie).slice().reverse()
  const contextPost = contextMenu ? posts.find(p => p.id === contextMenu.postId) ?? null : null

  return (
    <div className="px-4 pt-6 pb-compose lg:px-8 lg:pt-8 max-w-5xl mx-auto">
      {(postMenu || commentMenu) && (
        <div className="fixed inset-0 z-10" onClick={() => { setPostMenu(null); setCommentMenu(null) }} />
      )}

      <div className="sticky top-0 z-30 -mx-4 lg:-mx-8 px-4 lg:px-8 pt-6 lg:pt-8 pb-4 mb-1 bg-[#FAF6F1]/95 backdrop-blur-sm">
        <Link
          href="/messages"
          className="lg:hidden inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors mb-2"
        >
          <ArrowLeft size={14} />
          Messages
        </Link>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Communauté</h1>
        <p className="text-text-secondary mt-1">Partage, inspire et célèbre ensemble</p>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Sidebar — desktop only (quote card) */}
        <div className="hidden lg:block lg:col-span-1 lg:order-2 space-y-4">
          <Card className="bg-primary/5 border-primary/10">
            <p className="font-[family-name:var(--font-heading)] text-base italic text-text leading-relaxed">"Ensemble, on va plus loin."</p>
            <p className="text-sm text-text-secondary mt-1">— Marjorie</p>
          </Card>
        </div>

        {/* Feed column */}
        <div className="relative lg:col-span-2 lg:order-1 min-h-dvh">
          {/* Background pattern — fills full viewport height */}
          <div aria-hidden="true" className="absolute inset-y-0 -left-3 -right-3 lg:-left-5 lg:-right-5 bg-[url('/fond-mobile.png')] md:bg-[url('/fond-desktop.png')] bg-cover bg-center bg-scroll opacity-[0.28] pointer-events-none" />

          {/* ── Pinned messages from Marjorie — sticky at top ── */}
          {pinnedPosts.length > 0 && (
            <div className="sticky top-[8.5rem] lg:top-[9rem] z-20 space-y-3 -mx-4 lg:mx-0 px-4 lg:px-0 pt-2 pb-5 mb-4 bg-gradient-to-b from-[#FAF6F1]/95 via-[#FAF6F1]/80 to-transparent backdrop-blur-sm">
              {pinnedPosts.map((post) => {
                const pinnedAuthor = 'Marjorie'
                const isPinnedOwn = !!myId && myId === post.user_id
                return (
                  <div key={post.id} className="relative select-none group"
                    onContextMenu={e => e.preventDefault()}
                    onTouchStart={e => startBubbleGesture(post.id, false, post.content, pinnedAuthor, e.touches[0].clientX, e.touches[0].clientY)}
                    onTouchMove={e => moveBubbleGesture(post.id, e.touches[0].clientX, e.touches[0].clientY)}
                    onTouchEnd={() => endBubbleGesture(post.id, post.content, pinnedAuthor)}
                    style={{
                      transform: swipingPost?.postId === post.id ? `translateX(${swipingPost.deltaX}px)` : undefined,
                      transition: swipingPost?.postId === post.id ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                  >
                    {/* Swipe-to-reply indicator */}
                    {swipingPost?.postId === post.id && swipingPost.deltaX > 10 && (
                      <div className="absolute -left-7 top-1/2 -translate-y-1/2" style={{ opacity: Math.min(swipingPost.deltaX / 50, 1) }}>
                        <CornerUpLeft size={16} className="text-[#C6684F]" />
                      </div>
                    )}
                    <div className="relative rounded-2xl bg-gradient-to-br from-[#FDF0EB] to-[#FAF6F1] border-2 border-[#C6684F]/30 px-4 py-3 shadow-sm">
                      {/* Double-tap heart */}
                      <AnimatePresence>
                        {doubleTapHeart === post.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1.4 }} exit={{ opacity: 0, scale: 1.8 }} transition={{ duration: 0.25 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                            <span className="text-5xl drop-shadow-xl">❤️</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
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
                          {/* Reaction count badges */}
                          {Object.values(post.reaction_counts).reduce((a,b)=>a+b,0) > 0 && (
                            <button onClick={() => setOpenReactions(openReactions === post.id ? null : post.id)}
                              className="flex items-center gap-0.5 mt-1.5">
                              {REACTIONS.filter(r => post.reaction_counts[r.type] > 0).slice(0,3).map(r => (
                                <span key={r.type} className="text-xs leading-none">{r.emoji}</span>
                              ))}
                              <span className="text-[10px] text-[#6B6359] ml-0.5 font-medium">
                                {Object.values(post.reaction_counts).reduce((a,b)=>a+b,0)}
                              </span>
                            </button>
                          )}
                          <AnimatePresence>
                            {openReactions === post.id && post.reaction_users.length > 0 && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="flex flex-wrap gap-1.5 mt-1">
                                {REACTIONS.filter(r => post.reaction_counts[r.type] > 0).map(r => {
                                  const names = post.reaction_users.filter(u => u.reaction_type === r.type)
                                    .map(u => u.user_id === myId ? 'Toi' : u.first_name)
                                  if (!names.length) return null
                                  return (
                                    <div key={r.type} className="flex items-center gap-1 bg-white border border-[#DCCFBF] rounded-full px-2 py-0.5 text-[10px] text-[#6B6359]">
                                      <span>{r.emoji}</span><span>{names.join(', ')}</span>
                                    </div>
                                  )
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        {/* Desktop hover actions */}
                        <div className={`hidden md:flex flex-row items-center gap-0.5 self-start mt-1 transition-opacity duration-150 ${hoverReactionPost === post.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <div className="relative">
                            <button onClick={() => setHoverReactionPost(prev => prev === post.id ? null : post.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-full text-[#C6684F]/50 hover:text-[#C6684F] hover:bg-[#C6684F]/10 transition-colors" title="Réagir">
                              <Smile size={15} />
                            </button>
                            {hoverReactionPost === post.id && (
                              <div className="absolute top-9 left-0 z-30 bg-white rounded-2xl shadow-xl border border-[#DCCFBF] px-2 py-2 flex gap-1">
                                {REACTIONS.map(r => (
                                  <button key={r.type}
                                    onClick={() => { toggleReaction(post.id, r.type); setHoverReactionPost(null) }}
                                    className={`text-xl hover:scale-125 transition-transform p-0.5 rounded ${post.user_reactions.includes(r.type) ? 'ring-2 ring-[#C6684F]/40' : ''}`}
                                    title={r.label}>
                                    {r.emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button onClick={() => setContextMenu({ postId: post.id, isOwn: isPinnedOwn, content: post.content, authorName: pinnedAuthor })}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-[#C6684F]/50 hover:text-[#C6684F] hover:bg-[#C6684F]/10 transition-colors" title="Plus d'options">
                            <ChevronDown size={15} />
                          </button>
                        </div>
                        {isAdmin && (
                          <button onClick={() => togglePin(post.id, true)}
                            title="Désépingler"
                            className="flex-shrink-0 p-1.5 rounded-full text-[#C6684F]/40 hover:text-[#C6684F] hover:bg-[#C6684F]/10 transition-colors">
                            <PinOff size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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
                  const authorName = post.is_from_marjorie ? 'Marjorie' : (isOwn ? 'Toi' : (post.profiles?.first_name || 'Membre'))

                  return (
                    <motion.div key={post.id} id={`post-${post.id}`} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i < 5 ? i * 0.04 : 0 }}>
                      <div className={`flex items-end gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`} onMouseEnter={() => { if (hoverReactionPost && hoverReactionPost !== post.id) setHoverReactionPost(null) }}>

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
                            <div
                              className="relative select-none"
                              onContextMenu={e => e.preventDefault()}
                              onTouchStart={e => startBubbleGesture(post.id, isOwn, post.content, authorName, e.touches[0].clientX, e.touches[0].clientY)}
                              onTouchMove={e => moveBubbleGesture(post.id, e.touches[0].clientX, e.touches[0].clientY)}
                              onTouchEnd={() => endBubbleGesture(post.id, post.content, authorName)}
                              style={{
                                transform: swipingPost?.postId === post.id ? `translateX(${swipingPost.deltaX}px)` : undefined,
                                transition: swipingPost?.postId === post.id ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                              }}
                            >
                              {/* Double-tap heart animation */}
                              <AnimatePresence>
                                {doubleTapHeart === post.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.4 }}
                                    animate={{ opacity: 1, scale: 1.4 }}
                                    exit={{ opacity: 0, scale: 1.8 }}
                                    transition={{ duration: 0.25 }}
                                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                                  >
                                    <span className="text-5xl drop-shadow-xl">❤️</span>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              {/* Swipe-to-reply indicator */}
                              {swipingPost?.postId === post.id && swipingPost.deltaX > 10 && (
                                <div className="absolute -left-7 top-1/2 -translate-y-1/2"
                                  style={{ opacity: Math.min(swipingPost.deltaX / 50, 1) }}>
                                  <CornerUpLeft size={16} className="text-[#C6684F]" />
                                </div>
                              )}
                              <div className={`rounded-2xl px-4 py-3 shadow-sm transition-colors duration-300 ${
                                highlightPost === post.id ? 'ring-2 ring-[#C6684F] ring-offset-1 bg-[#FDF0EB]!'
                                : isOwn ? 'bg-[#F2E8DF] rounded-br-sm'
                                : post.is_from_marjorie ? 'bg-gradient-to-br from-[#FDF0EB] to-[#FAF6F1] border-2 border-[#C6684F]/30 rounded-bl-sm'
                                : 'bg-white border border-[#DCCFBF] rounded-bl-sm'
                              }`}>
                                {post.reply_to_preview && post.reply_to_id && (
                                  <button
                                    onClick={() => scrollToPost(post.reply_to_id!)}
                                    className="w-full text-left mb-2 border-l-2 border-[#C6684F]/50 pl-2 py-0.5 rounded-r-sm bg-black/5 hover:bg-[#C6684F]/10 active:bg-[#C6684F]/15 transition-colors">
                                    <p className="text-[10px] font-semibold text-[#C6684F]">{post.reply_to_author}</p>
                                    <p className="text-xs text-[#6B6359] line-clamp-1">{post.reply_to_preview}</p>
                                  </button>
                                )}
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
                            </div>
                          )}

                          {/* Reaction count badges */}
                          {Object.values(post.reaction_counts).reduce((a,b)=>a+b,0) > 0 && (
                            <button onClick={() => setOpenReactions(openReactions === post.id ? null : post.id)}
                              className={`flex items-center gap-0.5 mt-0.5 ${isOwn ? 'self-end' : 'self-start'}`}>
                              {REACTIONS.filter(r => post.reaction_counts[r.type] > 0).slice(0,3).map(r => (
                                <span key={r.type} className="text-xs leading-none">{r.emoji}</span>
                              ))}
                              <span className="text-[10px] text-[#6B6359] ml-0.5 font-medium">
                                {Object.values(post.reaction_counts).reduce((a,b)=>a+b,0)}
                              </span>
                            </button>
                          )}
                          {/* Who reacted */}
                          <AnimatePresence>
                            {openReactions === post.id && post.reaction_users.length > 0 && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="flex flex-wrap gap-1.5 mt-1">
                                {REACTIONS.filter(r => post.reaction_counts[r.type] > 0).map(r => {
                                  const names = post.reaction_users.filter(u => u.reaction_type === r.type)
                                    .map(u => u.user_id === myId ? 'Toi' : u.first_name)
                                  if (!names.length) return null
                                  return (
                                    <div key={r.type} className="flex items-center gap-1 bg-white border border-[#DCCFBF] rounded-full px-2 py-0.5 text-[10px] text-[#6B6359]">
                                      <span>{r.emoji}</span><span>{names.join(', ')}</span>
                                    </div>
                                  )
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Desktop hover actions (WhatsApp Web style) */}
                        <div className={`hidden md:flex flex-row items-center gap-0.5 self-center transition-opacity duration-150 ${hoverReactionPost === post.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <div className="relative">
                            <button
                              onClick={() => setHoverReactionPost(prev => prev === post.id ? null : post.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-full text-[#DCCFBF] hover:text-[#6B6359] hover:bg-[#F2E8DF] transition-colors"
                              title="Réagir"
                            >
                              <Smile size={15} />
                            </button>
                            {hoverReactionPost === post.id && (
                              <div className={`absolute bottom-9 z-30 bg-white rounded-2xl shadow-xl border border-[#DCCFBF] px-2 py-2 flex gap-1 ${isOwn ? 'right-0' : 'left-0'}`}>
                                {REACTIONS.map(r => (
                                  <button key={r.type}
                                    onClick={() => { toggleReaction(post.id, r.type); setHoverReactionPost(null) }}
                                    className={`text-xl hover:scale-125 transition-transform p-0.5 rounded ${post.user_reactions.includes(r.type) ? 'ring-2 ring-[#C6684F]/40' : ''}`}
                                    title={r.label}
                                  >
                                    {r.emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setContextMenu({ postId: post.id, isOwn, content: post.content, authorName })}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-[#DCCFBF] hover:text-[#6B6359] hover:bg-[#F2E8DF] transition-colors"
                            title="Plus d'options"
                          >
                            <ChevronDown size={15} />
                          </button>
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
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* ── WhatsApp-style context menu ── */}
      {/* Backdrop to close desktop emoji picker */}
      {hoverReactionPost && (
        <div className="hidden lg:block fixed inset-0 z-20" onClick={() => setHoverReactionPost(null)} />
      )}

      <AnimatePresence>
        {contextMenu && contextPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center px-6"
            onClick={() => setContextMenu(null)}
          >
            {/* Emoji reactions row */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="bg-white rounded-full shadow-2xl px-4 py-2.5 flex gap-3 mb-3 w-full max-w-sm justify-around"
              onClick={e => e.stopPropagation()}
            >
              {REACTIONS.map(({ type, emoji, label }) => (
                <button key={type}
                  onClick={() => { toggleReaction(contextMenu.postId, type); setContextMenu(null) }}
                  title={label}
                  className={`relative text-[26px] transition-transform active:scale-110 ${contextPost.user_reactions.includes(type) ? '-translate-y-1.5 drop-shadow-md' : ''}`}>
                  {emoji}
                  {contextPost.user_reactions.includes(type) && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#C6684F] rounded-full" />
                  )}
                </button>
              ))}
            </motion.div>

            {/* Actions list */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.04 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => { setReplyingTo({ id: contextMenu.postId, content: contextMenu.content, authorName: contextMenu.authorName }); setContextMenu(null) }}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] border-b border-[#F5F0EB] active:bg-[#FAF6F1]">
                <span>Répondre</span>
                <CornerUpLeft size={16} className="text-[#6B6359]" />
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(contextMenu.content).catch(() => {}); setContextMenu(null) }}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] active:bg-[#FAF6F1]">
                <span>Copier</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#6B6359]"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              {contextMenu.isOwn && (
                <button
                  onClick={() => { setEditingPost(contextMenu.postId); setEditPostContent(contextMenu.content); setContextMenu(null) }}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] border-t border-[#F5F0EB] active:bg-[#FAF6F1]">
                  <span>Modifier</span>
                  <Pencil size={15} className="text-[#6B6359]" />
                </button>
              )}
              {(contextMenu.isOwn || isAdmin) && (
                <button
                  onClick={() => { setDeletingPost(contextMenu.postId); setContextMenu(null) }}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-red-500 border-t border-[#F5F0EB] active:bg-red-50">
                  <span>Supprimer</span>
                  <Trash2 size={15} className="text-red-400" />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { togglePin(contextMenu.postId, contextPost.is_pinned); setContextMenu(null) }}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] border-t border-[#F5F0EB] active:bg-[#FAF6F1]">
                  <span>{contextPost.is_pinned ? 'Désépingler' : 'Épingler'}</span>
                  {contextPost.is_pinned ? <PinOff size={15} className="text-[#6B6359]" /> : <Pin size={15} className="text-[#6B6359]" />}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fixed compose bar (all screens) ── */}
      {profile && (
        <div className={`fixed right-0 z-[45] bg-[#FAF6F1]/97 backdrop-blur-md border-t border-[#DCCFBF] safe-bottom ${isEmbedded ? 'bottom-0 left-0' : 'bottom-16 lg:bottom-0 left-0 lg:left-60'}`}>
          <div className="max-w-5xl mx-auto px-3 lg:px-8 pt-2 pb-3">
            {replyingTo && (
              <div className="flex items-start gap-2 border-l-2 border-[#C6684F] pl-2 py-1 mb-1.5 bg-[#C6684F]/5 rounded-r-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[#C6684F]">↩ {replyingTo.authorName}</p>
                  <p className="text-xs text-[#6B6359] line-clamp-1">{replyingTo.content}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-[#DCCFBF] hover:text-[#C6684F] flex-shrink-0 mt-0.5">
                  <X size={12} />
                </button>
              </div>
            )}
            {isAdmin && (showImageInput || showLinkInput) && (
              <div className="mb-1.5 space-y-1.5">
                {showImageInput && (
                  <div className="flex items-center gap-2">
                    <ImageIcon size={12} className="text-[#6B6359] flex-shrink-0" />
                    <input type="url" placeholder="URL de l'image..." value={postImageUrl} onChange={e => setPostImageUrl(e.target.value)}
                      className="flex-1 text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-white" />
                    <button onClick={() => { setShowImageInput(false); setPostImageUrl('') }} className="text-[#DCCFBF]"><X size={12} /></button>
                  </div>
                )}
                {showLinkInput && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <LinkIcon size={12} className="text-[#6B6359] flex-shrink-0" />
                      <input type="url" placeholder="URL du lien..." value={postLinkUrl} onChange={e => setPostLinkUrl(e.target.value)}
                        className="flex-1 text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-white" />
                      <button onClick={() => { setShowLinkInput(false); setPostLinkUrl(''); setPostLinkLabel('') }} className="text-[#DCCFBF]"><X size={12} /></button>
                    </div>
                    {postLinkUrl && (
                      <input type="text" placeholder="Texte du bouton..." value={postLinkLabel} onChange={e => setPostLinkLabel(e.target.value)}
                        className="w-full text-xs border border-[#DCCFBF] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C6684F] bg-white" />
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <Avatar src={profile.avatar_url} fallback={profile.first_name} size="sm" />
              <div className="flex-1 flex items-end gap-1 bg-white border border-[#DCCFBF] rounded-2xl px-3 py-2 focus-within:border-[#C6684F] transition-colors">
                {isAdmin && (
                  <div className="flex gap-0.5 self-end mb-0.5 mr-1">
                    <button onClick={() => setShowImageInput(v => !v)}
                      className={`p-1 rounded transition-colors ${showImageInput ? 'text-[#C6684F]' : 'text-[#DCCFBF] hover:text-[#C6684F]/60'}`}>
                      <ImageIcon size={14} />
                    </button>
                    <button onClick={() => setShowLinkInput(v => !v)}
                      className={`p-1 rounded transition-colors ${showLinkInput ? 'text-[#C6684F]' : 'text-[#DCCFBF] hover:text-[#C6684F]/60'}`}>
                      <LinkIcon size={14} />
                    </button>
                  </div>
                )}
                <textarea
                  placeholder={isAdmin ? 'Écris un message...' : 'Partage ton expérience...'}
                  value={newPost} onChange={e => setNewPost(e.target.value)} rows={1}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handlePost())}
                  className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none leading-5 max-h-28 overflow-y-auto"
                />
              </div>
              <button onClick={handlePost} disabled={isPosting || !newPost.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-[#C6684F] flex items-center justify-center text-white disabled:opacity-40 transition-opacity">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
