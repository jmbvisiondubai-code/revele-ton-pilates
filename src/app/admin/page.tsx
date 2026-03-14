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
    <div className="max-w-6xl mx-auto space-y-8">

      {/* ── Header with greeting ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2C2C2C] via-[#3d3530] to-[#4a3f37] p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C6684F]/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#C6684F]/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[#C6684F] mb-1">
            <Sparkles size={14} />
            <span className="text-xs font-medium tracking-wider uppercase">Espace Admin</span>
          </div>
          <h1 className="font-serif text-3xl font-light">{greeting}, Marjorie</h1>
          <p className="text-white/50 text-sm mt-2">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Quick stats row */}
        <div className="relative grid grid-cols-4 gap-4 mt-8">
          {[
            { value: stats.members, label: 'Clientes', icon: Users },
            { value: totalCompletions, label: 'Cours complétés', icon: Trophy },
            { value: formatDuration(totalMinutes), label: 'Pratique totale', icon: Clock },
            { value: upcomingLives.length, label: 'Lives à venir', icon: Calendar },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 mb-2">
                <Icon size={14} className="text-[#C6684F]" />
              </div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-[11px] text-white/40 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Cours VOD', value: stats.courses, icon: Video, href: '/admin/cours', gradient: 'from-[#C6684F] to-[#E8926F]' },
          { label: 'Sessions Live', value: stats.lives, icon: Calendar, href: '/admin/lives', gradient: 'from-[#8B7355] to-[#A89070]' },
          { label: 'Articles', value: stats.articles, icon: BookOpen, href: '/admin/articles', gradient: 'from-[#5B8A6B] to-[#7BA98B]' },
          { label: 'Replays', value: `${replaysAvailable}/${replaysTotal}`, icon: Play, href: '/admin/lives', gradient: 'from-[#6B7FA0] to-[#8B9FBB]' },
        ].map(({ label, value, icon: Icon, href, gradient }) => (
          <Link key={label} href={href}
            className="group relative overflow-hidden rounded-2xl p-5 text-white transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <Icon size={20} className="text-white/80" />
                <ArrowUpRight size={16} className="text-white/40 group-hover:text-white/80 transition" />
              </div>
              <div className="text-3xl font-bold">{value}</div>
              <div className="text-sm text-white/70 mt-0.5">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Top clientes (3 cols) ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#E8E0D8] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#F5F0EB]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C6684F] to-[#E8926F] flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#2C2C2C]">Top Clientes</h3>
                <p className="text-[11px] text-[#A09488]">{avgSessionsPerClient} séances en moyenne</p>
              </div>
            </div>
            <Link href="/admin/clientes" className="flex items-center gap-1.5 text-xs font-medium text-[#C6684F] hover:text-[#b05a42] transition px-3 py-1.5 rounded-lg hover:bg-[#C6684F]/5">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {clients.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-[#A09488]">Aucune cliente inscrite</div>
            )}
            {clients.map((c, i) => (
              <Link key={c.id} href="/admin/clientes"
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-gradient-to-r hover:from-[#FAF6F1] hover:to-transparent transition-all group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-sm shadow-amber-200'
                  : i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                  : i === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white'
                  : 'bg-[#F2E8DF] text-[#6B6359]'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#2C2C2C] truncate">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2E8DF] text-[#6B6359] font-medium flex-shrink-0">
                      {LEVEL_LABELS[c.practice_level || ''] || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-[#A09488] flex items-center gap-1">
                      <Trophy size={10} className="text-[#C6684F]" /> {c.total_sessions}
                    </span>
                    <span className="text-[11px] text-[#A09488] flex items-center gap-1">
                      <Clock size={10} /> {formatDuration(c.total_practice_minutes)}
                    </span>
                    {c.current_streak > 0 && (
                      <span className="text-[11px] text-amber-600 flex items-center gap-1 font-medium">
                        <Flame size={10} /> {c.current_streak}j
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-[#DCCFBF] group-hover:text-[#C6684F] transition flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Activité récente (2 cols) ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E0D8] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#F5F0EB]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B8A6B] to-[#7BA98B] flex items-center justify-center">
                <Activity size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#2C2C2C]">Activité récente</h3>
                <p className="text-[11px] text-[#A09488]">{totalCompletions} cours complétés au total</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {recentCompletions.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-[#A09488]">Aucune activité</div>
            )}
            {recentCompletions.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3.5">
                <div className="w-7 h-7 rounded-full bg-[#5B8A6B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap size={12} className="text-[#5B8A6B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#2C2C2C] leading-snug">
                    <span className="font-semibold">{a.username}</span>{' '}
                    <span className="text-[#6B6359]">a terminé</span>{' '}
                    <span className="font-medium text-[#C6684F]">{a.course_title}</span>
                  </p>
                  <p className="text-[10px] text-[#A09488] mt-1">{timeAgo(a.completed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lives section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming lives */}
        <div className="bg-white rounded-2xl border border-[#E8E0D8] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#F5F0EB]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B7355] to-[#A89070] flex items-center justify-center">
                <Calendar size={16} className="text-white" />
              </div>
              <h3 className="font-semibold text-[#2C2C2C]">Prochains lives</h3>
            </div>
            <Link href="/admin/lives" className="flex items-center gap-1.5 text-xs font-medium text-[#C6684F] hover:text-[#b05a42] transition px-3 py-1.5 rounded-lg hover:bg-[#C6684F]/5">
              Gérer <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {upcomingLives.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Calendar size={32} className="text-[#DCCFBF] mx-auto mb-3" />
                <p className="text-sm text-[#A09488]">Aucun live programmé</p>
              </div>
            )}
            {upcomingLives.map(l => {
              const d = new Date(l.scheduled_at)
              const isToday = d.toDateString() === now.toDateString()
              const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString()
              return (
                <div key={l.id} className="flex items-center gap-4 px-6 py-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                    isToday ? 'bg-[#C6684F] text-white' : 'bg-[#FAF6F1] text-[#6B6359]'
                  }`}>
                    <span className="text-xs font-bold leading-none">
                      {d.toLocaleDateString('fr-FR', { day: 'numeric' })}
                    </span>
                    <span className="text-[9px] uppercase leading-none mt-0.5 opacity-70">
                      {d.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#2C2C2C] truncate">{l.title}</p>
                      {isToday && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#C6684F]/10 text-[#C6684F] font-bold uppercase">Aujourd&apos;hui</span>}
                      {isTomorrow && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold uppercase">Demain</span>}
                    </div>
                    <p className="text-[11px] text-[#A09488] mt-0.5">
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
        <div className="bg-white rounded-2xl border border-[#E8E0D8] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#F5F0EB]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6B7FA0] to-[#8B9FBB] flex items-center justify-center">
                <Play size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#2C2C2C]">Replays</h3>
                <p className="text-[11px] text-[#A09488]">{replaysAvailable} disponibles sur {replaysTotal}</p>
              </div>
            </div>
            <Link href="/admin/lives" className="flex items-center gap-1.5 text-xs font-medium text-[#C6684F] hover:text-[#b05a42] transition px-3 py-1.5 rounded-lg hover:bg-[#C6684F]/5">
              Gérer <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {recentLives.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Play size={32} className="text-[#DCCFBF] mx-auto mb-3" />
                <p className="text-sm text-[#A09488]">Aucune session passée</p>
              </div>
            )}
            {recentLives.map(l => (
              <div key={l.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  l.replay_url
                    ? 'bg-gradient-to-br from-[#5B8A6B]/10 to-[#5B8A6B]/5'
                    : 'bg-[#FAF6F1]'
                }`}>
                  {l.replay_url ? (
                    <Play size={14} className="text-[#5B8A6B]" />
                  ) : (
                    <AlertCircle size={14} className="text-[#A09488]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2C2C2C] truncate">{l.title}</p>
                  <p className="text-[11px] text-[#A09488]">
                    {formatDate(l.scheduled_at)} · {l.duration_minutes} min
                  </p>
                </div>
                {l.replay_url ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#5B8A6B]/10 text-[#5B8A6B] font-semibold flex-shrink-0">
                    Disponible
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F2E8DF] text-[#A09488] font-medium flex-shrink-0">
                    Manquant
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Répartition des niveaux ── */}
      <div className="bg-white rounded-2xl border border-[#E8E0D8] shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#F5F0EB]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C6684F] to-[#E8926F] flex items-center justify-center">
              <Star size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[#2C2C2C]">Répartition des niveaux</h3>
              <p className="text-[11px] text-[#A09488]">{stats.members} clientes au total</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['debutante', 'initiee', 'intermediaire', 'avancee'] as const).map(level => {
              const count = clients.filter(c => c.practice_level === level).length
              const emojis: Record<string, string> = { debutante: '🌱', initiee: '🌿', intermediaire: '💎', avancee: '👑' }
              const gradients: Record<string, string> = {
                debutante: 'from-emerald-50 to-green-50 border-emerald-100',
                initiee: 'from-teal-50 to-cyan-50 border-teal-100',
                intermediaire: 'from-violet-50 to-purple-50 border-violet-100',
                avancee: 'from-amber-50 to-yellow-50 border-amber-100',
              }
              const barColors: Record<string, string> = {
                debutante: 'bg-emerald-400',
                initiee: 'bg-teal-400',
                intermediaire: 'bg-violet-400',
                avancee: 'bg-amber-400',
              }
              const pct = stats.members > 0 ? Math.round((count / stats.members) * 100) : 0
              return (
                <div key={level} className={`rounded-2xl bg-gradient-to-br ${gradients[level]} border p-5 text-center`}>
                  <span className="text-3xl">{emojis[level]}</span>
                  <div className="text-3xl font-bold text-[#2C2C2C] mt-2">{count}</div>
                  <div className="text-xs font-semibold text-[#6B6359] mt-0.5">{LEVEL_LABELS[level]}</div>
                  <div className="w-full bg-white/60 rounded-full h-2 mt-3 overflow-hidden">
                    <div className={`${barColors[level]} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] text-[#A09488] font-medium mt-1.5">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
