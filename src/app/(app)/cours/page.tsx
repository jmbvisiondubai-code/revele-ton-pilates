'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Clock, Star, Filter, Play, Monitor, Video, ExternalLink, Radio, Film } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card, BadgePill, Chip, Button } from '@/components/ui'
import { LEVEL_LABELS, FOCUS_LABELS } from '@/lib/utils'
import type { Course, CourseFocus, LiveSession } from '@/types/database'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type Tab = 'lives' | 'vod' | 'replays'

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

const DEMO_LIVE: LiveSession = {
  id: 'demo-live',
  title: 'Pilates Flow — Spécial dos',
  description: 'Session collective hebdomadaire avec Marjorie',
  scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  duration_minutes: 45,
  meeting_url: null,
  replay_url: null,
  max_participants: 20,
  is_cancelled: false,
  is_collective: true,
  equipment: 'Tapis, foam roller',
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

export default function CoursPage() {
  const [tab, setTab] = useState<Tab>('lives')
  const [courses, setCourses] = useState<Course[]>([])
  const [nextLive, setNextLive] = useState<LiveSession | null>(null)
  const [vimeoUrl, setVimeoUrl] = useState<string | null>(null)
  const [vimeoCode, setVimeoCode] = useState<string | null>(null)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
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
        setNextLive(DEMO_LIVE)
        setVimeoUrl('https://vimeo.com/showcase/mjpilates')
        setVimeoCode('pilates2025')
        setZoomUrl('https://zoom.us/j/mjpilates')
        return
      }

      // Load next collective live session
      const { data: liveData } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('is_cancelled', false)
        .eq('is_collective', true)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single()
      if (liveData) setNextLive(liveData as LiveSession)

      // Load app settings (Vimeo + Zoom URLs)
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['vimeo_replay_url', 'vimeo_replay_code', 'collective_zoom_url'])
      if (settings) {
        const vimeo = settings.find((s: { key: string; value: string | null }) => s.key === 'vimeo_replay_url')
        const code = settings.find((s: { key: string; value: string | null }) => s.key === 'vimeo_replay_code')
        const zoom = settings.find((s: { key: string; value: string | null }) => s.key === 'collective_zoom_url')
        if (vimeo?.value) setVimeoUrl(vimeo.value)
        if (code?.value) setVimeoCode(code.value)
        if (zoom?.value) setZoomUrl(zoom.value)
      }

      // Load courses (for VOD tab)
      let query = supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
      if (durationFilter > 0) query = query.eq('duration_minutes', durationFilter)
      const { data } = await query
      if (data) setCourses(data as Course[])
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationFilter])

  const filteredCourses = courses.filter((course) => {
    if (search) {
      const q = search.toLowerCase()
      if (!course.title.toLowerCase().includes(q) && !course.description?.toLowerCase().includes(q)) return false
    }
    if (focusFilter !== 'all' && !course.focus.includes(focusFilter)) return false
    return true
  })

  function copyLink(url: string, key: string) {
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(key)
      setTimeout(() => setLinkCopied(null), 2000)
    })
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'lives', label: 'En direct', icon: <Radio size={14} /> },
    { key: 'replays', label: 'Replays', icon: <Film size={14} /> },
    { key: 'vod', label: 'VOD', icon: <Play size={14} /> },
  ]

  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Tes cours</h1>
        <p className="text-text-secondary mt-1 text-sm">Lives collectifs, VOD Uscreen & replays</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-[#C6684F] shadow-sm'
                : 'text-[#6B6359] hover:text-[#2C2C2C]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LIVES TAB ── */}
      {tab === 'lives' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {nextLive ? (
            <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-2 mb-3">
                <Radio size={15} className="text-[#C6684F]" />
                <BadgePill variant="accent">Prochain cours collectif</BadgePill>
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-xl text-text leading-snug">
                {nextLive.title}
              </h3>
              {nextLive.description && (
                <p className="text-sm text-text-secondary mt-1">{nextLive.description}</p>
              )}
              <div className="mt-3 space-y-1.5 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-[#C6684F] flex-shrink-0" />
                  <span className="capitalize">
                    {format(new Date(nextLive.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">⏱</span>
                  <span>{nextLive.duration_minutes} min</span>
                </div>
                {nextLive.equipment && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">🧘</span>
                    <span>Matériel : {nextLive.equipment}</span>
                  </div>
                )}
                {nextLive.max_participants && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">👥</span>
                    <span>{nextLive.registered_count}/{nextLive.max_participants} places</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {zoomUrl ? (
                  <a href={zoomUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="sm" fullWidth>
                      <Video size={14} />
                      Rejoindre sur Zoom
                    </Button>
                  </a>
                ) : (
                  <Button size="sm" variant="outline" disabled className="flex-1">
                    Lien disponible bientôt
                  </Button>
                )}
                {zoomUrl && (
                  <Button size="sm" variant="ghost" onClick={() => copyLink(zoomUrl, 'zoom')}>
                    <Monitor size={14} />
                    {linkCopied === 'zoom' ? 'Copié !' : 'Ordi'}
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="text-center py-16 text-text-secondary">
              <Radio size={32} className="mx-auto mb-3 text-[#DCCFBF]" />
              <p className="font-medium">Aucun live collectif prévu</p>
              <p className="text-sm text-text-muted mt-1">Le prochain cours apparaîtra ici dès qu'il sera programmé.</p>
            </div>
          )}

          <div className="rounded-xl bg-[#F2E8DF] p-4 text-sm text-[#6B6359]">
            <p className="font-medium text-[#2C2C2C] mb-1">Cours privés en visio</p>
            <p>Les liens de tes cours individuels te sont envoyés séparément par Marjorie.</p>
          </div>
        </motion.div>
      )}

      {/* ── VOD TAB ── */}
      {tab === 'vod' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-text-secondary">Accès à tous les cours sur Uscreen</p>
            <a
              href="https://mjpilates.uscreen.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-[#C6684F]"
            >
              Voir tout <ExternalLink size={11} />
            </a>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Rechercher un cours..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-bg-card border border-border rounded-[var(--radius-lg)] text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors cursor-pointer ${
                showFilters ? 'text-[#C6684F]' : 'text-text-muted'
              }`}
            >
              <Filter size={16} />
            </button>
          </div>

          {/* Focus chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-3 scrollbar-hide">
            {focusFilters.map((f) => (
              <Chip key={f.value} label={f.label} selected={focusFilter === f.value} onClick={() => setFocusFilter(f.value)} />
            ))}
          </div>

          {/* Duration filters */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-3">
              <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">Durée</p>
              <div className="flex gap-2 flex-wrap">
                {durationFilters.map((d) => (
                  <Chip key={d.value} label={d.label} selected={durationFilter === d.value} onClick={() => setDurationFilter(d.value)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Course list */}
          <div className="space-y-3">
            {filteredCourses.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                {courses.length === 0 ? 'Les cours arrivent bientôt...' : 'Aucun cours ne correspond à ta recherche'}
              </div>
            ) : (
              filteredCourses.map((course, i) => (
                <motion.div key={course.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card hover className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-[var(--radius-md)] bg-[#F2E8DF] overflow-hidden">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play size={20} className="text-[#C6684F]" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {course.duration_minutes} min
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text text-sm leading-tight line-clamp-2">{course.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <BadgePill size="sm">{LEVEL_LABELS[course.level] || course.level}</BadgePill>
                        {course.focus[0] && (
                          <BadgePill size="sm" variant="accent">{FOCUS_LABELS[course.focus[0]] || course.focus[0]}</BadgePill>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Star size={11} className="fill-alert text-alert" />
                          {course.avg_rating > 0 ? course.avg_rating.toFixed(1) : '—'}
                        </span>
                        <span>{course.views_count} vues</span>
                      </div>
                      <div className="flex gap-3 mt-2">
                        <a
                          href={course.uscreen_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-[#C6684F] hover:text-[#A8543D] transition-colors"
                        >
                          <ExternalLink size={11} />
                          Regarder sur Uscreen
                        </a>
                        <button
                          type="button"
                          onClick={() => copyLink(course.uscreen_url, course.id)}
                          className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
                        >
                          <Monitor size={11} />
                          {linkCopied === course.id ? 'Copié !' : 'Ordi'}
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* ── REPLAYS TAB ── */}
      {tab === 'replays' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="text-center py-8">
            <div className="w-16 h-16 bg-[#F2E8DF] rounded-full flex items-center justify-center mx-auto mb-4">
              <Film size={28} className="text-[#C6684F]" />
            </div>
            <h3 className="font-[family-name:var(--font-heading)] text-xl text-text mb-2">
              Replays des lives
            </h3>
            <p className="text-sm text-text-secondary mb-4 max-w-xs mx-auto">
              Retrouve tous les enregistrements de tes sessions live sur Vimeo, disponibles après chaque cours.
            </p>

            {/* Code d'accès Vimeo */}
            {vimeoCode && (
              <div className="mb-6 w-full max-w-xs mx-auto">
                <p className="text-xs text-[#6B6359] mb-2">Code d'accès Vimeo</p>
                <div className="flex items-center gap-2 bg-[#F2E8DF] rounded-xl px-4 py-3">
                  <span className="flex-1 font-mono font-semibold text-[#2C2C2C] tracking-widest text-lg">{vimeoCode}</span>
                  <button
                    type="button"
                    onClick={() => copyLink(vimeoCode, 'vimeo-code')}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#C6684F] hover:text-[#A8543D] transition-colors cursor-pointer"
                  >
                    <Monitor size={13} />
                    {linkCopied === 'vimeo-code' ? 'Copié ✓' : 'Copier'}
                  </button>
                </div>
              </div>
            )}

            {vimeoUrl ? (
              <div className="flex flex-col gap-3 items-center">
                <a href={vimeoUrl} target="_blank" rel="noopener noreferrer" className="w-full max-w-xs">
                  <Button fullWidth>
                    <Film size={15} />
                    Accéder aux replays
                  </Button>
                </a>
                <button
                  type="button"
                  onClick={() => copyLink(vimeoUrl, 'vimeo')}
                  className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors cursor-pointer"
                >
                  <Monitor size={14} />
                  {linkCopied === 'vimeo' ? 'Lien copié !' : 'Copier le lien pour ordi'}
                </button>
              </div>
            ) : (
              <Button variant="outline" disabled>
                Replays bientôt disponibles
              </Button>
            )}
          </Card>

          <div className="rounded-xl bg-[#F2E8DF] p-4 text-sm text-[#6B6359]">
            <p className="font-medium text-[#2C2C2C] mb-1">Accès depuis un ordinateur</p>
            <p>Pour une meilleure expérience vidéo, tu peux copier le lien et l'ouvrir sur ton ordinateur.</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
