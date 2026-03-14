'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Play,
  Radio,
  Dumbbell,
  Moon,
  Check,
  Plus,
  Trash2,
  Pencil,
  MoreVertical,
} from 'lucide-react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, isSameMonth, isSameDay, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { updatePractice, deletePractice } from '@/lib/practice-log'
import { PracticeLogModal } from '@/components/practice-log-modal'
import type { SessionType, CourseCompletion } from '@/types/database'

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SESSION_ICONS: Record<SessionType, { icon: typeof Play; color: string; label: string }> = {
  vod: { icon: Play, color: '#C6684F', label: 'Cours VOD' },
  live: { icon: Radio, color: '#C6684F', label: 'Cours live' },
  libre: { icon: Dumbbell, color: '#7C3AED', label: 'Pratique libre' },
  repos: { icon: Moon, color: '#6B8E7B', label: 'Jour de repos' },
}

export default function JournalPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [monthCompletions, setMonthCompletions] = useState<Record<string, CourseCompletion[]>>({})
  const [showLogModal, setShowLogModal] = useState(false)
  const [logEditId, setLogEditId] = useState<string | null>(null)
  const [logEditDefaults, setLogEditDefaults] = useState<{ sessionType?: SessionType; duration?: number; rating?: number | null; libreLabel?: string | null } | undefined>(undefined)
  const [viewingCompletion, setViewingCompletion] = useState<CourseCompletion | null>(null)
  const [showDetailMenu, setShowDetailMenu] = useState(false)
  const [detailEditing, setDetailEditing] = useState(false)
  const [editDuration, setEditDuration] = useState(0)
  const [editRating, setEditRating] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const today = new Date()

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const calendarDays: Date[] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    calendarDays.push(new Date(day))
    day = addDays(day, 1)
  }

  const fetchMonthCompletions = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const startKey = toDateKey(calendarStart)
    const endDate = addDays(calendarEnd, 1)
    const endKey = toDateKey(endDate)

    const { data } = await supabase
      .from('course_completions')
      .select('*')
      .eq('user_id', user.id)
      .gte('completed_at', startKey)
      .lt('completed_at', endKey)
      .order('completed_at', { ascending: true })

    if (data) {
      const grouped: Record<string, CourseCompletion[]> = {}
      for (const c of data as CourseCompletion[]) {
        const key = c.completed_at.split('T')[0]
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(c)
      }
      setMonthCompletions(grouped)
    }
  }, [currentMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMonthCompletions()
  }, [fetchMonthCompletions])

  const selectedDateKey = toDateKey(selectedDate)
  const selectedCompletions = monthCompletions[selectedDateKey] || []
  const isSelectedFuture = selectedDate > today && !isSameDay(selectedDate, today)

  async function handleDeleteCompletion(completionId: string) {
    setActionLoading(true)
    try {
      await deletePractice(completionId)
      setViewingCompletion(null)
      await fetchMonthCompletions()
    } catch { /* RLS might block */ }
    setActionLoading(false)
  }

  async function handleSaveEdit() {
    if (!viewingCompletion) return
    setActionLoading(true)
    try {
      await updatePractice({
        id: viewingCompletion.id,
        durationMinutes: editDuration,
        rating: editRating,
      })
      setDetailEditing(false)
      setViewingCompletion(null)
      await fetchMonthCompletions()
    } catch { /* silently fail */ }
    setActionLoading(false)
  }

  function enterEditMode() {
    if (!viewingCompletion) return
    setEditDuration(viewingCompletion.duration_watched_minutes ?? 0)
    setEditRating(viewingCompletion.rating ?? null)
    setShowDetailMenu(false)
    setDetailEditing(true)
  }

  function handleLogSuccess() {
    fetchMonthCompletions()
  }

  const canGoNext = (() => {
    const nextMonth = addMonths(currentMonth, 1)
    const nextMonthStart = startOfMonth(nextMonth)
    return nextMonthStart <= today
  })()

  const RATING_EMOJIS = [
    { value: 1, emoji: '\u{1F613}', label: 'Difficile' },
    { value: 2, emoji: '\u{1F610}', label: 'Moyen' },
    { value: 3, emoji: '\u{1F642}', label: 'Bien' },
    { value: 4, emoji: '\u{1F60A}', label: 'Super' },
    { value: 5, emoji: '\u{1F929}', label: 'Incroyable' },
  ]

  return (
    <div className="px-5 pt-6 pb-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#9B8E82] hover:bg-[#F0EBE5] transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-[family-name:var(--font-heading)] text-[24px] text-[#1D1D1F]">Mon journal</h1>
      </div>

      {/* Month navigation */}
      <div className="rounded-2xl bg-white border border-[#E8DDD4] overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, -1))}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#9B8E82] hover:bg-[#F0EBE5] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-[16px] font-bold text-[#1D1D1F] capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h2>
          <button
            onClick={() => { if (canGoNext) setCurrentMonth(m => addMonths(m, 1)) }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              canGoNext ? 'text-[#9B8E82] hover:bg-[#F0EBE5]' : 'text-[#E8DDD4] cursor-not-allowed'
            }`}
            disabled={!canGoNext}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 px-3 pb-2">
          {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold tracking-wider text-[#AEAEB2]">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-3 pb-4 gap-y-1">
          {calendarDays.map((d, i) => {
            const dateKey = toDateKey(d)
            const isCurrentMonth = isSameMonth(d, currentMonth)
            const isToday = isSameDay(d, today)
            const isSelected = isSameDay(d, selectedDate)
            const hasCompletions = (monthCompletions[dateKey] || []).length > 0
            const hasRepos = (monthCompletions[dateKey] || []).some(c => c.session_type === 'repos')
            const isFuture = d > today && !isToday

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
                  !isCurrentMonth ? 'opacity-30' : ''
                } ${isSelected ? 'bg-[#FAF6F1]' : 'hover:bg-[#FAF6F1]/50'}`}
              >
                <span className={`text-[13px] font-medium leading-none ${
                  isToday
                    ? 'text-[#C6684F] font-bold'
                    : isSelected
                      ? 'text-[#1D1D1F] font-bold'
                      : isFuture
                        ? 'text-[#D1CCC5]'
                        : 'text-[#1D1D1F]'
                }`}>
                  {d.getDate()}
                </span>
                {/* Activity dot */}
                <div className="h-2 mt-0.5 flex items-center justify-center">
                  {hasCompletions && (
                    <span className={`w-[6px] h-[6px] rounded-full ${
                      hasRepos ? 'bg-[#6B8E7B]' : 'bg-[#34C759]'
                    }`} />
                  )}
                </div>
                {/* Today ring */}
                {isToday && (
                  <span className="absolute inset-x-1 inset-y-0 rounded-xl border-2 border-[#C6684F]/30 pointer-events-none" />
                )}
                {/* Selected ring */}
                {isSelected && !isToday && (
                  <span className="absolute inset-x-1 inset-y-0 rounded-xl border-2 border-[#E8DDD4] pointer-events-none" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div className="rounded-2xl bg-white border border-[#E8DDD4] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE5]">
          <p className="text-[14px] font-semibold text-[#1D1D1F] capitalize">
            {format(selectedDate, "EEEE d MMMM", { locale: fr })}
          </p>
          {!isSelectedFuture && (
            <button
              onClick={() => { setLogEditId(null); setLogEditDefaults(undefined); setShowLogModal(true) }}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[#C6684F] hover:text-[#b05a42] transition-colors"
            >
              <Plus size={14} />
              Ajouter
            </button>
          )}
        </div>

        <div className="px-4 py-4">
          {selectedCompletions.length > 0 ? (
            <div className="space-y-2">
              {selectedCompletions.map((c) => {
                const info = SESSION_ICONS[c.session_type] || SESSION_ICONS.libre
                const Icon = info.icon
                return (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => { setViewingCompletion(c); setShowDetailMenu(false) }}
                    className="w-full flex items-center gap-3 bg-[#FAF6F1] rounded-xl px-3.5 py-3 hover:bg-[#F0EBE5] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${info.color}12` }}>
                      <Icon size={15} style={{ color: info.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1D1D1F]">
                        {c.session_type === 'repos' ? 'Jour de repos' : info.label}
                        {c.libre_label && <span className="text-[#86868B]"> · {c.libre_label}</span>}
                      </p>
                      {c.session_type !== 'repos' && c.duration_watched_minutes != null && c.duration_watched_minutes > 0 && (
                        <p className="text-[11px] text-[#9B8E82]">{c.duration_watched_minutes} min</p>
                      )}
                    </div>
                    {c.rating && (
                      <span className="text-[16px]">
                        {c.rating === 1 ? '\u{1F613}' : c.rating === 2 ? '\u{1F610}' : c.rating === 3 ? '\u{1F642}' : c.rating === 4 ? '\u{1F60A}' : '\u{1F929}'}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-[#D1CCC5] flex-shrink-0" />
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-3">
              {isSelectedFuture ? (
                <p className="text-[13px] text-[#D1CCC5]">Jour à venir</p>
              ) : (
                <p className="text-[13px] text-[#9B8E82]">Aucune activité enregistrée</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Activity detail sheet ─── */}
      <AnimatePresence>
        {viewingCompletion && (() => {
          const c = viewingCompletion
          const info = SESSION_ICONS[c.session_type] || SESSION_ICONS.libre
          const Icon = info.icon
          const ratingObj = RATING_EMOJIS.find(r => r.value === c.rating)
          const completedTime = c.completed_at.includes('T') ? format(new Date(c.completed_at), "HH'h'mm", { locale: fr }) : null

          return (
            <motion.div
              key="detail-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => { if (!detailEditing) { setViewingCompletion(null); setShowDetailMenu(false); setDetailEditing(false) } }}
            >
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-white rounded-t-3xl lg:rounded-3xl w-full max-w-lg shadow-2xl mx-0 lg:mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4">
                  <button
                    onClick={() => {
                      if (detailEditing) { setDetailEditing(false) }
                      else { setViewingCompletion(null); setShowDetailMenu(false); setDetailEditing(false) }
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#9B8E82] hover:bg-[#F0EBE5] transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h3 className="text-[14px] font-bold text-[#1D1D1F] uppercase tracking-[0.08em]">
                    {detailEditing ? 'Modifier' : 'Détail activité'}
                  </h3>
                  {!detailEditing ? (
                    <div className="relative">
                      <button
                        onClick={() => setShowDetailMenu(!showDetailMenu)}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[#9B8E82] hover:bg-[#F0EBE5] transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>
                      <AnimatePresence>
                        {showDetailMenu && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-11 z-20 bg-white border border-[#E8DDD4] rounded-xl shadow-lg overflow-hidden min-w-[160px]"
                          >
                            <button
                              onClick={enterEditMode}
                              className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-[#1D1D1F] hover:bg-[#FAF6F1] transition-colors text-left"
                            >
                              <Pencil size={14} className="text-[#9B8E82]" />
                              Modifier
                            </button>
                            <div className="border-t border-[#F0EBE5]" />
                            <button
                              onClick={() => { setShowDetailMenu(false); handleDeleteCompletion(c.id) }}
                              disabled={actionLoading}
                              className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              Supprimer
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="w-9" />
                  )}
                </div>

                {/* VIEW MODE */}
                {!detailEditing && (
                  <div className="px-5 pb-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${info.color}12` }}>
                        <Icon size={28} style={{ color: info.color }} />
                      </div>
                      <div>
                        <h4 className="text-[18px] font-bold text-[#1D1D1F]">
                          {c.session_type === 'repos' ? 'Jour de repos' : info.label}
                        </h4>
                        {c.libre_label && <p className="text-[13px] text-[#86868B] mt-0.5">{c.libre_label}</p>}
                        {completedTime && <p className="text-[12px] text-[#9B8E82] mt-0.5">{completedTime}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {c.session_type !== 'repos' && c.duration_watched_minutes != null && c.duration_watched_minutes > 0 && (
                        <div className="bg-[#FAF6F1] rounded-xl px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9B8E82] mb-1">Durée</p>
                          <p className="text-[20px] font-bold text-[#1D1D1F]">{c.duration_watched_minutes} <span className="text-[13px] font-medium text-[#9B8E82]">min</span></p>
                        </div>
                      )}
                      {c.session_type === 'repos' && (
                        <div className="bg-[#F0F7F2] rounded-xl px-4 py-3 col-span-2">
                          <div className="flex items-center gap-2">
                            <Moon size={16} className="text-[#6B8E7B]" />
                            <p className="text-[14px] font-medium text-[#1D1D1F]">Journée de récupération</p>
                          </div>
                          <p className="text-[12px] text-[#6B8E7B] mt-1">Ta série continue, ton corps récupère</p>
                        </div>
                      )}
                      {ratingObj && (
                        <div className="bg-[#FAF6F1] rounded-xl px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9B8E82] mb-1">Ressenti</p>
                          <p className="text-[16px]">{ratingObj.emoji} {ratingObj.label}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ backgroundColor: `${info.color}12`, color: info.color }}>
                        <Icon size={12} />
                        {c.session_type === 'vod' ? 'VOD' : c.session_type === 'live' ? 'Live' : c.session_type === 'libre' ? 'Libre' : 'Repos'}
                      </span>
                      {c.feedback && <span className="text-[12px] text-[#9B8E82] truncate">{c.feedback}</span>}
                    </div>
                  </div>
                )}

                {/* EDIT MODE */}
                {detailEditing && (
                  <div className="px-5 pb-6">
                    <div className="flex items-center gap-3 mb-6 bg-[#FAF6F1] rounded-xl px-4 py-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${info.color}12` }}>
                        <Icon size={20} style={{ color: info.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-[#1D1D1F]">
                          {c.session_type === 'repos' ? 'Jour de repos' : info.label}
                        </p>
                        {c.libre_label && <p className="text-[12px] text-[#86868B]">{c.libre_label}</p>}
                      </div>
                      <button
                        onClick={() => {
                          setDetailEditing(false)
                          setViewingCompletion(null)
                          setLogEditId(c.id)
                          setLogEditDefaults({
                            sessionType: c.session_type,
                            duration: c.duration_watched_minutes ?? 0,
                            rating: c.rating,
                            libreLabel: c.libre_label,
                          })
                          setShowLogModal(true)
                        }}
                        className="text-[12px] font-semibold text-[#C6684F] hover:underline"
                      >
                        Changer
                      </button>
                    </div>

                    {c.session_type !== 'repos' && (
                      <div className="mb-6">
                        <label className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9B8E82] mb-3 block">Durée</label>
                        <div className="flex items-center justify-center gap-5">
                          <button
                            onClick={() => setEditDuration(d => Math.max(5, d - 5))}
                            className="w-10 h-10 rounded-full border-2 border-[#E8DDD4] flex items-center justify-center text-[#6B6359] hover:bg-[#F0EBE5] transition-colors"
                          >
                            <span className="text-lg font-bold">-</span>
                          </button>
                          <div className="text-center min-w-[80px]">
                            <span className="text-[32px] font-bold text-[#1D1D1F]">{editDuration}</span>
                            <p className="text-[12px] text-[#9B8E82]">min</p>
                          </div>
                          <button
                            onClick={() => setEditDuration(d => Math.min(180, d + 5))}
                            className="w-10 h-10 rounded-full border-2 border-[#E8DDD4] flex items-center justify-center text-[#6B6359] hover:bg-[#F0EBE5] transition-colors"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        <div className="flex justify-center gap-2 mt-3">
                          {[15, 20, 30, 45, 60].map(min => (
                            <button
                              key={min}
                              onClick={() => setEditDuration(min)}
                              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                                editDuration === min ? 'bg-[#C6684F] text-white' : 'bg-[#F0EBE5] text-[#6B6359] hover:bg-[#E8DDD4]'
                              }`}
                            >
                              {min}min
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mb-6">
                      <label className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9B8E82] mb-3 block">Ressenti</label>
                      <div className="flex justify-center gap-4">
                        {RATING_EMOJIS.map(r => (
                          <button
                            key={r.value}
                            onClick={() => setEditRating(editRating === r.value ? null : r.value)}
                            className={`flex flex-col items-center gap-1 transition-all ${editRating === r.value ? 'scale-125' : 'opacity-40 hover:opacity-80 hover:scale-105'}`}
                          >
                            <span className={`text-2xl ${editRating === r.value ? '' : 'grayscale'} transition-all`}>{r.emoji}</span>
                            <span className="text-[9px] text-[#9B8E82] font-medium">{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setDetailEditing(false)}
                        className="px-4 py-2.5 text-[13px] font-medium text-[#6B6359] hover:text-[#1D1D1F] transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white bg-[#C6684F] hover:bg-[#b05a42] disabled:opacity-50 transition-colors"
                      >
                        {actionLoading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : (
                          'Enregistrer'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Practice log modal */}
      <PracticeLogModal
        open={showLogModal}
        onClose={() => { setShowLogModal(false); setLogEditId(null); setLogEditDefaults(undefined) }}
        onSuccess={handleLogSuccess}
        defaultDate={selectedDateKey}
        editId={logEditId}
        editDefaults={logEditDefaults}
        dayActivities={selectedCompletions.map(c => ({ session_type: c.session_type }))}
      />
    </div>
  )
}
