'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Radio, Dumbbell, Minus, Plus, ChevronRight, Search, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logPractice, type PracticeLogInput, type PracticeLogResult } from '@/lib/practice-log'
import type { SessionType, Course } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (result: PracticeLogResult) => void
}

const SESSION_TYPES: { value: SessionType; label: string; icon: typeof Play; color: string; desc: string }[] = [
  { value: 'vod', label: 'Cours VOD', icon: Play, color: '#C6684F', desc: 'Replay ou cours à la demande' },
  { value: 'live', label: 'Cours live', icon: Radio, color: '#C6684F', desc: 'Session en direct avec Marjorie' },
  { value: 'libre', label: 'Pratique libre', icon: Dumbbell, color: '#7C3AED', desc: 'Yoga, stretching, marche...' },
  { value: 'repos', label: 'Jour de repos', icon: Moon, color: '#6B8E7B', desc: 'Récupération active — ta série continue' },
]

const LIBRE_LABELS = ['Pilates au sol', 'Stretching', 'Yoga', 'Marche', 'Renforcement', 'Autre']

const RATING_EMOJIS = [
  { value: 1, emoji: '😓', label: 'Difficile' },
  { value: 2, emoji: '😐', label: 'Moyen' },
  { value: 3, emoji: '🙂', label: 'Bien' },
  { value: 4, emoji: '😊', label: 'Super' },
  { value: 5, emoji: '🤩', label: 'Incroyable' },
]

