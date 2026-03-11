'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Clock, Heart, Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, BadgePill, Chip } from '@/components/ui'
import type { Article, ArticleCategory } from '@/types/database'

const categoryLabels: Record<ArticleCategory, { label: string; emoji: string }> = {
  pratique: { label: 'Pratique', emoji: '🧘‍♀️' },
  nutrition: { label: 'Nutrition', emoji: '🥗' },
  bien_etre: { label: 'Bien-être', emoji: '🌿' },
  recuperation: { label: 'Récupération', emoji: '💆‍♀️' },
}

export default function ConseilsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | 'all'>('all')
  const supabase = createClient()

  useEffect(() => {
    async function loadArticles() {
      let query = supabase
        .from('articles')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (activeCategory !== 'all') {
        query = query.eq('category', activeCategory)
      }

      const { data } = await query
      if (data) setArticles(data as Article[])
    }
    loadArticles()
  }, [supabase, activeCategory])

  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">
          Conseils & Bien-être
        </h1>
        <p className="text-text-secondary mt-1">
          Prends soin de toi au quotidien
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-6 scrollbar-hide">
        <Chip
          label="Tous"
          selected={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        />
        {(Object.entries(categoryLabels) as [ArticleCategory, { label: string; emoji: string }][]).map(
          ([value, { label, emoji }]) => (
            <Chip
              key={value}
              label={label}
              icon={<span>{emoji}</span>}
              selected={activeCategory === value}
              onClick={() => setActiveCategory(value)}
            />
          )
        )}
      </div>

      {/* Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {articles.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto text-text-muted mb-3" />
            <p className="text-text-secondary">
              De nouveaux articles arrivent bientôt...
            </p>
          </div>
        ) : (
          articles.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card hover>
                {article.thumbnail_url && (
                  <div className="relative h-40 -mx-5 -mt-5 mb-4 rounded-t-[var(--radius-lg)] overflow-hidden">
                    <img
                      src={article.thumbnail_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BadgePill variant="accent">
                        {categoryLabels[article.category]?.emoji}{' '}
                        {categoryLabels[article.category]?.label}
                      </BadgePill>
                      {article.reading_time_minutes && (
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Clock size={12} />
                          {article.reading_time_minutes} min
                        </span>
                      )}
                    </div>
                    <h3 className="font-[family-name:var(--font-heading)] text-lg text-text leading-snug">
                      {article.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Bookmark size={18} />
                  </button>
                </div>

                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {article.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded-[var(--radius-full)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {article.marjorie_note && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    <p className="text-xs text-text-secondary italic">
                      <span className="font-semibold text-primary not-italic">
                        Le mot de Marjorie :{' '}
                      </span>
                      {article.marjorie_note}
                    </p>
                  </div>
                )}
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
