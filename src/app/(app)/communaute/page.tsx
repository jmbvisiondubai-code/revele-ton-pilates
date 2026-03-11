'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Heart,
  HandMetal,
  Dumbbell,
  Star,
  MessageCircle,
  ImagePlus,
  Send,
  Pin,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, Avatar, Button } from '@/components/ui'
import { formatRelativeDate } from '@/lib/utils'
import type { CommunityPost, ReactionType } from '@/types/database'

const reactionIcons: Record<ReactionType, { icon: React.ReactNode; label: string }> = {
  coeur: { icon: <Heart size={16} />, label: 'Coeur' },
  applaudissement: { icon: <HandMetal size={16} />, label: 'Bravo' },
  muscle: { icon: <Dumbbell size={16} />, label: 'Force' },
  etoile: { icon: <Star size={16} />, label: 'Étoile' },
}

export default function CommunautePage() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [newPost, setNewPost] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const { profile } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    async function loadPosts() {
      const { data } = await supabase
        .from('community_posts')
        .select('*, profiles(first_name, avatar_url)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) setPosts(data as CommunityPost[])
    }
    loadPosts()
  }, [supabase])

  async function handlePost() {
    if (!newPost.trim() || !profile) return
    setIsPosting(true)

    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: profile.id,
        content: newPost.trim(),
      })
      .select('*, profiles(first_name, avatar_url)')
      .single()

    if (!error && data) {
      setPosts([data as CommunityPost, ...posts])
      setNewPost('')
    }
    setIsPosting(false)
  }

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">
          Communauté
        </h1>
        <p className="text-text-secondary mt-1">
          Partage, inspire et célèbre ensemble
        </p>
      </div>

      {/* New post */}
      <Card className="mb-6">
        <div className="flex gap-3">
          <Avatar
            src={profile?.avatar_url}
            fallback={profile?.first_name}
            size="md"
          />
          <div className="flex-1">
            <textarea
              placeholder="Partage ton expérience, une victoire, un ressenti..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
            />
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
              <button
                type="button"
                className="p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer"
              >
                <ImagePlus size={18} />
              </button>
              <Button
                size="sm"
                onClick={handlePost}
                isLoading={isPosting}
                disabled={!newPost.trim()}
              >
                <Send size={14} />
                Publier
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-secondary">
              Sois la première à partager quelque chose !
            </p>
          </div>
        ) : (
          posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                {/* Post header */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    src={post.profiles?.avatar_url}
                    fallback={post.profiles?.first_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-text">
                        {post.profiles?.first_name || 'Membre'}
                      </span>
                      {post.is_from_marjorie && (
                        <span className="text-[10px] font-semibold bg-primary text-white px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                          MARJORIE
                        </span>
                      )}
                      {post.is_pinned && (
                        <Pin size={12} className="text-alert" />
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {formatRelativeDate(post.created_at)}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>

                {post.image_url && (
                  <div className="mt-3 rounded-[var(--radius-md)] overflow-hidden">
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full object-cover max-h-64"
                    />
                  </div>
                )}

                {/* Reactions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-light">
                  {(Object.entries(reactionIcons) as [ReactionType, { icon: React.ReactNode; label: string }][]).map(
                    ([type, { icon, label }]) => (
                      <button
                        key={type}
                        type="button"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-full)] text-text-muted hover:bg-bg-elevated hover:text-primary transition-all text-xs cursor-pointer"
                        title={label}
                      >
                        {icon}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-full)] text-text-muted hover:bg-bg-elevated hover:text-primary transition-all text-xs cursor-pointer"
                  >
                    <MessageCircle size={14} />
                    Commenter
                  </button>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