export function PracticeLogModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'type' | 'details' | 'feedback'>('type')
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [duration, setDuration] = useState(30)
  const [rating, setRating] = useState<number | null>(null)
  const [libreLabel, setLibreLabel] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [courseSearch, setCourseSearch] = useState('')
  const [showCourseList, setShowCourseList] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('type')
      setSessionType(null)
      setDuration(30)
      setRating(null)
      setLibreLabel(null)
      setSelectedCourse(null)
      setCourseSearch('')
      setShowCourseList(false)
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  // Load courses for VOD selection
  useEffect(() => {
    if (sessionType !== 'vod' || courses.length > 0) return
    const supabase = createClient()
    supabase.from('courses').select('*').eq('is_published', true).order('title')
      .then(({ data }) => { if (data) setCourses(data as Course[]) })
  }, [sessionType, courses.length])

  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(courseSearch.toLowerCase())
  )

  function handleTypeSelect(type: SessionType) {
    setSessionType(type)
    if (type === 'repos') {
      setDuration(0)
      setStep('feedback')
      return
    }
    if (type === 'libre') setDuration(30)
    setStep('details')
  }

  function handleCourseSelect(course: Course) {
    setSelectedCourse(course)
    setDuration(course.duration_minutes)
    setShowCourseList(false)
    setCourseSearch('')
  }

  const handleSubmit = useCallback(async () => {
    if (!sessionType || submitting) return
    setSubmitting(true)
    setError(null)

    const input: PracticeLogInput = {
      sessionType,
      durationMinutes: duration,
      rating: rating ?? undefined,
      courseId: selectedCourse?.id,
      libreLabel: libreLabel ?? undefined,
    }

    try {
      const result = await logPractice(input)
      onSuccess(result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
      setSubmitting(false)
    }
  }, [sessionType, duration, rating, selectedCourse, libreLabel, submitting, onSuccess, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-white rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-5 pb-4 border-b border-[#F0EAE2] flex items-center justify-between z-10">
              <h2 className="font-[family-name:var(--font-heading)] text-xl text-[#2C2C2C]">
                {step === 'type' && 'Enregistrer une session'}
                {step === 'details' && (sessionType === 'vod' ? 'Cours VOD' : sessionType === 'live' ? 'Cours live' : 'Pratique libre')}
                {step === 'feedback' && (sessionType === 'repos' ? 'Jour de repos' : 'Comment c\'était ?')}
              </h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-[#A09488] hover:bg-[#F2E8DF] transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5">
              {/* Step 1: Type selection */}
              {step === 'type' && (
                <div className="space-y-3">
                  {SESSION_TYPES.map(({ value, label, icon: Icon, color, desc }) => (
                    <motion.button
                      key={value}
                      onClick={() => handleTypeSelect(value)}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl border border-[#DCCFBF] hover:border-[#C6684F]/40 hover:bg-[#FAF6F1] transition-colors text-left"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}12` }}>
                        <Icon size={24} style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-[15px] text-[#2C2C2C]">{label}</p>
                        <p className="text-[13px] text-[#A09488] mt-0.5">{desc}</p>
                      </div>
                      <ChevronRight size={16} className="text-[#DCCFBF]" />
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Step 2: Details */}
              {step === 'details' && (
                <div className="space-y-5">
                  {/* VOD: course picker */}
                  {sessionType === 'vod' && (
                    <div>
                      <label className="text-xs font-medium text-[#6B6359] mb-2 block">Cours (optionnel)</label>
                      {selectedCourse ? (
                        <div className="flex items-center gap-3 p-3 bg-[#F2E8DF] rounded-xl">
                          <Play size={16} className="text-[#C6684F] flex-shrink-0" />
                          <span className="text-sm text-[#2C2C2C] flex-1 truncate">{selectedCourse.title}</span>
                          <button onClick={() => { setSelectedCourse(null); setDuration(30) }} className="text-[#A09488] hover:text-[#C6684F]">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="flex items-center gap-2 border border-[#DCCFBF] rounded-xl px-3 py-2.5">
                            <Search size={14} className="text-[#A09488]" />
                            <input
                              value={courseSearch}
                              onChange={e => { setCourseSearch(e.target.value); setShowCourseList(true) }}
                              onFocus={() => setShowCourseList(true)}
                              placeholder="Rechercher un cours..."
                              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[#DCCFBF]"
                            />
                          </div>
                          {showCourseList && (
                            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-[#DCCFBF] rounded-xl shadow-lg max-h-40 overflow-y-auto">
                              {filteredCourses.length === 0 ? (
                                <p className="text-xs text-[#A09488] p-3">Aucun cours trouvé</p>
                              ) : (
                                filteredCourses.slice(0, 8).map(course => (
                                  <button
                                    key={course.id}
                                    onClick={() => handleCourseSelect(course)}
                                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2C] hover:bg-[#F2E8DF] transition-colors border-b border-[#F0EAE2] last:border-0"
                                  >
                                    <span className="truncate block">{course.title}</span>
                                    <span className="text-[10px] text-[#A09488]">{course.duration_minutes} min</span>
                                  </button>
                                ))
                              )}
                              <button
                                onClick={() => setShowCourseList(false)}
                                className="w-full text-center text-xs text-[#C6684F] py-2 hover:bg-[#F2E8DF]"
                              >
                                Passer — sans cours
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Libre: label chips */}
                  {sessionType === 'libre' && (
                    <div>
                      <label className="text-xs font-medium text-[#6B6359] mb-2 block">Type de pratique</label>
                      <div className="flex flex-wrap gap-2">
                        {LIBRE_LABELS.map(label => (
                          <button
                            key={label}
                            onClick={() => setLibreLabel(libreLabel === label ? null : label)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              libreLabel === label
                                ? 'bg-[#7C3AED] text-white'
                                : 'bg-[#F2E8DF] text-[#6B6359] hover:bg-[#EDE5DA]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duration stepper */}
                  <div>
                    <label className="text-xs font-medium text-[#6B6359] mb-3 block">Durée</label>
                    <div className="flex items-center justify-center gap-6 py-2">
                      <button
                        onClick={() => setDuration(d => Math.max(5, d - 5))}
                        className="w-12 h-12 rounded-full border-2 border-[#DCCFBF] flex items-center justify-center text-[#6B6359] hover:bg-[#F2E8DF] hover:border-[#C6684F]/30 transition-colors"
                      >
                        <Minus size={20} />
                      </button>
                      <div className="text-center min-w-[100px]">
                        <span className="text-4xl font-bold text-[#2C2C2C]">{duration}</span>
                        <p className="text-sm text-[#A09488] mt-1">minutes</p>
                      </div>
                      <button
                        onClick={() => setDuration(d => Math.min(180, d + 5))}
                        className="w-12 h-12 rounded-full border-2 border-[#DCCFBF] flex items-center justify-center text-[#6B6359] hover:bg-[#F2E8DF] hover:border-[#C6684F]/30 transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    {/* Quick presets */}
                    <div className="flex justify-center gap-2 mt-4">
                      {[15, 20, 30, 45, 60].map(min => (
                        <button
                          key={min}
                          onClick={() => setDuration(min)}
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                            duration === min ? 'bg-[#C6684F] text-white shadow-sm' : 'bg-[#F2E8DF] text-[#6B6359] hover:bg-[#EDE5DA]'
                          }`}
                        >
                          {min}min
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Next / Skip to submit */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('type')}
                      className="px-4 py-2.5 text-sm font-medium text-[#6B6359] hover:text-[#2C2C2C] transition-colors"
                    >
                      Retour
                    </button>
                    <button
                      onClick={() => setStep('feedback')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#C6684F] bg-[#C6684F]/10 hover:bg-[#C6684F]/15 transition-colors"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Feedback + Submit */}
              {step === 'feedback' && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-[#6B6359] mb-4 block">Comment tu te sens ? (optionnel)</label>
                    <div className="flex justify-center gap-4">
                      {RATING_EMOJIS.map(r => (
                        <button
                          key={r.value}
                          onClick={() => setRating(rating === r.value ? null : r.value)}
                          className={`flex flex-col items-center gap-1.5 transition-all ${rating === r.value ? 'scale-125' : 'opacity-50 hover:opacity-100 hover:scale-105'}`}
                        >
                          <span className={`text-3xl ${rating === r.value ? '' : 'grayscale'} transition-all`}>{r.emoji}</span>
                          <span className="text-[10px] text-[#A09488] font-medium">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-[#FAF6F1] rounded-2xl p-4 text-sm text-[#6B6359]">
                    {sessionType === 'repos' ? (
                      <div className="text-center py-2">
                        <Moon size={28} className="mx-auto text-[#6B8E7B] mb-2" />
                        <p className="text-[15px] font-semibold text-[#2C2C2C]">Journée de récupération</p>
                        <p className="text-[13px] text-[#9B8E82] mt-1">Ta série continue, ton corps récupère</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-[15px]">
                          <span className="font-semibold text-[#2C2C2C]">
                            {sessionType === 'vod' ? 'Cours VOD' : sessionType === 'live' ? 'Cours live' : 'Pratique libre'}
                          </span>
                          {selectedCourse && <span> — {selectedCourse.title}</span>}
                          {libreLabel && <span> — {libreLabel}</span>}
                        </p>
                        <p className="text-[13px] mt-1">{duration} min</p>
                      </>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('details')}
                      className="px-4 py-2.5 text-sm font-medium text-[#6B6359] hover:text-[#2C2C2C] transition-colors"
                    >
                      Retour
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#C6684F] hover:bg-[#b05a42] disabled:opacity-50 transition-colors"
                    >
                      {submitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                      ) : (
                        "C'est noté !"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
