'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Star, Play, Monitor, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Button, BadgePill } from '@/components/ui'
import { LEVEL_LABELS, FOCUS_LABELS } from '@/lib/utils'
import type { Course } from '@/types/database'

const DEMO_COURSE: Course = {
  id: 'demo-1',
  title: 'Pilates Fondamentaux — Posture & Alignement',
  description: 'Retrouve les bases essentielles pour une posture alignée au quotidien. Ce cours t\'accompagne dans la découverte des principes fondamentaux du Pilates : respiration, centrage, alignement et contrôle.',
  uscreen_url: 'https://mjpilates.uscreen.io',
  thumbnail_url: null,
  duration_minutes: 30,
  level: 'debutante',
  focus: ['full_body', 'programme'],
  equipment: ['tapis'],
  marjorie_notes: 'Prends le temps de sentir chaque mouvement. La qualité prime sur la quantité.',
  benefits: ['Meilleure posture', 'Renforcement profond', 'Conscience corporelle'],
  is_published: true,
  views_count: 234,
  avg_rating: 4.8,
  created_at: new Date().toISOString(),
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setCourse(DEMO_COURSE)
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        setCourse(data as Course)

        // Check if already completed
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: completion } = await supabase
            .from('course_completions')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', id)
            .limit(1)
            .single()
          if (completion) setAlreadyDone(true)
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function markCompleted() {
    if (!isSupabaseConfigured() || !course) {
      setCompleted(true)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Insert completion
    await supabase.from('course_completions').insert({
      user_id: user.id,
      course_id: course.id,
      duration_watched_minutes: course.duration_minutes,
    })

    // Update profile stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_sessions, total_practice_minutes, current_streak, longest_streak')
      .eq('id', user.id)
      .single()

    if (profile) {
      const today = new Date().toDateString()
      const newStreak = profile.current_streak + 1
      await supabase.from('profiles').update({
        total_sessions: profile.total_sessions + 1,
        total_practice_minutes: profile.total_practice_minutes + course.duration_minutes,
        current_streak: newStreak,
        longest_streak: Math.max(profile.longest_streak, newStreak),
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
    }

    setCompleted(true)
    setAlreadyDone(true)
  }

  function copyLink() {
    if (!course) return
    navigator.clipboard.writeText(course.uscreen_url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#93877e] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-[#93877e]">Cours introuvable</p>
        <Button onClick={() => router.back()} variant="outline">Retour</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24">
      {/* Back button */}
      <div className="px-5 pt-5">
        <button onClick={() => router.back()} className="flex items-center gap-2.5 text-sm font-medium text-white bg-[#C6684F] hover:bg-[#b05a42] px-4 py-2 rounded-xl transition-colors shadow-sm">
          <ArrowLeft size={16} />
          Retour aux cours
        </button>
      </div>

      {/* Thumbnail / Player zone */}
      <div className="mx-5 mt-4 rounded-2xl overflow-hidden bg-[#e8e0d8] aspect-video relative">
        {showPlayer ? (
          <iframe
            src={course.uscreen_url}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; encrypted-media"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
            ) : null}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <button
                onClick={() => setShowPlayer(true)}
                className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <Play size={24} className="text-[#93877e] ml-1" fill="currentColor" />
              </button>
              <span className="text-white text-sm font-medium drop-shadow">Regarder dans l'app</span>
            </div>
          </div>
        )}
      </div>

      {/* Course info */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 mt-5"
      >
        {/* Title & badges */}
        <div className="flex items-start gap-2 flex-wrap mb-2">
          <BadgePill>{LEVEL_LABELS[course.level] || course.level}</BadgePill>
          {course.focus.map(f => (
            <BadgePill key={f} variant="accent">{FOCUS_LABELS[f] || f}</BadgePill>
          ))}
        </div>
        <h1 className="font-serif text-2xl text-[#2c2825] leading-snug mt-2">{course.title}</h1>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-3 text-sm text-[#93877e]">
          <span className="flex items-center gap-1.5"><Clock size={14} />{course.duration_minutes} min</span>
          {course.avg_rating > 0 && (
            <span className="flex items-center gap-1.5"><Star size={14} className="fill-[#c4956a] text-[#c4956a]" />{course.avg_rating.toFixed(1)}</span>
          )}
          {course.views_count > 0 && <span>{course.views_count} vues</span>}
        </div>

        {/* Description */}
        {course.description && (
          <p className="text-[#6b5f57] mt-4 leading-relaxed">{course.description}</p>
        )}

        {/* Benefits */}
        {course.benefits.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium text-[#2c2825] mb-2">Bénéfices</h3>
            <ul className="space-y-1.5">
              {course.benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[#6b5f57]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#93877e] flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Marjorie's note */}
        {course.marjorie_notes && (
          <div className="mt-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="font-medium text-[#2c2825] text-sm">Note de Marjorie</span>
              {showNotes ? <ChevronUp size={16} className="text-[#93877e]" /> : <ChevronDown size={16} className="text-[#93877e]" />}
            </button>
            {showNotes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 p-4 bg-[#f5f0eb] rounded-xl"
              >
                <p className="text-sm text-[#6b5f57] italic leading-relaxed">"{course.marjorie_notes}"</p>
                <p className="text-xs text-[#93877e] mt-2">— Marjorie, MJ Pilates</p>
              </motion.div>
            )}
          </div>
        )}

        {/* Desktop link */}
        <div className="mt-6 p-4 bg-white rounded-xl border border-[#e8e0d8]">
          <div className="flex items-center gap-2 mb-2">
            <Monitor size={16} className="text-[#93877e]" />
            <span className="text-sm font-medium text-[#2c2825]">Regarder sur ordinateur</span>
          </div>
          <p className="text-xs text-[#93877e] mb-3">Copie le lien et ouvre-le sur ton ordinateur pour une meilleure expérience.</p>
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 flex-1 bg-[#f5f0eb] text-[#6b5f57] py-2 px-3 rounded-lg text-sm font-medium hover:bg-[#ede6dd] transition-colors"
            >
              <Monitor size={14} />
              {linkCopied ? 'Lien copié !' : 'Copier le lien'}
            </button>
            <a
              href={course.uscreen_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 flex-1 justify-center bg-[#f5f0eb] text-[#6b5f57] py-2 px-3 rounded-lg text-sm font-medium hover:bg-[#ede6dd] transition-colors"
            >
              <ExternalLink size={14} />
              Ouvrir uscreen
            </a>
          </div>
        </div>
      </motion.div>

      {/* Completion CTA — fixed bottom */}
      <div className="fixed bottom-20 left-0 right-0 px-5 z-40">
        {completed ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-green-500 text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-medium shadow-lg"
          >
            <Check size={20} />
            Séance enregistrée !
          </motion.div>
        ) : (
          <Button
            fullWidth
            size="lg"
            onClick={markCompleted}
            disabled={alreadyDone}
            className="shadow-lg"
          >
            {alreadyDone ? '✓ Déjà complété' : '✓ J\'ai terminé cette séance'}
          </Button>
        )}
      </div>
    </div>
  )
}
