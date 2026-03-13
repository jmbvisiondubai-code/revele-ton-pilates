'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Video, Calendar, BookOpen, Users, Trophy, Clock, Flame, TrendingUp, Play, ChevronRight, AlertCircle } from 'lucide-react'
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
  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-[#2C2C2C]">Tableau de bord</h2>
        <span className="text-xs text-[#A09488]">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Membres', value: stats.members, icon: Users, href: '/admin/clientes', color: '#C6684F', sub: `${avgSessionsPerClient} séances/moy` },
          { label: 'Cours complétés', value: totalCompletions, icon: Trophy, href: '/admin/clientes', color: '#7a9e7e', sub: formatDuration(totalMinutes) + ' total' },
          { label: 'Sessions Live', value: stats.lives, icon: Calendar, href: '/admin/lives', color: '#9e8a7a', sub: `${upcomingLives.length} à venir` },
          { label: 'Replays dispo', value: replaysAvailable, icon: Play, href: '/admin/lives', color: '#7a8a9e', sub: `sur ${replaysTotal} sessions` },
        ].map(({ label, value, icon: Icon, href, color, sub }) => (
          <Link key={label} href={href} className="bg-white rounded-2xl p-5 border border-[#DCCFBF] hover:shadow-md transition-all hover:border-[#C6684F]/30 group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: color + '15' }}>
                <Icon size={18} style={{ color }} />
              </div>
              <ChevronRight size={14} className="text-[#DCCFBF] group-hover:text-[#C6684F] transition-colors" />
            </div>
            <div className="text-3xl font-bold text-[#2C2C2C]">{value}</div>
            <div className="text-sm font-medium text-[#2C2C2C] mt-0.5">{label}</div>
            <div className="text-[11px] text-[#A09488] mt-0.5">{sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Top clientes ── */}
        <div className="bg-white rounded-2xl border border-[#DCCFBF] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F5F0EB]">
            <h3 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
              <Users size={16} className="text-[#C6684F]" /> Suivi des clientes
            </h3>
            <Link href="/admin/clientes" className="text-xs text-[#C6684F] hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {clients.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#A09488]">Aucune cliente inscrite</div>
            )}
            {clients.map((c, i) => (
              <Link key={c.id} href="/admin/clientes" className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAF6F1] transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C6684F] to-[#E8926F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#2C2C2C] truncate">
                      {c.first_name || c.username}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F2E8DF] text-[#6B6359] flex-shrink-0">
                      {LEVEL_LABELS[c.practice_level || ''] || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-[#A09488] flex items-center gap-1">
                      <Trophy size={10} /> {c.total_sessions} séances
                    </span>
                    <span className="text-[11px] text-[#A09488] flex items-center gap-1">
                      <Clock size={10} /> {formatDuration(c.total_practice_minutes)}
                    </span>
                    {c.current_streak > 0 && (
                      <span className="text-[11px] text-[#C6684F] flex items-center gap-1">
                        <Flame size={10} /> {c.current_streak}j
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-[#DCCFBF] flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Activité récente ── */}
        <div className="bg-white rounded-2xl border border-[#DCCFBF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F5F0EB]">
            <h3 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
              <TrendingUp size={16} className="text-[#7a9e7e]" /> Activité récente
            </h3>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {recentCompletions.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#A09488]">Aucune activité</div>
            )}
            {recentCompletions.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-[#7a9e7e]/10 flex items-center justify-center flex-shrink-0">
                  <Trophy size={14} className="text-[#7a9e7e]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#2C2C2C] truncate">
                    <span className="font-medium">{a.username}</span>{' '}
                    <span className="text-[#6B6359]">a terminé</span>{' '}
                    <span className="font-medium">{a.course_title}</span>
                  </p>
                  <p className="text-[11px] text-[#A09488]">{timeAgo(a.completed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Replays & Lives ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming lives */}
        <div className="bg-white rounded-2xl border border-[#DCCFBF] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F5F0EB]">
            <h3 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
              <Calendar size={16} className="text-[#9e8a7a]" /> Prochains lives
            </h3>
            <Link href="/admin/lives" className="text-xs text-[#C6684F] hover:underline flex items-center gap-1">
              Gérer <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {upcomingLives.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#A09488]">Aucun live programmé</div>
            )}
            {upcomingLives.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-10 h-10 rounded-xl bg-[#9e8a7a]/10 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#9e8a7a] leading-none">
                    {new Date(l.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric' })}
                  </span>
                  <span className="text-[8px] text-[#9e8a7a] uppercase leading-none mt-0.5">
                    {new Date(l.scheduled_at).toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2C2C2C] truncate">{l.title}</p>
                  <p className="text-[11px] text-[#A09488]">
                    {new Date(l.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{l.duration_minutes}min
                    {l.registered_count > 0 && ` · ${l.registered_count} inscrite${l.registered_count > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Replays */}
        <div className="bg-white rounded-2xl border border-[#DCCFBF] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F5F0EB]">
            <h3 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
              <Play size={16} className="text-[#7a8a9e]" /> Replays des sessions
            </h3>
            <Link href="/admin/lives" className="text-xs text-[#C6684F] hover:underline flex items-center gap-1">
              Gérer <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#F5F0EB]">
            {recentLives.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#A09488]">Aucune session passée</div>
            )}
            {recentLives.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  l.replay_url ? 'bg-[#7a9e7e]/10' : 'bg-[#C6684F]/10'
                }`}>
                  {l.replay_url ? (
                    <Play size={14} className="text-[#7a9e7e]" />
                  ) : (
                    <AlertCircle size={14} className="text-[#C6684F]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2C2C2C] truncate">{l.title}</p>
                  <p className="text-[11px] text-[#A09488]">
                    {formatDate(l.scheduled_at)} · {l.duration_minutes}min
                  </p>
                </div>
                {l.replay_url ? (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-[#7a9e7e]/10 text-[#7a9e7e] font-medium flex-shrink-0">
                    Replay dispo
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-[#C6684F]/10 text-[#C6684F] font-medium flex-shrink-0">
                    Pas de replay
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Répartition des niveaux ── */}
      <div className="bg-white rounded-2xl border border-[#DCCFBF] p-5">
        <h3 className="font-semibold text-[#2C2C2C] mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-[#C6684F]" /> Répartition des niveaux
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['debutante', 'initiee', 'intermediaire', 'avancee'] as const).map(level => {
            const count = clients.filter(c => c.practice_level === level).length
            const emojis: Record<string, string> = { debutante: '🌱', initiee: '🌿', intermediaire: '💎', avancee: '👑' }
            const pct = stats.members > 0 ? Math.round((count / stats.members) * 100) : 0
            return (
              <div key={level} className="bg-[#FAF6F1] rounded-xl p-4 text-center">
                <span className="text-2xl">{emojis[level]}</span>
                <div className="text-2xl font-bold text-[#2C2C2C] mt-1">{count}</div>
                <div className="text-xs font-medium text-[#6B6359]">{LEVEL_LABELS[level]}</div>
                <div className="w-full bg-[#DCCFBF]/30 rounded-full h-1.5 mt-2">
                  <div className="bg-[#C6684F] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-[#A09488] mt-1">{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
