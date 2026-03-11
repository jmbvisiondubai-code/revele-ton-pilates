'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Settings,
  LogOut,
  Award,
  Target,
  TrendingUp,
  Calendar,
  MapPin,
  Clock,
  Flame,
  Trophy,
  CheckCircle2,
} from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import {
  Card,
  Avatar,
  Button,
  BadgePill,
  ProgressBar,
} from '@/components/ui'
import { GOAL_LABELS, LEVEL_LABELS, formatDuration } from '@/lib/utils'
import { DEMO_PROFILE } from '@/lib/demo-data'
import type { Profile, UserBadge, Badge } from '@/types/database'

type Tab = 'profil' | 'parcours' | 'objectifs' | 'badges'

type Completion = {
  id: string
  completed_at: string
  duration_watched_minutes: number | null
  courses: { title: string; duration_minutes: number } | null
}

type AllBadge = Badge & { earned: boolean; earned_at?: string }

const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'profil', label: 'Profil', icon: <Settings size={16} /> },
  { value: 'parcours', label: 'Parcours', icon: <TrendingUp size={16} /> },
  { value: 'objectifs', label: 'Objectifs', icon: <Target size={16} /> },
  { value: 'badges', label: 'Badges', icon: <Award size={16} /> },
]

export default function ProfilPage() {
  const router = useRouter()
  const { profile, setProfile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('profil')
  const [badges, setBadges] = useState<AllBadge[]>([])
  const [recentCompletions, setRecentCompletions] = useState<Completion[]>([])
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      if (!isSupabaseConfigured()) {
        if (!profile) setProfile(DEMO_PROFILE)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Reload profile to get fresh stats
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (profileData) setProfile(profileData as Profile)

      // Load recent completions with course titles
      const { data: completions } = await supabase
        .from('course_completions')
        .select('id, completed_at, duration_watched_minutes, courses(title, duration_minutes)')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(10)
      if (completions) setRecentCompletions(completions as Completion[])

      // Sessions this week
      const startOfWeek = new Date()
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('course_completions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('completed_at', startOfWeek.toISOString())
      setSessionsThisWeek(count ?? 0)

      // All badges (earned + locked)
      const { data: allBadges } = await supabase.from('badges').select('*')
      const { data: userBadges } = await supabase
        .from('user_badges').select('badge_id, earned_at').eq('user_id', user.id)

      if (allBadges) {
        const enriched: AllBadge[] = allBadges.map(b => {
          const ub = userBadges?.find(ub => ub.badge_id === b.id)
          return { ...b, earned: !!ub, earned_at: ub?.earned_at }
        })
        setBadges(enriched.sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0)))
      }
    }
    loadData()
  }, [supabase, setProfile])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse-soft text-text-secondary">
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">
      {/* Profile header */}
      <div className="text-center mb-6">
        <Avatar
          src={profile.avatar_url}
          fallback={profile.first_name}
          size="xl"
        />
        <h1 className="font-[family-name:var(--font-heading)] text-2xl text-text mt-3">
          {profile.first_name}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          {profile.city && (
            <span className="text-sm text-text-secondary flex items-center gap-1">
              <MapPin size={12} />
              {profile.city}
            </span>
          )}
          <BadgePill variant="accent">
            {LEVEL_LABELS[profile.practice_level || ''] || 'Niveau'}
          </BadgePill>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-bg-elevated rounded-[var(--radius-lg)] p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2.5
              rounded-[var(--radius-md)] text-xs font-medium
              transition-all duration-200 cursor-pointer
              ${
                activeTab === tab.value
                  ? 'bg-bg-card text-text shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'profil' && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-medium text-sm text-text-secondary mb-3">
                Mes objectifs
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.goals.map((goal) => (
                  <BadgePill key={goal} variant="accent">
                    {GOAL_LABELS[goal] || goal}
                  </BadgePill>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="font-medium text-sm text-text-secondary mb-3">
                Mon rythme
              </h3>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <span className="text-text">
                  {profile.weekly_rhythm}x par semaine
                </span>
              </div>
              {profile.preferred_days.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {profile.preferred_days.map((day) => (
                    <span
                      key={day}
                      className="text-xs bg-bg-elevated px-2 py-1 rounded-[var(--radius-sm)] text-text-secondary capitalize"
                    >
                      {day.slice(0, 3)}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {profile.limitations && (
              <Card>
                <h3 className="font-medium text-sm text-text-secondary mb-2">
                  Limitations signalées
                </h3>
                <p className="text-sm text-text">{profile.limitations}</p>
              </Card>
            )}

            <Button
              variant="ghost"
              fullWidth
              onClick={handleLogout}
              className="text-error"
            >
              <LogOut size={16} />
              Se déconnecter
            </Button>
          </div>
        )}

        {activeTab === 'parcours' && (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Trophy size={16} />, value: profile.total_sessions, label: 'sessions totales' },
                { icon: <Clock size={16} />, value: formatDuration(profile.total_practice_minutes), label: 'de pratique' },
                { icon: <Flame size={16} />, value: profile.current_streak, label: 'série actuelle' },
                { icon: <TrendingUp size={16} />, value: profile.longest_streak, label: 'meilleure série' },
              ].map(({ icon, value, label }) => (
                <Card key={label} padding="sm" className="text-center">
                  <div className="flex justify-center text-primary mb-1">{icon}</div>
                  <p className="text-2xl font-bold text-text">{value}</p>
                  <p className="text-xs text-text-muted mt-0.5">{label}</p>
                </Card>
              ))}
            </div>

            {/* This week progress */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm text-text">Cette semaine</h3>
                <span className="text-sm font-bold text-primary">{sessionsThisWeek}/{profile.weekly_rhythm}</span>
              </div>
              <ProgressBar
                value={Math.min(100, (sessionsThisWeek / profile.weekly_rhythm) * 100)}
                size="md"
                color={sessionsThisWeek >= profile.weekly_rhythm ? 'success' : 'default'}
              />
              <p className="text-xs text-text-muted mt-2">
                {sessionsThisWeek >= profile.weekly_rhythm
                  ? '🎉 Objectif hebdomadaire atteint !'
                  : `${profile.weekly_rhythm - sessionsThisWeek} séance${profile.weekly_rhythm - sessionsThisWeek > 1 ? 's' : ''} restante${profile.weekly_rhythm - sessionsThisWeek > 1 ? 's' : ''} cette semaine`}
              </p>
            </Card>

            {/* Recent sessions */}
            <Card>
              <h3 className="font-medium text-sm text-text mb-3">Dernières séances</h3>
              {recentCompletions.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-3">Aucune séance encore. Lance-toi !</p>
              ) : (
                <div className="space-y-2">
                  {recentCompletions.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-success/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={14} className="text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text truncate">{c.courses?.title ?? 'Cours'}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(c.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {' · '}{c.duration_watched_minutes ?? c.courses?.duration_minutes ?? '?'} min
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'objectifs' && (
          <div className="space-y-3">
            <Card>
              <h3 className="font-medium text-sm text-text-secondary mb-3">Mes objectifs de pratique</h3>
              {[
                { label: 'Première séance', target: 1, current: profile.total_sessions },
                { label: '10 séances', target: 10, current: profile.total_sessions },
                { label: '50 séances', target: 50, current: profile.total_sessions },
                { label: '100 séances', target: 100, current: profile.total_sessions },
              ].map(({ label, target, current }) => (
                <div key={label} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-text">{label}</span>
                    <span className="text-xs text-text-muted">{Math.min(current, target)}/{target}</span>
                  </div>
                  <ProgressBar value={Math.min(100, (current / target) * 100)} size="sm" color={current >= target ? 'success' : 'default'} />
                </div>
              ))}
            </Card>

            <Card>
              <h3 className="font-medium text-sm text-text-secondary mb-3">Mes intentions</h3>
              <div className="flex flex-wrap gap-2">
                {profile.goals.map(goal => (
                  <BadgePill key={goal} variant="accent">{GOAL_LABELS[goal] || goal}</BadgePill>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-3">
                Les cours sont filtrés et recommandés selon tes objectifs.
              </p>
            </Card>
          </div>
        )}

        {activeTab === 'badges' && (
          <div>
            {badges.length === 0 ? (
              <div className="text-center py-12">
                <Award size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-secondary">Tes premiers badges arrivent vite !</p>
                <p className="text-xs text-text-muted mt-1">Continue ta pratique pour débloquer des récompenses</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {badges.map(badge => (
                  <Card key={badge.id} padding="sm" className={`text-center transition-opacity ${badge.earned ? '' : 'opacity-40'}`}>
                    <div className={`text-3xl mb-1 ${badge.earned ? '' : 'grayscale'}`}>{badge.icon}</div>
                    <p className="text-xs font-medium text-text leading-tight">{badge.name}</p>
                    {badge.earned && badge.earned_at && (
                      <p className="text-[10px] text-text-muted mt-1">
                        {new Date(badge.earned_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                    {!badge.earned && (
                      <p className="text-[10px] text-text-muted mt-1">🔒 À débloquer</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
