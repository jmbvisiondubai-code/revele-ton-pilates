'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Video, Calendar, BookOpen, Users, Trophy, Clock, Flame, TrendingUp,
  Play, ChevronRight, AlertCircle, MessageSquare, Star, Activity,
  Sparkles, ArrowUpRight, Zap,
} from 'lucide-react'
import { formatDuration, LEVEL_LABELS } from '@/lib/utils'

type ClientRow = {
  id: string
  first_name: string
  last_name: string
  username: string
  practice_level: string | null
  total_sessions: number
  total_practice_minutes: number
  current_streak: number
  created_at: string
}

type LiveWithReplay = {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  replay_url: string | null
  is_cancelled: boolean
  registered_count: number
}

export default function AdminPage() {
  const [stats, setStats] = useState({ courses: 0, lives: 0, articles: 0, members: 0 })
  const [clients, setClients] = useState<ClientRow[]>([])
  const [recentLives, setRecentLives] = useState<LiveWithReplay[]>([])
  const [upcomingLives, setUpcomingLives] = useState<LiveWithReplay[]>([])
  const [totalCompletions, setTotalCompletions] = useState(0)
  const [recentCompletions, setRecentCompletions] = useState<{ user_id: string; username: string; course_title: string; completed_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const now = new Date().toISOString()

      const [courses, lives, articles, members, profiles, pastLives, futureLives, completionsCount, recentActivity] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('live_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('articles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', false),
        supabase.from('profiles')
          .select('id, first_name, last_name, username, practice_level, total_sessions, total_practice_minutes, current_streak, created_at')
          .eq('is_admin', false)
          .order('total_sessions', { ascending: false })
          .limit(10),
        supabase.from('live_sessions')
          .select('id, title, scheduled_at, duration_minutes, replay_url, is_cancelled, registered_count')
          .lt('scheduled_at', now)
          .eq('is_cancelled', false)
          .order('scheduled_at', { ascending: false })
          .limit(10),
        supabase.from('live_sessions')
          .select('id, title, scheduled_at, duration_minutes, replay_url, is_cancelled, registered_count')
          .gte('scheduled_at', now)
          .eq('is_cancelled', false)
          .order('scheduled_at', { ascending: true })
          .limit(5),
        supabase.from('course_completions').select('id', { count: 'exact', head: true }),
        supabase.from('course_completions')
          .select('user_id, completed_at, courses(title), profiles!course_completions_user_id_fkey(username)')
          .order('completed_at', { ascending: false })
          .limit(8),
      ])

      setStats({
        courses: courses.count ?? 0,
        lives: lives.count ?? 0,
        articles: articles.count ?? 0,
        members: members.count ?? 0,
      })
      setClients((profiles.data as ClientRow[]) ?? [])
      setRecentLives((pastLives.data as LiveWithReplay[]) ?? [])
      setUpcomingLives((futureLives.data as LiveWithReplay[]) ?? [])
      setTotalCompletions(completionsCount.count ?? 0)
      setRecentCompletions(
        (recentActivity.data ?? []).map((c: any) => ({
          user_id: c.user_id,
          username: c.profiles?.username ?? 'Membre',
          course_title: c.courses?.title ?? 'Cours',
          completed_at: c.completed_at,
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  const totalMinutes = clients.reduce((sum, c) => sum + c.total_practice_minutes, 0)
  const totalSessions = clients.reduce((sum, c) => sum + c.total_sessions, 0)
  const avgSessionsPerClient = clients.length > 0 ? Math.round(totalSessions / clients.length) : 0
  const replaysAvailable = recentLives.filter(l => l.replay_url).length
  const replaysTotal = recentLives.length

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }
  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `il y a ${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `il y a ${hours}h`
    const days = Math.floor(hours / 24)
    return `il y a ${days}j`
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-[#C6684F]/20 border-t-[#C6684F] rounded-full animate-spin" />
          <Sparkles size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#C6684F]" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[13px] font-medium text-[#86868b]">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mt-0.5">
            {greeting}, Marjorie
          </h1>
        </div>
      </div>

      {/* ── Stats row — glass cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: stats.members, label: 'Clientes', icon: Users, color: '#C6684F' },
          { value: totalCompletions, label: 'Cours complétés', icon: Trophy, color: '#8B7355' },
          { value: formatDuration(totalMinutes), label: 'Pratique totale', icon: Clock, color: '#5B8A6B' },
          { value: upcomingLives.length, label: 'Lives à venir', icon: Calendar, color: '#6B7FA0' },
        ].map(({ value, label, icon: Icon, color }) => (
          <div key={label} className="backdrop-blur-xl bg-white/80 rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:bg-white/90">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}10` }}>
                <Icon size={15} style={{ color }} />
              </div>
            </div>
            <div className="text-[26px] font-bold text-[#1d1d1f] tracking-tight leading-none">{value}</div>
            <div className="text-[12px] text-[#86868b] mt-1.5 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Action cards — subtle gradients ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Cours VOD', value: stats.courses, icon: Video, href: '/admin/cours', bg: 'bg-gradient-to-br from-[#C6684F] to-[#d8896f]' },
          { label: 'Sessions Live', value: stats.lives, icon: Calendar, href: '/admin/lives', bg: 'bg-gradient-to-br from-[#8B7355] to-[#a89070]' },
          { label: 'Articles', value: stats.articles, icon: BookOpen, href: '/admin/articles', bg: 'bg-gradient-to-br from-[#5B8A6B] to-[#7ba98b]' },
          { label: 'Replays', value: `${replaysAvailable}/${replaysTotal}`, icon: Play, href: '/admin/lives', bg: 'bg-gradient-to-br from-[#6B7FA0] to-[#8b9fbb]' },
        ].map(({ label, value, icon: Icon, href, bg }) => (
          <Link key={label} href={href}
            className={`group relative overflow-hidden rounded-2xl p-5 text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] ${bg}`}>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <Icon size={18} className="text-white/70" />
                <ArrowUpRight size={14} className="text-white/30 group-hover:text-white/70 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-[13px] text-white/60 mt-0.5 font-medium">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Top clientes */}
        <div className="lg:col-span-3 backdrop-blur-xl bg-white/80 rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#C6684F]/10 flex items-center justify-center">
                <Users size={15} className="text-[#C6684F]" />
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-[#1d1d1f]">Top Clientes</h3>
                <p className="text-[11px] text-[#86868b]">{avgSessionsPerClient} séances en moyenne</p>
              </div>
            </div>
            <Link href="/admin/clientes" className="flex items-center gap-1 text-[12px] font-medium text-[#C6684F] hover:text-[#b05a42] transition px-2.5 py-1.5 rounded-lg hover:bg-[#C6684F]/5">
              Voir tout <ChevronRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-black/[0.03]">
            {clients.length === 0 && (
              <div className="px-5 py-12 text-center text-[13px] text-[#86868b]">Aucune cliente inscrite</div>
            )}
            {clients.map((c, i) => (
              <Link key={c.id} href="/admin/clientes"
                className="flex items-center gap-3.5 px-5 py-3 hover:bg-black/[0.015] transition-all group">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white'
                  : i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                  : i === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white'
                  : 'bg-[#f5f5f7] text-[#86868b]'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[#1d1d1f] truncate">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b] font-medium flex-shrink-0">
                      {LEVEL_LABELS[c.practice_level || ''] || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-[#86868b] flex items-center gap-1">
                      <Trophy size={10} className="text-[#C6684F]" /> {c.total_sessions}
                    </span>
                    <span className="text-[11px] text-[#86868b] flex items-center gap-1">
                      <Clock size={10} /> {formatDuration(c.total_practice_minutes)}
                    </span>
                    {c.current_streak > 0 && (
                      <span className="text-[11px] text-amber-600 flex items-center gap-1 font-medium">
                        <Flame size={10} /> {c.current_streak}j
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={13} className="text-[#d1d1d6] group-hover:text-[#C6684F] transition flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="lg:col-span-2 backdrop-blur-xl bg-white/80 rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#5B8A6B]/10 flex items-center justify-center">
                <Activity size={15} className="text-[#5B8A6B]" />
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-[#1d1d1f]">Activité récente</h3>
                <p className="text-[11px] text-[#86868b]">{totalCompletions} cours complétés</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-black/[0.03]">
            {recentCompletions.length === 0 && (
              <div className="px-5 py-12 text-center text-[13px] text-[#86868b]">Aucune activité</div>
            )}
            {recentCompletions.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <div className="w-6 h-6 rounded-full bg-[#5B8A6B]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap size={11} className="text-[#5B8A6B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#1d1d1f] leading-snug">
                    <span className="font-semibold">{a.username}</span>{' '}
                    <span className="text-[#86868b]">a terminé</span>{' '}
                    <span className="font-medium text-[#C6684F]">{a.course_title}</span>
                  </p>
                  <p className="text-[10px] text-[#aeaeb2] mt-0.5">{timeAgo(a.completed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lives section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Prochains lives */}
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#8B7355]/10 flex items-center justify-center">
                <Calendar size={15} className="text-[#8B7355]" />
              </div>
              <h3 className="font-semibold text-[15px] text-[#1d1d1f]">Prochains lives</h3>
            </div>
            <Link href="/admin/lives" className="flex items-center gap-1 text-[12px] font-medium text-[#C6684F] hover:text-[#b05a42] transition px-2.5 py-1.5 rounded-lg hover:bg-[#C6684F]/5">
              Gérer <ChevronRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-black/[0.03]">
            {upcomingLives.length === 0 && (
              <div className="px-5 py-12 text-center">
                <Calendar size={28} className="text-[#d1d1d6] mx-auto mb-2" />
                <p className="text-[13px] text-[#86868b]">Aucun live programmé</p>
              </div>
            )}
            {upcomingLives.map(l => {
              const d = new Date(l.scheduled_at)
              const isToday = d.toDateString() === now.toDateString()
              const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString()
              return (
                <div key={l.id} className="flex items-center gap-3.5 px-5 py-3.5">
                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                    isToday ? 'bg-[#C6684F] text-white' : 'bg-[#f5f5f7] text-[#6e6e73]'
                  }`}>
                    <span className="text-[13px] font-bold leading-none">
                      {d.toLocaleDateString('fr-FR', { day: 'numeric' })}
                    </span>
                    <span className="text-[9px] uppercase leading-none mt-0.5 opacity-60">
                      {d.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{l.title}</p>
                      {isToday && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#C6684F]/10 text-[#C6684F] font-bold uppercase">Aujourd&apos;hui</span>}
                      {isTomorrow && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold uppercase">Demain</span>}
                    </div>
                    <p className="text-[11px] text-[#86868b] mt-0.5">
                      {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{l.duration_minutes} min
                      {l.registered_count > 0 && (
                        <span className="ml-1.5 text-[#5B8A6B] font-medium">{l.registered_count} inscrite{l.registered_count > 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Replays */}
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#6B7FA0]/10 flex items-center justify-center">
                <Play size={15} className="text-[#6B7FA0]" />
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-[#1d1d1f]">Replays</h3>
                <p className="text-[11px] text-[#86868b]">{replaysAvailable} disponibles sur {replaysTotal}</p>
              </div>
            </div>
            <Link href="/admin/lives" className="flex items-center gap-1 text-[12px] font-medium text-[#C6684F] hover:text-[#b05a42] transition px-2.5 py-1.5 rounded-lg hover:bg-[#C6684F]/5">
              Gérer <ChevronRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-black/[0.03]">
            {recentLives.length === 0 && (
              <div className="px-5 py-12 text-center">
                <Play size={28} className="text-[#d1d1d6] mx-auto mb-2" />
                <p className="text-[13px] text-[#86868b]">Aucune session passée</p>
              </div>
            )}
            {recentLives.map(l => (
              <div key={l.id} className="flex items-center gap-3.5 px-5 py-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  l.replay_url ? 'bg-[#5B8A6B]/8' : 'bg-[#f5f5f7]'
                }`}>
                  {l.replay_url ? (
                    <Play size={13} className="text-[#5B8A6B]" />
                  ) : (
                    <AlertCircle size={13} className="text-[#aeaeb2]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{l.title}</p>
                  <p className="text-[11px] text-[#86868b]">
                    {formatDate(l.scheduled_at)} · {l.duration_minutes} min
                  </p>
                </div>
                {l.replay_url ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#5B8A6B]/8 text-[#5B8A6B] font-semibold flex-shrink-0">
                    Disponible
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#aeaeb2] font-medium flex-shrink-0">
                    Manquant
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Répartition des niveaux ── */}
      <div className="backdrop-blur-xl bg-white/80 rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#C6684F]/10 flex items-center justify-center">
              <Star size={15} className="text-[#C6684F]" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-[#1d1d1f]">Répartition des niveaux</h3>
              <p className="text-[11px] text-[#86868b]">{stats.members} clientes au total</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['debutante', 'initiee', 'intermediaire', 'avancee'] as const).map(level => {
              const count = clients.filter(c => c.practice_level === level).length
              const colors: Record<string, { bg: string; bar: string; text: string }> = {
                debutante: { bg: 'bg-emerald-50/80', bar: 'bg-emerald-400', text: 'text-emerald-600' },
                initiee: { bg: 'bg-teal-50/80', bar: 'bg-teal-400', text: 'text-teal-600' },
                intermediaire: { bg: 'bg-violet-50/80', bar: 'bg-violet-400', text: 'text-violet-600' },
                avancee: { bg: 'bg-amber-50/80', bar: 'bg-amber-400', text: 'text-amber-600' },
              }
              const pct = stats.members > 0 ? Math.round((count / stats.members) * 100) : 0
              return (
                <div key={level} className={`rounded-2xl ${colors[level].bg} border border-black/[0.04] p-5 text-center`}>
                  <div className={`text-[28px] font-bold text-[#1d1d1f] tracking-tight`}>{count}</div>
                  <div className={`text-[12px] font-semibold mt-0.5 ${colors[level].text}`}>{LEVEL_LABELS[level]}</div>
                  <div className="w-full bg-white/60 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div className={`${colors[level].bar} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] text-[#86868b] font-medium mt-1.5">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
