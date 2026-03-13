'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Camera,
  X,
  Pencil,
  Check,
} from 'lucide-react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import {
  Card,
  Avatar,
  Button,
  BadgePill,
  ProgressBar,
  Input,
} from '@/components/ui'
import { GOAL_LABELS, LEVEL_LABELS, formatDuration } from '@/lib/utils'
import { DEMO_PROFILE } from '@/lib/demo-data'
import { getLevelProgress, BADGE_CATEGORIES } from '@/lib/badges'
import type { Profile, Badge, Goal } from '@/types/database'

const ALL_GOALS: { value: Goal; label: string }[] = Object.entries(GOAL_LABELS).map(([value, label]) => ({ value: value as Goal, label }))
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

async function getCroppedImg(imageSrc: string, croppedAreaPixels: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    croppedAreaPixels.x, croppedAreaPixels.y,
    croppedAreaPixels.width, croppedAreaPixels.height,
    0, 0,
    croppedAreaPixels.width, croppedAreaPixels.height
  )
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas is empty')), 'image/jpeg', 0.9)
  )
}

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [editingInfo, setEditingInfo] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [infoError, setInfoError] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [editingGoals, setEditingGoals] = useState(false)
  const [editGoals, setEditGoals] = useState<Goal[]>([])
  const [savingGoals, setSavingGoals] = useState(false)
  const [editingRhythm, setEditingRhythm] = useState(false)
  const [editRhythm, setEditRhythm] = useState(3)
  const [editDays, setEditDays] = useState<string[]>([])
  const [savingRhythm, setSavingRhythm] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [badgeFilter, setBadgeFilter] = useState<string>('all')
  const supabase = createClient()

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

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
      if (completions) setRecentCompletions(completions as unknown as Completion[])

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
        // Sort: earned first (by date desc), then locked
        setBadges(enriched.sort((a, b) => {
          if (a.earned && !b.earned) return -1
          if (!a.earned && b.earned) return 1
          if (a.earned && b.earned) return new Date(b.earned_at!).getTime() - new Date(a.earned_at!).getTime()
          return 0
        }))
      }

    }
    loadData()
  }, [supabase, setProfile])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels || !profile) return
    setUploadingAvatar(true)
    setAvatarError('')
    setCropSrc(null)
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const filePath = `${user.id}/avatar.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars').upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) {
        setAvatarError(uploadError.message)
      } else {
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
        if (updateError) {
          setAvatarError(updateError.message)
        } else {
          setProfile({ ...profile, avatar_url: avatarUrl })
        }
      }
    } catch {
      setAvatarError('Erreur lors du recadrage')
    }
    setUploadingAvatar(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function startEditingInfo() {
    if (!profile) return
    setEditUsername(profile.username)
    setEditFirstName(profile.first_name)
    setEditLastName(profile.last_name)
    setInfoError('')
    setEditingInfo(true)
  }

  async function handleSaveInfo() {
    if (!profile) return
    setInfoError('')
    const trimmedUsername = editUsername.trim().toLowerCase()
    const trimmedFirst = editFirstName.trim()
    const trimmedLast = editLastName.trim()

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(trimmedUsername)) {
      setInfoError('Nom d\'utilisateur : 3–20 caractères, lettres, chiffres, _ ou -')
      return
    }
    if (!trimmedFirst) { setInfoError('Le prénom est requis'); return }
    if (!trimmedLast) { setInfoError('Le nom est requis'); return }

    setSavingInfo(true)
    try {
      if (trimmedUsername !== profile.username) {
        const { data: existing } = await supabase
          .from('profiles').select('id').eq('username', trimmedUsername).maybeSingle()
        if (existing) { setInfoError('Ce nom d\'utilisateur est déjà pris'); setSavingInfo(false); return }
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('profiles')
        .update({ username: trimmedUsername, first_name: trimmedFirst, last_name: trimmedLast })
        .eq('id', user.id)
      if (error) throw error
      setProfile({ ...profile, username: trimmedUsername, first_name: trimmedFirst, last_name: trimmedLast })
      setEditingInfo(false)
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleSaveGoals() {
    if (!profile) return
    setSavingGoals(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('profiles').update({ goals: editGoals }).eq('id', user.id)
      if (error) throw error
      setProfile({ ...profile, goals: editGoals })
      setEditingGoals(false)
    } catch { /* silent */ } finally { setSavingGoals(false) }
  }

  async function handleSaveRhythm() {
    if (!profile) return
    setSavingRhythm(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('profiles').update({ weekly_rhythm: editRhythm, preferred_days: editDays }).eq('id', user.id)
      if (error) throw error
      setProfile({ ...profile, weekly_rhythm: editRhythm, preferred_days: editDays })
      setEditingRhythm(false)
    } catch { /* silent */ } finally { setSavingRhythm(false) }
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
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-5xl mx-auto">
      {/* Crop modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ height: '100dvh' }}>
          <div className="relative" style={{ height: 'calc(100dvh - 140px)' }}>
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="bg-black px-6 pt-4 pb-6 space-y-3" style={{ height: 140 }}>
            <input
              type="range" min={1} max={3} step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-full accent-white"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setCropSrc(null)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/30 text-white text-sm"
              >
                <X size={16} /> Annuler
              </button>
              <button
                onClick={handleCropConfirm}
                className="flex-1 py-3 rounded-xl bg-white text-black font-semibold text-sm"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Layout desktop 2 colonnes */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
      <div className="lg:col-span-1">
      {/* Profile header */}
      <div className="text-center mb-6">
        <div className="relative inline-block">
          <Avatar
            src={profile.avatar_url}
            fallback={profile.username}
            size="xl"
          />
          <label className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md">
            {uploadingAvatar
              ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              : <Camera size={13} className="text-white" />}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
          </label>
        </div>
        {avatarError && <p className="text-xs text-red-500 mt-2">{avatarError}</p>}
        <h1 className="font-[family-name:var(--font-heading)] text-2xl text-text mt-3">
          @{profile.username}
        </h1>
        {(profile.first_name || profile.last_name) && (
          <p className="text-sm text-text-secondary mt-0.5">
            {profile.first_name} {profile.last_name}
          </p>
        )}
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

      </div>{/* end col-span-1 */}

      {/* Colonne droite desktop — onglets */}
      <div className="lg:col-span-2">
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
            {/* ── Informations personnelles ── */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm text-text-secondary">Mes informations</h3>
                {!editingInfo && (
                  <button onClick={startEditingInfo} className="flex items-center gap-1 text-xs text-primary hover:text-accent transition-colors">
                    <Pencil size={12} /> Modifier
                  </button>
                )}
              </div>
              {editingInfo ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Prénom" type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} />
                    <Input label="Nom" type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} />
                  </div>
                  <div>
                    <Input
                      label="Nom d'utilisateur"
                      type="text"
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    />
                    <p className="text-xs text-text-muted mt-1 ml-1">Visible publiquement</p>
                  </div>
                  {infoError && <p className="text-xs text-error bg-error-light px-3 py-2 rounded-lg">{infoError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditingInfo(false)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-elevated transition-colors">
                      <X size={14} /> Annuler
                    </button>
                    <button onClick={handleSaveInfo} disabled={savingInfo} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50 hover:bg-primary-dark transition-colors">
                      {savingInfo ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> Enregistrer</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Nom d&apos;utilisateur</span>
                    <span className="text-text font-medium">@{profile.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Prénom</span>
                    <span className="text-text">{profile.first_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Nom</span>
                    <span className="text-text">{profile.last_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Niveau</span>
                    <span className="text-text">{LEVEL_LABELS[profile.practice_level || ''] || '—'}</span>
                  </div>
                </div>
              )}
            </Card>

            {/* ── Objectifs ── */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm text-text-secondary">Mes objectifs</h3>
                {!editingGoals && (
                  <button onClick={() => { setEditGoals(profile.goals); setEditingGoals(true) }}
                    className="flex items-center gap-1 text-xs text-primary hover:text-accent transition-colors">
                    <Pencil size={12} /> Modifier
                  </button>
                )}
              </div>
              {editingGoals ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ALL_GOALS.map(({ value, label }) => {
                      const selected = editGoals.includes(value)
                      return (
                        <button key={value} type="button"
                          onClick={() => setEditGoals(prev => selected ? prev.filter(g => g !== value) : [...prev, value])}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selected ? 'bg-primary text-white' : 'bg-bg-elevated text-text-secondary hover:bg-secondary/40'}`}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingGoals(false)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-elevated transition-colors">
                      <X size={14} /> Annuler
                    </button>
                    <button onClick={handleSaveGoals} disabled={savingGoals || editGoals.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50 hover:bg-primary-dark transition-colors">
                      {savingGoals ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> Enregistrer</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.goals.length > 0 ? profile.goals.map((goal) => (
                    <BadgePill key={goal} variant="accent">{GOAL_LABELS[goal] || goal}</BadgePill>
                  )) : <p className="text-sm text-text-muted">Aucun objectif défini</p>}
                </div>
              )}
            </Card>

            {/* ── Rythme ── */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm text-text-secondary">Mon rythme</h3>
                {!editingRhythm && (
                  <button onClick={() => { setEditRhythm(profile.weekly_rhythm); setEditDays(profile.preferred_days); setEditingRhythm(true) }}
                    className="flex items-center gap-1 text-xs text-primary hover:text-accent transition-colors">
                    <Pencil size={12} /> Modifier
                  </button>
                )}
              </div>
              {editingRhythm ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-text-muted mb-2">Séances par semaine</p>
                    <div className="flex gap-2">
                      {[1,2,3,4,5,6,7].map(n => (
                        <button key={n} type="button"
                          onClick={() => setEditRhythm(n)}
                          className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${editRhythm === n ? 'bg-primary text-white' : 'bg-bg-elevated text-text-secondary hover:bg-secondary/40'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-2">Jours préférés (optionnel)</p>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(day => {
                        const selected = editDays.includes(day)
                        return (
                          <button key={day} type="button"
                            onClick={() => setEditDays(prev => selected ? prev.filter(d => d !== day) : [...prev, day])}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${selected ? 'bg-primary text-white' : 'bg-bg-elevated text-text-secondary hover:bg-secondary/40'}`}>
                            {day.slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingRhythm(false)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-bg-elevated transition-colors">
                      <X size={14} /> Annuler
                    </button>
                    <button onClick={handleSaveRhythm} disabled={savingRhythm}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50 hover:bg-primary-dark transition-colors">
                      {savingRhythm ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> Enregistrer</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    <span className="text-text">{profile.weekly_rhythm}x par semaine</span>
                  </div>
                  {profile.preferred_days.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {profile.preferred_days.map((day) => (
                        <span key={day} className="text-xs bg-bg-elevated px-2 py-1 rounded-[var(--radius-sm)] text-text-secondary capitalize">
                          {day.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  )}
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
                color={sessionsThisWeek >= profile.weekly_rhythm ? 'success' : 'primary'}
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
                  <ProgressBar value={Math.min(100, (current / target) * 100)} size="sm" color={current >= target ? 'success' : 'primary'} />
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
          <div className="space-y-4">
            {/* Level progression card */}
            {profile && (() => {
              const earnedCount = badges.filter(b => b.earned).length
              const levelInfo = getLevelProgress(profile.practice_level || 'debutante', earnedCount)
              return (
                <>
                  <Card>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {levelInfo.currentLevel === 'avancee' ? '👑' : levelInfo.currentLevel === 'intermediaire' ? '💎' : '🌱'}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-text">
                            {LEVEL_LABELS[levelInfo.currentLevel] || levelInfo.currentLevel}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {earnedCount} badge{earnedCount > 1 ? 's' : ''} débloqué{earnedCount > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {profile.is_teacher && (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-[#F2E8DF] rounded-full text-xs font-semibold text-[#A8543D]">
                          🎓 Professeur
                        </span>
                      )}
                    </div>
                    {levelInfo.nextLevel && (
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
                          <span>Prochain : {LEVEL_LABELS[levelInfo.nextLevel]}</span>
                          <span>{earnedCount}/{levelInfo.badgesForNext} badges</span>
                        </div>
                        <ProgressBar value={levelInfo.progress} size="sm" color="primary" />
                      </div>
                    )}
                    {!levelInfo.nextLevel && (
                      <p className="text-xs text-success font-medium mt-1">Niveau maximum atteint !</p>
                    )}
                  </Card>

                  {/* Suggestion banner if badges qualify for higher level */}
                  {levelInfo.canLevelUp && (
                    <Card className="border border-primary/20 bg-[#FFF8F5]">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">🎉</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-text">
                            Bravo, tu progresses ! 🎉
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                            Avec {earnedCount} badges débloqués, ta progression correspond au niveau {LEVEL_LABELS[levelInfo.suggestedLevel]}. Contacte Marjorie pour faire évoluer ton niveau.
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              )
            })()}

            {/* Category filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <button
                onClick={() => setBadgeFilter('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  badgeFilter === 'all' ? 'bg-primary text-white' : 'bg-bg-elevated text-text-secondary hover:bg-secondary/40'
                }`}
              >
                Tous ({badges.length})
              </button>
              {BADGE_CATEGORIES.filter(cat => {
                // Only show teacher category if user is teacher or admin
                if (cat.key === 'teacher' && !profile?.is_teacher && !profile?.is_admin) return false
                return badges.some(b => b.category === cat.key)
              }).map(cat => {
                const count = badges.filter(b => b.category === cat.key).length
                const earned = badges.filter(b => b.category === cat.key && b.earned).length
                return (
                  <button
                    key={cat.key}
                    onClick={() => setBadgeFilter(cat.key)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      badgeFilter === cat.key ? 'bg-primary text-white' : 'bg-bg-elevated text-text-secondary hover:bg-secondary/40'
                    }`}
                  >
                    {cat.emoji} {cat.label} ({earned}/{count})
                  </button>
                )
              })}
            </div>

            {/* Badge grid */}
            {badges.length === 0 ? (
              <div className="text-center py-12">
                <Award size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-secondary">Tes premiers badges arrivent vite !</p>
                <p className="text-xs text-text-muted mt-1">Continue ta pratique pour débloquer des récompenses</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {badges
                  .filter(b => badgeFilter === 'all' || b.category === badgeFilter)
                  .map(badge => (
                  <Card key={badge.id} padding="sm" className={`text-center transition-all ${badge.earned ? '' : 'opacity-40'}`}>
                    <div className={`text-3xl mb-1 ${badge.earned ? '' : 'grayscale'}`}>{badge.icon}</div>
                    <p className="text-xs font-medium text-text leading-tight">{badge.name}</p>
                    {badge.description && (
                      <p className="text-[10px] text-text-muted mt-0.5 leading-tight line-clamp-2">{badge.description}</p>
                    )}
                    {badge.earned && badge.earned_at && (
                      <p className="text-[10px] text-success font-medium mt-1">
                        ✓ {new Date(badge.earned_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
      </div>{/* end col-span-2 */}
      </div>{/* end lg:grid */}
    </div>
  )
}
