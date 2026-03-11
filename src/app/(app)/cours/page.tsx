'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Clock, Star, Filter, Play, Monitor, Video, ExternalLink } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card, BadgePill, Chip, Button } from '@/components/ui'
import { LEVEL_LABELS, FOCUS_LABELS } from '@/lib/utils'
import type { Course, CourseFocus, LiveSession } from '@/types/database'

const focusFilters: { value: CourseFocus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'posture', label: 'Posture' },
  { value: 'renforcement', label: 'Renforcement' },
  { value: 'souplesse', label: 'Souplesse' },
  { value: 'relaxation', label: 'Relaxation' },
  { value: 'cardio', label: 'Cardio' },
]

const durationFilters = [
  { value: 0, label: 'Toutes' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
]

const DEMO_LIVE_SESSION: LiveSession = {
  id: 'demo-live',
  title: 'Pilates Flow Spécial Dos',
  description: 'Session live avec Marjorie — libération du dos et renforcement profond',
  scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  duration_minutes: 45,
  meeting_url: null,
  replay_url: null,
  max_participants: 20,
  is_cancelled: false,
  registered_count: 12,
  created_at: new Date().toISOString(),
}

const DEMO_COURSES: Course[] = [
  {
    id: 'demo-1',
    title: 'Pilates Fondamentaux — Posture & Alignement',
    description: 'Retrouve les bases essentielles pour une posture alignée au quotidien',
    uscreen_url: 'https://mjpilates.uscreen.io',
    thumbnail_url: null,
    duration_minutes: 30,
    level: 'debutante',
    focus: ['posture', 'renforcement'],
    equipment: ['tapis'],
    marjorie_notes: null,
    benefits: ['Meilleure posture', 'Renforcement profond'],
    is_published: true,
    views_count: 234,
    avg_rating: 4.8,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    title: 'Flow Souplesse — Libère tes tensions',
    description: 'Un flow doux et profond pour relâcher les tensions accumulées',
    uscreen_url: 'https://mjpilates.uscreen.io',
    thumbnail_url: null,
    duration_minutes: 45,
    level: 'tous_niveaux',
    focus: ['souplesse', 'relaxation'],
    equipment: ['tapis', 'foam_roller'],
    marjorie_notes: null,
    benefits: ['Souplesse', 'Détente musculaire'],
    is_published: true,
    views_count: 189,
    avg_rating: 4.9,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    title: 'Cardio Pilates — Énergie & Tonicité',
    description: 'Un cours dynamique qui combine Pilates et travail cardiovasculaire',
    uscreen_url: 'https://mjpilates.uscreen.io',
    thumbnail_url: null,
    duration_minutes: 40,
    level: 'intermediaire',
    focus: ['cardio', 'renforcement'],
    equipment: ['tapis', 'elastique'],
    marjorie_notes: null,
    benefits: ['Tonicité', 'Endurance'],
    is_published: true,
    views_count: 156,
    avg_rating: 4.7,
    created_at: new Date().toISOString(),
  },
]

function formatLiveDate(dateStr: string) {
  const date = new Date(dateStr)
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} à ${date.getHours()}h${date.getMinutes().toString().padStart(2, '0')}`
}

export default function CoursPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [nextLive, setNextLive] = useState<LiveSession | null>(null)
  const [search, setSearch] = useState('')
  const [focusFilter, setFocusFilter] = useState<CourseFocus | 'all'>('all')
  const [durationFilter, setDurationFilter] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [linkCopied, setLinkCopied] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      if (!isSupabaseConfigured()) {
        setCourses(DEMO_COURSES)
        setNextLive(DEMO_LIVE_SESSION)
        return
      }

      // Load courses
      let query = supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (durationFilter > 0) {
        query = query.eq('duration_minutes', durationFilter)
      }

      const { data } = await query
      if (data) setCourses(data as Course[])

      // Load next live session
      const { data: liveData } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('is_cancelled', false)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single()

      if (liveData) setNextLive(liveData as LiveSession)
    }
    loadData()
  }, [supabase, durationFilter])

  const filteredCourses = courses.filter((course) => {
    if (search) {
      const searchLower = search.toLowerCase()
      if (
        !course.title.toLowerCase().includes(searchLower) &&
        !course.description?.toLowerCase().includes(searchLower)
      ) {
        return false
      }
    }
    if (focusFilter !== 'all' && !course.focus.includes(focusFilter)) {
      return false
    }
    return true
  })

  function handleOpenOnDesktop(url: string, courseId: string) {
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(courseId)
      setTimeout(() => setLinkCopied(null), 2000)
    })
  }

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">
          Tes cours
        </h1>
        <p className="text-text-secondary mt-1">
          Cours VOD disponibles à tout moment sur Uscreen
        </p>
      </div>

      {/* Next Live Session */}
      {nextLive && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-2 mb-2">
              <Video size={16} className="text-primary" />
              <BadgePill variant="accent">Prochain Live</BadgePill>
            </div>
            <h3 className="font-[family-name:var(--font-heading)] text-lg text-text leading-snug">
              {nextLive.title}
            </h3>
            {nextLive.description && (
              <p className="text-sm text-text-secondary mt-1">{nextLive.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatLiveDate(nextLive.scheduled_at)}
              </span>
              <span>{nextLive.duration_minutes} min</span>
              {nextLive.max_participants && (
                <span>{nextLive.registered_count}/{nextLive.max_participants} places</span>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              {nextLive.meeting_url ? (
                <a
                  href={nextLive.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button size="sm" fullWidth>
                    <Video size={14} />
                    Rejoindre le live
                  </Button>
                </a>
              ) : (
                <Button size="sm" variant="outline" disabled className="flex-1">
                  Lien disponible bientôt
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const url = nextLive.meeting_url || `${window.location.origin}/cours`
                  handleOpenOnDesktop(url, nextLive.id)
                }}
              >
                <Monitor size={14} />
                {linkCopied === nextLive.id ? 'Copié !' : 'Ordi'}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* VOD Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Play size={16} className="text-primary" />
        <h2 className="font-[family-name:var(--font-heading)] text-xl text-text">
          Cours VOD
        </h2>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="Rechercher un cours..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-12 py-3 bg-bg-card border border-border rounded-[var(--radius-lg)] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
            showFilters ? 'bg-primary/10 text-primary' : 'text-text-muted'
          }`}
        >
          <Filter size={18} />
        </button>
      </div>

      {/* Focus filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-4 scrollbar-hide">
        {focusFilters.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={focusFilter === f.value}
            onClick={() => setFocusFilter(f.value)}
          />
        ))}
      </div>

      {/* Duration filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4"
        >
          <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">
            Durée
          </p>
          <div className="flex gap-2">
            {durationFilters.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={durationFilter === d.value}
                onClick={() => setDurationFilter(d.value)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Course grid */}
      <div className="space-y-3">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-secondary">
              {courses.length === 0
                ? 'Les cours arrivent bientôt...'
                : 'Aucun cours ne correspond à ta recherche'}
            </p>
          </div>
        ) : (
          filteredCourses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card hover className="flex gap-4">
                {/* Thumbnail */}
                <div className="relative w-24 h-24 flex-shrink-0 rounded-[var(--radius-md)] bg-bg-elevated overflow-hidden">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play size={24} className="text-text-muted" />
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 bg-text/70 text-white text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                    {course.duration_minutes} min
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-text text-sm leading-tight line-clamp-2">
                    {course.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <BadgePill size="sm">
                      {LEVEL_LABELS[course.level] || course.level}
                    </BadgePill>
                    {course.focus[0] && (
                      <BadgePill size="sm" variant="accent">
                        {FOCUS_LABELS[course.focus[0]] || course.focus[0]}
                      </BadgePill>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Star size={12} className="fill-alert text-alert" />
                      {course.avg_rating > 0
                        ? course.avg_rating.toFixed(1)
                        : '—'}
                    </span>
                    <span>{course.views_count} vues</span>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={course.uscreen_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-accent transition-colors"
                    >
                      <ExternalLink size={12} />
                      Regarder
                    </a>
                    <button
                      type="button"
                      onClick={() => handleOpenOnDesktop(course.uscreen_url, course.id)}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors cursor-pointer"
                    >
                      <Monitor size={12} />
                      {linkCopied === course.id ? 'Lien copié !' : 'Ouvrir sur ordi'}
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
