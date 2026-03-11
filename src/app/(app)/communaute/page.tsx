'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, HandMetal, Dumbbell, Star, MessageCircle, Send, Pin, X } from 'lucide-react'
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

type PostWithMeta = CommunityPost & {
  reaction_counts: Record<ReactionType, number>
  user_reactions: ReactionType[]
  comment_count: number
  comments?: { id: string; content: string; created_at: string; profiles?: { first_name: string; avatar_url: string | null } }[]
}

const DEMO_POSTS: PostWithMeta[] = [
  {
    id: 'demo-1',
    user_id: 'demo',
    content: 'Première séance du matin faite ! Je me sens tellement bien après. Merci Marjorie pour cette énergie 🌿',
    image_url: null,
    is_pinned: false,
    is_from_marjorie: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    profiles: { first_name: 'Sophie', avatar_url: null },
    reaction_counts: { coeur: 5, applaudissement: 3, muscle: 2, etoile: 0 },
    user_reactions: [],
    comment_count: 2,
  },
  {
    id: 'demo-2',
    user_id: 'marjorie',
    content: 'Bonjour à toutes ! Un rappel bienveillant : même 15 minutes de pratique comptent. Votre corps vous dit merci 💛',
    image_url: null,
    is_pinned: true,
    is_from_marjorie: true,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    profiles: { first_name: 'Marjorie', avatar_url: null },
    reaction_counts: { coeur: 12, applaudissement: 8, muscle: 4, etoile: 6 },
    user_reactions: [],
    comment_count: 4,
  },
]

export default function CommunautePage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([])
  const [newPost, setNewPost] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)
  const { profile } = useAuthStore()
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  async function loadPosts() {
    if (!isSupabaseConfigured()) {
      setPosts(DEMO_POSTS)
      return
    }

    const { data: postsData } = await supabase
      .from('community_posts')
      .select('*, profiles(first_name, avatar_url)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)

    if (!postsData) return

    // Load reaction counts and user reactions for each post
    const postIds = postsData.map(p => p.id)

    const { data: reactions } = await supabase
      .from('post_reactions')
      .select('post_id, reaction_type, user_id')
      .in('post_id', postIds)

    const { data: comments } = await supabase
      .from('post_comments')
      .select('post_id, id')
      .in('post_id', postIds)

    const enriched: PostWithMeta[] = postsData.map(post => {
      const postReactions = reactions?.filter(r => r.post_id === post.id) ?? []
      const reaction_counts: Record<ReactionType, number> = { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 }
      postReactions.forEach(r => { reaction_counts[r.reaction_type as ReactionType]++ })
      const user_reactions = postReactions
        .filter(r => r.user_id === profile?.id)
        .map(r => r.reaction_type as ReactionType)
      const comment_count = comments?.filter(c => c.post_id === post.id).length ?? 0

      return { ...post, reaction_counts, user_reactions, comment_count }
    })

    setPosts(enriched)
  }

  useEffect(() => {
    loadPosts()

    if (!isSupabaseConfigured()) return

    // Realtime subscription for new posts
    channelRef.current = supabase
      .channel('community')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, async (payload) => {
        // Fetch the full post with profile
        const { data } = await supabase
          .from('community_posts')
          .select('*, profiles(first_name, avatar_url)')
          .eq('id', payload.new.id)
          .single()

        if (data) {
          const newPost: PostWithMeta = {
            ...data,
            reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 },
            user_reactions: [],
            comment_count: 0,
          }
          setPosts(prev => {
            // Don't add if we already have it (optimistic update)
            if (prev.find(p => p.id === newPost.id)) return prev
            return [newPost, ...prev]
          })
        }
      })
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [profile?.id])

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
      .from('community_posts')
      .insert({ user_id: profile.id, content: newPost.trim() })
      .select('*, profiles(first_name, avatar_url)')
      .single()

    if (!error && data) {
      const newPostData: PostWithMeta = {
        ...data,
        reaction_counts: { coeur: 0, applaudissement: 0, muscle: 0, etoile: 0 },
        user_reactions: [], comment_count: 0,
      }
      setPosts(prev => [newPostData, ...prev])
      setNewPost('')
    }
    setIsPosting(false)
  }

  async function toggleReaction(postId: string, type: ReactionType) {
    if (!profile || !isSupabaseConfigured()) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const hasReacted = post.user_reactions.includes(type)

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const newCounts = { ...p.reaction_counts }
      const newUserReactions = hasReacted
        ? p.user_reactions.filter(r => r !== type)
        : [...p.user_reactions, type]
      newCounts[type] = hasReacted ? Math.max(0, newCounts[type] - 1) : newCounts[type] + 1
      return { ...p, reaction_counts: newCounts, user_reactions: newUserReactions }
    }))

    if (hasReacted) {
      await supabase.from('post_reactions')
        .delete()
        .eq('user_id', profile.id)
        .eq('post_id', postId)
        .eq('reaction_type', type)
    } else {
      await supabase.from('post_reactions')
        .insert({ user_id: profile.id, post_id: postId, reaction_type: type })
    }
  }

  async function loadComments(postId: string) {
    if (openComments === postId) { setOpenComments(null); return }
    setOpenComments(postId)

    if (!isSupabaseConfigured()) return

    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(first_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (data) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: data } : p))
    }
  }

  async function submitComment(postId: string) {
    if (!newComment.trim() || !profile || !isSupabaseConfigured()) return
    setIsCommenting(true)

    const { data } = await supabase
      .from('post_comments')
      .insert({ user_id: profile.id, post_id: postId, content: newComment.trim() })
      .select('*, profiles(first_name, avatar_url)')
      .single()

    if (data) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p
        return {
          ...p,
          comment_count: p.comment_count + 1,
          comments: [...(p.comments ?? []), data],
        }
      }))
      setNewComment('')
    }
    setIsCommenting(false)
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Communauté</h1>
        <p className="text-text-secondary mt-1">Partage, inspire et célèbre ensemble</p>
      </div>

      {/* New post */}
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
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i < 5 ? i * 0.04 : 0 }}
              >
                <Card className={post.is_from_marjorie ? 'border-primary/30 bg-primary/5' : ''}>
                  {/* Header */}
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
                  </div>

                  <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{post.content}</p>

                  {post.image_url && (
                    <div className="mt-3 rounded-[var(--radius-md)] overflow-hidden">
                      <img src={post.image_url} alt="" className="w-full object-cover max-h-64" />
                    </div>
                  )}

                  {/* Reactions */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-light flex-wrap">
                    {REACTIONS.map(({ type, icon }) => {
                      const count = post.reaction_counts[type]
                      const active = post.user_reactions.includes(type)
                      return (
                        <button
                          key={type}
                          onClick={() => toggleReaction(post.id, type)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                            active ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:bg-bg-elevated'
                          }`}
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

                  {/* Comments section */}
                  <AnimatePresence>
                    {openComments === post.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-border-light space-y-3"
                      >
                        {(post.comments ?? []).map(comment => (
                          <div key={comment.id} className="flex gap-2">
                            <Avatar src={comment.profiles?.avatar_url} fallback={comment.profiles?.first_name} size="sm" />
                            <div className="flex-1 bg-bg-elevated rounded-xl px-3 py-2">
                              <span className="text-xs font-medium text-text">{comment.profiles?.first_name} </span>
                              <span className="text-xs text-text">{comment.content}</span>
                            </div>
                          </div>
                        ))}
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
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
