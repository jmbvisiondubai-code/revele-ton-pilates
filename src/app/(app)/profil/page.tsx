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
  ChevronRight,
  Calendar,
  MapPin,
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
import type { Profile, UserBadge } from '@/types/database'

type Tab = 'profil' | 'parcours' | 'objectifs' | 'badges'

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
  const [badges, setBadges] = useState<UserBadge[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      if (!isSupabaseConfigured()) {
        if (!profile) setProfile(DEMO_PROFILE)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      if (!profile) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (data) setProfile(data as Profile)
      }

      // Load badges
      const { data: badgeData } = await supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })

      if (badgeData) setBadges(badgeData as UserBadge[])
    }
    loadData()
  }, [supabase, profile, setProfile])

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
            <div className="grid grid-cols-2 gap-3">
              <Card padding="sm" className="text-center">
                <p className="text-3xl font-bold text-text">
                  {profile.total_sessions}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  sessions totales
                </p>
              </Card>
              <Card padding="sm" className="text-center">
                <p className="text-3xl font-bold text-text">
                  {formatDuration(profile.total_practice_minutes)}
                </p>
                <p className="text-xs text-text-muted mt-1">de pratique</p>
              </Card>
              <Card padding="sm" className="text-center">
                <p className="text-3xl font-bold text-text">
                  {profile.current_streak}
                </p>
                <p className="text-xs text-text-muted mt-1">série actuelle</p>
              </Card>
              <Card padding="sm" className="text-center">
                <p className="text-3xl font-bold text-text">
                  {profile.longest_streak}
                </p>
                <p className="text-xs text-text-muted mt-1">meilleure série</p>
              </Card>
            </div>

            <Card>
              <p className="text-sm text-text-secondary text-center py-4">
                Le graphique d&apos;évolution arrive bientôt...
              </p>
            </Card>
          </div>
        )}

        {activeTab === 'objectifs' && (
          <div className="space-y-3">
            {profile.goals.map((goal) => (
              <Card key={goal}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-text">
                    {GOAL_LABELS[goal] || goal}
                  </span>
                  <ChevronRight size={16} className="text-text-muted" />
                </div>
                <ProgressBar
                  value={Math.random() * 60 + 10} // placeholder
                  size="sm"
                  color="success"
                  showValue
                />
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'badges' && (
          <div>
            {badges.length === 0 ? (
              <div className="text-center py-12">
                <Award size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-secondary">
                  Tes premiers badges arrivent vite !
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Continue ta pratique pour débloquer des récompenses
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {badges.map((ub) => (
                  <Card
                    key={ub.id}
                    padding="sm"
                    className="text-center"
                  >
                    <div className="text-3xl mb-1">{ub.badge?.icon}</div>
                    <p className="text-xs font-medium text-text">
                      {ub.badge?.name}
                    </p>
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
