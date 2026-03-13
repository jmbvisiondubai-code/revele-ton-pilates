'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Monitor, Video, ExternalLink, Radio, Film, ChevronRight, Play, UserCheck, UserMinus, CalendarPlus, CalendarClock } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, Button } from '@/components/ui'
import { downloadIcs } from '@/lib/download-ics'
import type { LiveSession, LiveSessionType, VodCategory, PrivateAppointment } from '@/types/database'

const SESSION_TYPE_LABELS: Record<LiveSessionType, { label: string; emoji: string }> = {
  collectif: { label: 'Cours collectif', emoji: '🧘' },
  masterclass: { label: 'Masterclass', emoji: '🎓' },
  faq: { label: 'Session FAQ', emoji: '❓' },
  atelier: { label: 'Atelier', emoji: '🛠️' },
  autre: { label: 'Live', emoji: '📌' },
}
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function getApptCalendarUrl(appt: PrivateAppointment) {
  const start = new Date(appt.scheduled_at)
  const end = new Date(start.getTime() + appt.duration_minutes * 60000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const details = [appt.description, appt.meeting_url ? `Lien visio : ${appt.meeting_url}` : ''].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `RDV privé — ${appt.title}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  })
  if (appt.meeting_url) params.set('location', appt.meeting_url)
  return `https://calendar.google.com/calendar/render?${params}`
}

function getCalendarUrl(live: LiveSession, meetingUrl: string | null) {
  const start = new Date(live.scheduled_at)
  const end = new Date(start.getTime() + live.duration_minutes * 60000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const typeLabel = SESSION_TYPE_LABELS[live.session_type]?.label ?? 'Live'
  const details = [live.description, live.equipment ? `Matériel : ${live.equipment}` : '', meetingUrl ? `Lien Zoom : ${meetingUrl}` : ''].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${typeLabel} — ${live.title}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  })
  if (meetingUrl) params.set('location', meetingUrl)
  return `https://calendar.google.com/calendar/render?${params}`
}

type Tab = 'lives' | 'vod' | 'replays'


const DEMO_LIVE: LiveSession = {
  id: 'demo-live',
  title: 'Pilates Flow — Spécial dos',
  description: 'Session collective hebdomadaire avec Marjorie',
  scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  duration_minutes: 45,
  meeting_url: null,
  replay_url: null,
  max_participants: 20,
  is_cancelled: false,
  is_collective: true,
  session_type: 'collectif',
  equipment: 'Tapis, foam roller',
  registered_count: 12,
  created_at: new Date().toISOString(),
}

