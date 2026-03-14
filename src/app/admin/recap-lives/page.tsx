'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Users, Calendar, TrendingUp, Crown, ArrowUpDown, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type LiveData = {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  session_type: string
  registrations: { user_id: string; attended: boolean; first_name: string; last_name: string; username: string; avatar_url: string | null }[]
}

type ParticipantStat = {
  user_id: string
  first_name: string
  last_name: string
  username: string
  avatar_url: string | null
  attended: number
  registered: number
  rate: number
}

type ViewMode = 'overview' | 'participants' | 'sessions'
type SortKey = 'attended' | 'registered' | 'rate' | 'name'
type SortDir = 'asc' | 'desc'
type PeriodFilter = 'all' | '30' | '90' | '180'

const SESSION_TYPES: Record<string, { label: string; emoji: string }> = {
  collectif: { label: 'Cours collectif', emoji: '🧘' },
  masterclass: { label: 'Masterclass', emoji: '🎓' },
  faq: { label: 'Session FAQ', emoji: '❓' },
  atelier: { label: 'Atelier', emoji: '🛠️' },
  autre: { label: 'Autre', emoji: '📌' },
}

export default function RecapLivesPage() {
  const [livesData, setLivesData] = useState<LiveData[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('overview')
  const [sortKey, setSortKey] = useState<SortKey>('attended')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      // Fetch all past lives with their registrations
      const { data: lives } = await supabase
        .from('live_sessions')
        .select('id, title, scheduled_at, duration_minutes, session_type')
        .is('deleted_at', null)
        .lt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: false })

      if (!lives || lives.length === 0) { setLoading(false); return }

      // Fetch all registrations with profile info
      const liveIds = lives.map(l => l.id)
      const { data: regs } = await supabase
        .from('live_registrations')
        .select('live_session_id, user_id, attended, profiles(first_name, last_name, username, avatar_url)')
        .in('live_session_id', liveIds)

      const mapped: LiveData[] = lives.map(live => ({
        ...live,
        registrations: (regs ?? [])
          .filter((r: any) => r.live_session_id === live.id)
          .map((r: any) => ({
            user_id: r.user_id,
            attended: r.attended,
            first_name: r.profiles?.first_name ?? '',
            last_name: r.profiles?.last_name ?? '',
            username: r.profiles?.username ?? '',
            avatar_url: r.profiles?.avatar_url ?? null,
          })),
      }))

      setLivesData(mapped)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered lives by period and type
  const filteredLives = useMemo(() => {
    let result = livesData
    if (period !== 'all') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - parseInt(period))
      result = result.filter(l => new Date(l.scheduled_at) >= cutoff)
    }
    if (typeFilter !== 'all') {
      result = result.filter(l => l.session_type === typeFilter)
    }
    return result
  }, [livesData, period, typeFilter])

  // Overview stats
  const stats = useMemo(() => {
    const totalLives = filteredLives.length
    const totalAttendances = filteredLives.reduce((sum, l) => sum + l.registrations.filter(r => r.attended).length, 0)
    const totalRegistrations = filteredLives.reduce((sum, l) => sum + l.registrations.length, 0)
    const avgAttendance = totalLives > 0 ? Math.round(totalAttendances / totalLives * 10) / 10 : 0
    const avgRate = totalRegistrations > 0 ? Math.round((totalAttendances / totalRegistrations) * 100) : 0
    const uniqueParticipants = new Set(filteredLives.flatMap(l => l.registrations.filter(r => r.attended).map(r => r.user_id))).size
    const totalMinutes = filteredLives.reduce((sum, l) => sum + l.duration_minutes, 0)

    // By type
    const byType: Record<string, { count: number; attendances: number }> = {}
    filteredLives.forEach(l => {
      const t = l.session_type || 'collectif'
      if (!byType[t]) byType[t] = { count: 0, attendances: 0 }
      byType[t].count++
      byType[t].attendances += l.registrations.filter(r => r.attended).length
    })

    // Monthly trend (last 6 months)
    const monthlyData: { month: string; lives: number; attendances: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = format(d, 'MMM yyyy', { locale: fr })
      const monthLives = filteredLives.filter(l => l.scheduled_at.startsWith(monthKey))
      monthlyData.push({
        month: monthLabel,
        lives: monthLives.length,
        attendances: monthLives.reduce((sum, l) => sum + l.registrations.filter(r => r.attended).length, 0),
      })
    }

    return { totalLives, totalAttendances, totalRegistrations, avgAttendance, avgRate, uniqueParticipants, totalMinutes, byType, monthlyData }
  }, [filteredLives])

  // Participant rankings
  const participantStats = useMemo(() => {
    const map: Record<string, ParticipantStat> = {}
    filteredLives.forEach(l => {
      l.registrations.forEach(r => {
        if (!map[r.user_id]) {
          map[r.user_id] = {
            user_id: r.user_id,
            first_name: r.first_name,
            last_name: r.last_name,
            username: r.username,
            avatar_url: r.avatar_url,
            attended: 0,
            registered: 0,
            rate: 0,
          }
        }
        map[r.user_id].registered++
        if (r.attended) map[r.user_id].attended++
      })
    })

    const arr = Object.values(map)
    arr.forEach(p => { p.rate = p.registered > 0 ? Math.round((p.attended / p.registered) * 100) : 0 })

    arr.sort((a, b) => {
      let diff = 0
      if (sortKey === 'name') diff = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      else diff = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'desc' ? -diff : diff
    })

    return arr
  }, [filteredLives, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const maxMonthlyAttendances = Math.max(...stats.monthlyData.map(m => m.attendances), 1)

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 size={20} className="text-[#C6684F]" />
        <h1 className="font-serif text-2xl text-[#2C2C2C]">Récapitulatif des Lives</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-sm text-[#6B6359]">
          <Filter size={14} />
          <span>Filtrer :</span>
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value as PeriodFilter)}
          className="text-sm border border-[#DCCFBF] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#C6684F]"
        >
          <option value="all">Toute la période</option>
          <option value="30">30 derniers jours</option>
          <option value="90">3 derniers mois</option>
          <option value="180">6 derniers mois</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="text-sm border border-[#DCCFBF] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#C6684F]"
        >
          <option value="all">Tous les types</option>
          {Object.entries(SESSION_TYPES).map(([key, { label, emoji }]) => (
            <option key={key} value={key}>{emoji} {label}</option>
          ))}
        </select>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6 max-w-md">
        {([
          { key: 'overview', label: 'Vue d\'ensemble' },
          { key: 'participants', label: 'Participantes' },
          { key: 'sessions', label: 'Par session' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              view === t.key ? 'bg-white text-[#C6684F] shadow-sm' : 'text-[#6B6359] hover:text-[#2C2C2C]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filteredLives.length === 0 ? (
        <div className="text-center py-12 text-[#A09488] bg-white rounded-xl border border-[#DCCFBF]">
          Aucun live passé pour cette période.
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {view === 'overview' && (
            <div className="space-y-6">
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Lives donnés', value: stats.totalLives, icon: <Calendar size={16} />, color: 'text-[#C6684F]' },
                  { label: 'Participations', value: stats.totalAttendances, icon: <Users size={16} />, color: 'text-[#5B9A6B]' },
                  { label: 'Moy. par live', value: stats.avgAttendance, icon: <TrendingUp size={16} />, color: 'text-[#7C3AED]' },
                  { label: 'Participantes uniques', value: stats.uniqueParticipants, icon: <Crown size={16} />, color: 'text-amber-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-[#DCCFBF] p-4">
                    <div className={`${s.color} mb-2`}>{s.icon}</div>
                    <p className="text-2xl font-bold text-[#2C2C2C]">{s.value}</p>
                    <p className="text-xs text-[#A09488]">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Monthly chart */}
              <div className="bg-white rounded-xl border border-[#DCCFBF] p-5">
                <h3 className="font-semibold text-sm text-[#2C2C2C] mb-4">Évolution mensuelle</h3>
                <div className="flex items-end gap-3 h-40">
                  {stats.monthlyData.map(m => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center justify-end h-28">
                        {m.attendances > 0 && (
                          <p className="text-xs font-semibold text-[#C6684F] mb-1">{m.attendances}</p>
                        )}
                        <div
                          className="w-full max-w-[40px] bg-gradient-to-t from-[#C6684F] to-[#E8926F] rounded-t-lg transition-all"
                          style={{ height: `${Math.max((m.attendances / maxMonthlyAttendances) * 100, m.attendances > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-[#A09488] capitalize">{m.month}</p>
                        <p className="text-[9px] text-[#DCCFBF]">{m.lives} live{m.lives > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By type */}
              <div className="bg-white rounded-xl border border-[#DCCFBF] p-5">
                <h3 className="font-semibold text-sm text-[#2C2C2C] mb-4">Par type de session</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byType).map(([type, data]) => {
                    const info = SESSION_TYPES[type] || { label: type, emoji: '📌' }
                    const pct = stats.totalLives > 0 ? Math.round((data.count / stats.totalLives) * 100) : 0
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="w-8 text-center text-lg">{info.emoji}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-[#2C2C2C]">{info.label}</p>
                            <p className="text-xs text-[#6B6359]">{data.count} live{data.count > 1 ? 's' : ''} · {data.attendances} présences</p>
                          </div>
                          <div className="h-2 bg-[#F2E8DF] rounded-full overflow-hidden">
                            <div className="h-full bg-[#C6684F] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top 5 */}
              <div className="bg-white rounded-xl border border-[#DCCFBF] p-5">
                <h3 className="font-semibold text-sm text-[#2C2C2C] mb-4 flex items-center gap-2">
                  <Crown size={14} className="text-amber-500" /> Top 5 participantes
                </h3>
                <div className="space-y-2">
                  {participantStats.slice(0, 5).map((p, i) => (
                    <div key={p.user_id} className="flex items-center gap-3 py-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-[#F2E8DF] text-[#6B6359]'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-xs flex-shrink-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (p.first_name?.[0] ?? '?').toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2C2C2C] truncate">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-[#A09488]">@{p.username}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[#C6684F]">{p.attended}</p>
                        <p className="text-[10px] text-[#A09488]">présences</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PARTICIPANTS ── */}
          {view === 'participants' && (
            <div className="bg-white rounded-xl border border-[#DCCFBF] overflow-hidden">
              {/* Sort header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-[#FAF6F1] border-b border-[#DCCFBF] text-xs font-semibold text-[#6B6359]">
                <div className="col-span-5">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-[#2C2C2C]">
                    Participante <ArrowUpDown size={10} />
                  </button>
                </div>
                <div className="col-span-2 text-center">
                  <button onClick={() => toggleSort('attended')} className={`flex items-center gap-1 justify-center hover:text-[#2C2C2C] ${sortKey === 'attended' ? 'text-[#C6684F]' : ''}`}>
                    Présences <ArrowUpDown size={10} />
                  </button>
                </div>
                <div className="col-span-2 text-center">
                  <button onClick={() => toggleSort('registered')} className={`flex items-center gap-1 justify-center hover:text-[#2C2C2C] ${sortKey === 'registered' ? 'text-[#C6684F]' : ''}`}>
                    Inscriptions <ArrowUpDown size={10} />
                  </button>
                </div>
                <div className="col-span-3 text-center">
                  <button onClick={() => toggleSort('rate')} className={`flex items-center gap-1 justify-center hover:text-[#2C2C2C] ${sortKey === 'rate' ? 'text-[#C6684F]' : ''}`}>
                    Taux <ArrowUpDown size={10} />
                  </button>
                </div>
              </div>

              {participantStats.length === 0 ? (
                <p className="text-sm text-[#A09488] text-center py-8">Aucune donnée de participation.</p>
              ) : (
                <div className="divide-y divide-[#F5F0EB]">
                  {participantStats.map((p, i) => (
                    <div key={p.user_id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-[#FAF6F1] transition-colors">
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-xs flex-shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (p.first_name?.[0] ?? '?').toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#2C2C2C] truncate">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-[#A09488] truncate">@{p.username}</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm font-bold text-[#5B9A6B]">{p.attended}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm text-[#6B6359]">{p.registered}</span>
                      </div>
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#F2E8DF] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.rate >= 80 ? 'bg-[#5B9A6B]' : p.rate >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                            style={{ width: `${p.rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[#6B6359] w-8 text-right">{p.rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SESSIONS ── */}
          {view === 'sessions' && (
            <div className="space-y-2">
              {filteredLives.map(live => {
                const attended = live.registrations.filter(r => r.attended)
                const absent = live.registrations.filter(r => !r.attended)
                const isExpanded = expandedSession === live.id
                const typeInfo = SESSION_TYPES[live.session_type] || { label: 'Autre', emoji: '📌' }

                return (
                  <div key={live.id} className="bg-white rounded-xl border border-[#DCCFBF] overflow-hidden">
                    <button
                      onClick={() => setExpandedSession(isExpanded ? null : live.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-[#FAF6F1] transition-colors"
                    >
                      <div className="w-12 h-12 bg-[#F2E8DF] rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <div className="text-[10px] text-[#C6684F] uppercase">{format(new Date(live.scheduled_at), 'MMM', { locale: fr })}</div>
                        <div className="text-base font-bold text-[#2C2C2C] leading-none">{format(new Date(live.scheduled_at), 'd')}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-[#2C2C2C] truncate">{live.title}</h3>
                          <span className="text-[10px] bg-[#F2E8DF] text-[#C6684F] px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            {typeInfo.emoji} {typeInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-[#A09488]">
                          {format(new Date(live.scheduled_at), 'EEEE d MMMM à HH:mm', { locale: fr })} · {live.duration_minutes} min
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-center">
                          <p className="text-lg font-bold text-[#5B9A6B]">{attended.length}</p>
                          <p className="text-[9px] text-[#A09488]">présentes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-[#A09488]">{absent.length}</p>
                          <p className="text-[9px] text-[#A09488]">absentes</p>
                        </div>
                        {isExpanded ? <ChevronDown size={16} className="text-[#A09488]" /> : <ChevronRight size={16} className="text-[#A09488]" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#F2E8DF] px-4 py-3">
                        {live.registrations.length === 0 ? (
                          <p className="text-sm text-[#A09488] text-center py-3">Aucune inscription</p>
                        ) : (
                          <div className="space-y-4">
                            {/* Attended */}
                            {attended.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-[#5B9A6B] uppercase tracking-wider mb-2">Présentes ({attended.length})</p>
                                <div className="flex flex-wrap gap-2">
                                  {attended.map(r => (
                                    <div key={r.user_id} className="flex items-center gap-2 bg-[#5B9A6B]/5 border border-[#5B9A6B]/15 rounded-lg px-2.5 py-1.5">
                                      <div className="w-6 h-6 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[9px] font-semibold text-[#C6684F] flex-shrink-0">
                                        {r.avatar_url ? (
                                          <img src={r.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                          (r.first_name?.[0] ?? '?').toUpperCase()
                                        )}
                                      </div>
                                      <span className="text-xs font-medium text-[#2C2C2C]">{r.first_name} {r.last_name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Absent */}
                            {absent.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-[#A09488] uppercase tracking-wider mb-2">Absentes ({absent.length})</p>
                                <div className="flex flex-wrap gap-2">
                                  {absent.map(r => (
                                    <div key={r.user_id} className="flex items-center gap-2 bg-[#FAF6F1] border border-[#DCCFBF] rounded-lg px-2.5 py-1.5 opacity-60">
                                      <div className="w-6 h-6 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[9px] font-semibold text-[#6B6359] flex-shrink-0">
                                        {r.avatar_url ? (
                                          <img src={r.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                          (r.first_name?.[0] ?? '?').toUpperCase()
                                        )}
                                      </div>
                                      <span className="text-xs text-[#6B6359]">{r.first_name} {r.last_name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
