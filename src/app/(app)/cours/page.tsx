'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Monitor, Video, ExternalLink, Radio, Film, X, ChevronRight, Play } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card, Button } from '@/components/ui'
import type { LiveSession, VodCategory } from '@/types/database'
import { COLOR_CLASSES } from '@/app/admin/cours/page'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

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
  const [iosPrompt, setIosPrompt] = useState<string | null>(null)
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
        .eq('is_collective', true)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single()
      if (liveData) setNextLive(liveData as LiveSession)

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
    const isIosPwa = (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isIosPwa) {
      navigator.clipboard.writeText(url).catch(() => {})
      setIosPrompt(url)
      setTimeout(() => setIosPrompt(null), 5000)
    } else {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'lives', label: 'En direct', icon: <Radio size={14} /> },
    { key: 'replays', label: 'Replays', icon: <Film size={14} /> },
    { key: 'vod', label: 'VOD', icon: <Play size={14} /> },
  ]

  return (
    <div className="px-5 pt-6 pb-4 lg:px-8 lg:pt-8 max-w-3xl mx-auto">
      {/* iOS PWA prompt */}
      {iosPrompt && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-[#2C2C2C] text-white rounded-2xl px-4 py-3 shadow-xl flex items-start gap-3">
          <span className="text-xl mt-0.5">📋</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Lien copié !</p>
            <p className="text-xs text-white/70 mt-0.5">Ouvre <strong>Safari</strong> et colle le lien pour accéder au cours.</p>
          </div>
          <button onClick={() => setIosPrompt(null)} className="text-white/50 hover:text-white mt-0.5">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">Tes cours</h1>
        <p className="text-text-secondary mt-1 text-sm">Lives collectifs, VOD Uscreen & replays</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F2E8DF] rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
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
                <span className="text-xs font-semibold text-[#C6684F] bg-[#C6684F]/10 px-2 py-0.5 rounded-full">Prochain cours collectif</span>
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
                {nextLive.max_participants && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#C6684F] text-xs font-medium w-[13px] text-center">👥</span>
                    <span>{nextLive.registered_count}/{nextLive.max_participants} places</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {zoomUrl ? (
                  <Button size="sm" className="flex-1" onClick={() => openExternal(zoomUrl)}>
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

          <div className="rounded-xl bg-[#F2E8DF] p-4 text-sm text-[#6B6359]">
            <p className="font-medium text-[#2C2C2C] mb-1">Cours privés en visio</p>
            <p>Les liens de tes cours individuels te sont envoyés séparément par Marjorie.</p>
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            {vodCategories.map((cat, i) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openExternal(cat.url)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all active:scale-95 ${COLOR_CLASSES[cat.color] ?? COLOR_CLASSES.rose}`}
              >
                <span className="text-2xl flex-shrink-0">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{cat.label}</p>
                </div>
                <ChevronRight size={14} className="flex-shrink-0 opacity-40" />
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