export default function CoursPage() {
  const [tab, setTab] = useState<Tab>('lives')
  const [nextLive, setNextLive] = useState<LiveSession | null>(null)
  const [vodCategories, setVodCategories] = useState<VodCategory[]>([])
  const [vimeoUrl, setVimeoUrl] = useState<string | null>(null)
  const [vimeoCode, setVimeoCode] = useState<string | null>(null)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState<string | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)
  const [privateAppts, setPrivateAppts] = useState<PrivateAppointment[]>([])
  const { profile } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      if (!isSupabaseConfigured()) {
        setNextLive(DEMO_LIVE)
        setVimeoUrl('https://vimeo.com/showcase/mjpilates')
        setVimeoCode('pilates2025')
        setZoomUrl('https://zoom.us/j/mjpilates')
        return
      }

      const { data: liveData } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('is_cancelled', false)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single()
      if (liveData) {
        setNextLive(liveData as LiveSession)
        // Check if user is registered
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: reg } = await supabase
            .from('live_registrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('live_session_id', liveData.id)
            .maybeSingle()
          setIsRegistered(!!reg)
        }
      }

      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['vimeo_replay_url', 'vimeo_replay_code', 'collective_zoom_url'])
      if (settings) {
        const vimeo = settings.find((s: { key: string; value: string | null }) => s.key === 'vimeo_replay_url')
        const code = settings.find((s: { key: string; value: string | null }) => s.key === 'vimeo_replay_code')
        const zoom = settings.find((s: { key: string; value: string | null }) => s.key === 'collective_zoom_url')
        if (vimeo?.value) setVimeoUrl(vimeo.value)
        if (code?.value) setVimeoCode(code.value)
        if (zoom?.value) setZoomUrl(zoom.value)
      }

      const { data: cats } = await supabase
        .from('vod_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index')
      if (cats && cats.length > 0) setVodCategories(cats as VodCategory[])

      // Load private appointments
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const { data: appts } = await supabase
          .from('private_appointments')
          .select('*')
          .eq('client_id', currentUser.id)
          .in('status', ['pending', 'confirmed'])
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
        if (appts) setPrivateAppts(appts as PrivateAppointment[])
      }
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function copyLink(url: string, key: string) {
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(key)
      setTimeout(() => setLinkCopied(null), 2000)
    })
  }

  function openExternal(url: string) {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function registerForLive() {
    if (!nextLive) return
    setRegError(null)
    // Use auth user id directly for RLS compatibility
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setRegError('Tu dois être connectée pour t\'inscrire.'); return }
    setRegistering(true)
    const { error } = await supabase
      .from('live_registrations')
      .insert({ user_id: user.id, live_session_id: nextLive.id })
    if (error) {
      setRegError(error.message.includes('duplicate') ? 'Tu es déjà inscrite !' : 'Erreur lors de l\'inscription. Réessaie.')
    } else {
      setIsRegistered(true)
      setNextLive(prev => prev ? { ...prev, registered_count: prev.registered_count + 1 } : prev)
    }
    setRegistering(false)
  }

  async function unregisterFromLive() {
    if (!nextLive) return
    setRegError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setRegistering(true)
    const { error } = await supabase
      .from('live_registrations')
      .delete()
      .eq('user_id', user.id)
      .eq('live_session_id', nextLive.id)
    if (error) {
      setRegError('Erreur lors de l\'annulation. Réessaie.')
    } else {
      setIsRegistered(false)
      setNextLive(prev => prev ? { ...prev, registered_count: Math.max(0, prev.registered_count - 1) } : prev)
    }
    setRegistering(false)
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'lives', label: 'En direct', icon: <Radio size={14} /> },
    { key: 'replays', label: 'Replays', icon: <Film size={14} /> },
    { key: 'vod', label: 'VOD', icon: <Play size={14} /> },
  ]

  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 xl:px-12 lg:pt-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 lg:mb-8">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl lg:text-4xl text-text">Tes cours</h1>
        <p className="text-text-secondary mt-1 text-sm lg:text-base">Lives collectifs, VOD Uscreen & replays</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6 lg:max-w-md">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 lg:py-2.5 rounded-lg text-sm lg:text-base font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-[#C6684F] shadow-sm'
                : 'text-[#6B6359] hover:text-[#2C2C2C]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LIVES TAB ── */}
      {tab === 'lives' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {nextLive ? (
            <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-2 mb-3">
                <Radio size={15} className="text-[#C6684F]" />
                <span className="text-xs font-semibold text-[#C6684F] bg-[#C6684F]/10 px-2 py-0.5 rounded-full">
                  {(() => { const t = SESSION_TYPE_LABELS[nextLive.session_type] ?? SESSION_TYPE_LABELS.collectif; return `${t.emoji} ${t.label}`; })()}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-xl text-text leading-snug">
                {nextLive.title}
              </h3>
              {nextLive.description && (
                <p className="text-sm text-text-secondary mt-1">{nextLive.description}</p>
              )}
              <div className="mt-3 space-y-1.5 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-[#C6684F] flex-shrink-0" />
                  <span className="capitalize">
                    {format(new Date(nextLive.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">⏱</span>
                  <span>{nextLive.duration_minutes} min</span>
                </div>
                {nextLive.equipment && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">🧘</span>
                    <span>Matériel : {nextLive.equipment}</span>
                  </div>
                )}
                {nextLive.max_participants ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">👥</span>
                    <span>{nextLive.registered_count}/{nextLive.max_participants} places</span>
                    {nextLive.registered_count >= nextLive.max_participants && !isRegistered && (
                      <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Complet</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">👥</span>
                    <span>Places illimitées · {nextLive.registered_count} inscrite{nextLive.registered_count !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Registration */}
              <div className="mt-4">
                {regError && (
                  <div className="mb-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{regError}</div>
                )}
                {isRegistered ? (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-1 flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-xl px-3 py-2.5 text-sm font-medium min-w-0">
                      <UserCheck size={15} className="flex-shrink-0" />
                      <span className="truncate">{nextLive.max_participants ? 'Place réservée' : 'Présente'}</span>
                    </div>
                    <button
                      onClick={unregisterFromLive}
                      disabled={registering}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 active:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <UserMinus size={14} />
                      Annuler
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    fullWidth
                    onClick={registerForLive}
                    disabled={registering || (nextLive.max_participants !== null && nextLive.registered_count >= nextLive.max_participants)}
                    className="py-3"
                  >
                    <UserCheck size={14} />
                    {nextLive.max_participants !== null && nextLive.registered_count >= nextLive.max_participants
                      ? 'Complet'
                      : nextLive.max_participants
                        ? 'Réserver ma place'
                        : 'Je serai présente'}
                  </Button>
                )}
              </div>

              {/* Add to calendar — only if registered and not demo */}
              {isRegistered && nextLive.id !== 'demo-live' && <div className="flex gap-2 mt-3">
                <a
                  href={getCalendarUrl(nextLive, zoomUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm font-medium text-[#6B6359] hover:border-[#C6684F] hover:text-[#C6684F] active:bg-[#F2E8DF] transition-colors"
                >
                  <CalendarPlus size={14} />
                  Google Agenda
                </a>
                <button
                  onClick={() => downloadIcs(`/api/calendar?id=${nextLive.id}`, 'live.ics')}
                  className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm font-medium text-[#6B6359] hover:border-[#C6684F] hover:text-[#C6684F] active:bg-[#F2E8DF] transition-colors"
                >
                  <CalendarPlus size={14} />
                  Autre agenda
                </button>
              </div>}

              {/* Zoom link */}
              <div className="flex gap-2 mt-3">
                {zoomUrl ? (
                  <Button size="sm" variant={isRegistered ? 'primary' : 'outline'} className="flex-1" onClick={() => openExternal(zoomUrl)}>
                    <Video size={14} />
                    Rejoindre sur Zoom
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled className="flex-1">
                    Lien disponible bientôt
                  </Button>
                )}
                {zoomUrl && (
                  <Button size="sm" variant="ghost" onClick={() => copyLink(zoomUrl, 'zoom')}>
                    <Monitor size={14} />
                    {linkCopied === 'zoom' ? 'Copié !' : 'Ordi'}
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="text-center py-16 text-text-secondary">
              <Radio size={32} className="mx-auto mb-3 text-[#DCCFBF]" />
              <p className="font-medium">Aucun live collectif prévu</p>
              <p className="text-sm text-text-muted mt-1">Le prochain cours apparaîtra ici dès qu'il sera programmé.</p>
            </div>
          )}

          {/* Private appointments */}
          {privateAppts.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-[family-name:var(--font-heading)] text-lg text-text">Tes RDV privés</h3>
              {privateAppts.map(appt => (
                <Card key={appt.id} className="bg-[#7C3AED]/5 border-[#7C3AED]/20">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CalendarClock size={18} className="text-[#7C3AED]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-text">{appt.title}</h4>
                      <p className="text-sm text-text-secondary mt-0.5 capitalize">
                        {format(new Date(appt.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                        &nbsp;&bull;&nbsp;{appt.duration_minutes} min
                      </p>
                      {appt.description && (
                        <p className="text-xs text-text-muted mt-1">{appt.description}</p>
                      )}
                      {appt.meeting_url && (
                        <a
                          href={appt.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                        >
                          <Video size={14} />
                          Rejoindre la visio
                        </a>
                      )}
                      {/* Calendar buttons */}
                      <div className="flex gap-2 mt-3">
                        <a
                          href={getApptCalendarUrl(appt)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border border-[#7C3AED]/20 text-sm font-medium text-[#6B6359] hover:border-[#7C3AED] hover:text-[#7C3AED] active:bg-[#7C3AED]/5 transition-colors"
                        >
                          <CalendarPlus size={14} />
                          Google Agenda
                        </a>
                        <button
                          onClick={() => downloadIcs(`/api/calendar/rdv?id=${appt.id}`, 'rdv.ics')}
                          className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl border border-[#7C3AED]/20 text-sm font-medium text-[#6B6359] hover:border-[#7C3AED] hover:text-[#7C3AED] active:bg-[#7C3AED]/5 transition-colors"
                        >
                          <CalendarPlus size={14} />
                          Autre agenda
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

        </motion.div>
      )}

      {/* ── VOD TAB ── */}
      {tab === 'vod' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm text-text-secondary">+180 cours disponibles sur Uscreen</p>
            </div>
            <button
              onClick={() => openExternal('https://vod.marjoriejamin.com')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#C6684F] bg-[#C6684F]/10 px-3 py-1.5 rounded-lg"
            >
              Bibliothèque complète <ExternalLink size={11} />
            </button>
          </div>

          {/* Category grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {vodCategories.map((cat, i) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openExternal(cat.url)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-white border border-[#EDE5DA] shadow-sm hover:shadow-md hover:border-[#C6684F]/30 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FAF6F1] flex items-center justify-center mb-3 group-hover:bg-[#C6684F]/10 transition-colors">
                  <span className="text-2xl">{cat.emoji}</span>
                </div>
                <p className="text-sm font-semibold text-[#2C2C2C] leading-snug">{cat.label}</p>
                <ChevronRight size={13} className="absolute top-3 right-3 text-[#DCCFBF] group-hover:text-[#C6684F] transition-colors" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── REPLAYS TAB ── */}
      {tab === 'replays' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="text-center py-8">
            <div className="w-16 h-16 bg-[#F2E8DF] rounded-full flex items-center justify-center mx-auto mb-4">
              <Film size={28} className="text-[#C6684F]" />
            </div>
            <h3 className="font-[family-name:var(--font-heading)] text-xl text-text mb-2">
              Replays des lives
            </h3>
            <p className="text-sm text-text-secondary mb-4 max-w-xs mx-auto">
              Retrouve tous les enregistrements de tes sessions live sur Vimeo, disponibles après chaque cours.
            </p>

            {vimeoCode && (
              <div className="mb-6 w-full max-w-xs mx-auto">
                <p className="text-xs text-[#6B6359] mb-2">Code d'accès Vimeo</p>
                <div className="flex items-center gap-2 bg-[#F2E8DF] rounded-xl px-4 py-3">
                  <span className="flex-1 font-mono font-semibold text-[#2C2C2C] tracking-widest text-lg">{vimeoCode}</span>
                  <button
                    type="button"
                    onClick={() => copyLink(vimeoCode, 'vimeo-code')}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#C6684F] hover:text-[#A8543D] transition-colors cursor-pointer"
                  >
                    <Monitor size={13} />
                    {linkCopied === 'vimeo-code' ? 'Copié ✓' : 'Copier'}
                  </button>
                </div>
              </div>
            )}

            {vimeoUrl ? (
              <div className="flex flex-col gap-3 items-center">
                <Button fullWidth onClick={() => openExternal(vimeoUrl)} className="w-full max-w-xs">
                  <Film size={15} />
                  Accéder aux replays
                </Button>
                <button
                  type="button"
                  onClick={() => copyLink(vimeoUrl, 'vimeo')}
                  className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors cursor-pointer"
                >
                  <Monitor size={14} />
                  {linkCopied === 'vimeo' ? 'Lien copié !' : 'Copier le lien pour ordi'}
                </button>
              </div>
            ) : (
              <Button variant="outline" disabled>
                Replays bientôt disponibles
              </Button>
            )}
          </Card>

          <div className="rounded-xl bg-[#F2E8DF] p-4 text-sm text-[#6B6359]">
            <p className="font-medium text-[#2C2C2C] mb-1">Accès depuis un ordinateur</p>
            <p>Pour une meilleure expérience vidéo, tu peux copier le lien et l'ouvrir sur ton ordinateur.</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
