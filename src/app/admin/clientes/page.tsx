'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card } from '@/components/ui'
import { Users, Clock, Trophy, Star, X, Plus, ExternalLink, ChevronRight, Upload, Link as LinkIcon, Calendar, AlertTriangle, MessageCircle, Maximize2, PanelRight, Move, Check } from 'lucide-react'
import { formatDuration, LEVEL_LABELS, formatSubscriptionRemaining } from '@/lib/utils'
import type { Recommendation, VodCategory } from '@/types/database'

type ClientSummary = {
  id: string
  first_name: string
  last_name: string
  username: string
  avatar_url: string | null
  practice_level: string | null
  total_sessions: number
  total_practice_minutes: number
  limitations: string | null
  goals: string[]
  subscription_start: string | null
  created_at: string
}

type ClientDetail = ClientSummary & {
  completions: { course_title: string; completed_at: string; duration_minutes: number | null }[]
  lives_attended: number
  recommendations: Recommendation[]
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [selected, setSelected] = useState<ClientDetail | null>(null)
  const [categories, setCategories] = useState<VodCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const REC_CATEGORIES = [
    { key: 'mouvement', label: 'Mouvement', emoji: '🧘‍♀️' },
    { key: 'nutrition', label: 'Nutrition', emoji: '🥗' },
    { key: 'bien_etre', label: 'Bien-être', emoji: '🌿' },
    { key: 'mindset', label: 'Mindset', emoji: '🧠' },
    { key: 'cours', label: 'Cours', emoji: '🎯' },
    { key: 'autre', label: 'Autre', emoji: '💬' },
  ]
  const [form, setForm] = useState({ title: '', message: '', recCategory: 'cours', vodCategory: '', directUrl: '', thumbnailUrl: '', thumbnailMode: 'none' as 'none' | 'url' | 'upload' })
  const [saving, setSaving] = useState(false)
  const [savingLevel, setSavingLevel] = useState(false)
  const [savingSub, setSavingSub] = useState(false)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [creatingConv, setCreatingConv] = useState(false)
  const [convStatus, setConvStatus] = useState<'none' | 'exists' | 'created'>('none')
  const [clientsWithConv, setClientsWithConv] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'side' | 'full'>('side')
  const [modalSize, setModalSize] = useState({ w: 0, h: 0 })
  const modalResizing = useRef(false)
  const modalStartPos = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    async function load() {
      const [{ data: profiles }, { data: cats }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, username, avatar_url, practice_level, total_sessions, total_practice_minutes, limitations, goals, subscription_start, created_at')
          .eq('is_admin', false)
          .order('total_sessions', { ascending: false }),
        supabase
          .from('vod_categories')
          .select('*')
          .eq('is_active', true)
          .order('order_index'),
      ])
      setClients((profiles as ClientSummary[]) ?? [])
      setCategories((cats as VodCategory[]) ?? [])
      setLoading(false)

      // Batch-check conversations
      try {
        const res = await fetch('/api/admin/check-conversations-batch')
        if (res.ok) {
          const data = await res.json()
          setClientsWithConv(new Set(data.clientIds ?? []))
        }
      } catch { /* silent */ }
    }
    load()
  }, [])

  async function checkConversation(clientId: string) {
    try {
      const res = await fetch('/api/admin/check-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (res.ok) {
        const data = await res.json()
        setConvStatus(data.exists ? 'exists' : 'none')
      }
    } catch { setConvStatus('none') }
  }

  async function createConversation(clientId: string) {
    if (creatingConv) return
    setCreatingConv(true)
    try {
      const res = await fetch('/api/welcome-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: clientId }),
      })
      if (res.ok) {
        setConvStatus('created')
        setClientsWithConv(prev => new Set(prev).add(clientId))
      }
    } catch { /* silent */ }
    setCreatingConv(false)
  }

  async function openClient(client: ClientSummary) {
    setLoadingDetail(true)
    setConvStatus('none')
    setSelected({ ...client, completions: [], lives_attended: 0, recommendations: [] })

    const [{ data: completions }, { data: registrations }, { data: recs }] = await Promise.all([
      supabase
        .from('course_completions')
        .select('completed_at, duration_watched_minutes, courses(title, duration_minutes)')
        .eq('user_id', client.id)
        .order('completed_at', { ascending: false })
        .limit(20),
      supabase.from('live_registrations').select('attended').eq('user_id', client.id),
      supabase.from('recommendations').select('*').eq('user_id', client.id).order('created_at', { ascending: false }),
    ])

    setSelected({
      ...client,
      completions: (completions ?? []).map((c: any) => ({
        course_title: c.courses?.title ?? 'Cours',
        completed_at: c.completed_at,
        duration_minutes: c.duration_watched_minutes ?? c.courses?.duration_minutes ?? null,
      })),
      lives_attended: (registrations ?? []).filter((r: any) => r.attended).length,
      recommendations: (recs as Recommendation[]) ?? [],
    })
    setLoadingDetail(false)
    checkConversation(client.id)
  }

  async function uploadThumbnail(file: File): Promise<string | null> {
    setUploadingThumb(true)
    const ext = file.name.split('.').pop()
    const path = `rec-thumbnails/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('courses').upload(path, file, { upsert: true })
    if (error) { setUploadingThumb(false); return null }
    const { data } = supabase.storage.from('courses').getPublicUrl(path)
    setUploadingThumb(false)
    return data.publicUrl
  }

  async function handleThumbnailFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadThumbnail(file)
    if (url) setForm(f => ({ ...f, thumbnailUrl: url }))
    e.target.value = ''
  }

  async function addRecommendation() {
    if (!selected || !form.title.trim()) return
    setSaving(true)
    const { data: me } = await supabase.auth.getUser()
    const selectedVodCat = categories.find(c => c.url === form.vodCategory)

    const link_url = form.directUrl.trim() || selectedVodCat?.url || null
    const link_label = form.directUrl.trim() ? null : (selectedVodCat?.label || null)
    const link_thumbnail_url = form.thumbnailUrl.trim() || null

    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        user_id: selected.id,
        created_by: me.user?.id,
        title: form.title.trim(),
        message: form.message.trim() || null,
        category: form.recCategory,
        link_url,
        link_label,
        link_thumbnail_url,
      })
      .select('*')
      .single()

    if (!error && data) {
      setSelected(prev => prev ? { ...prev, recommendations: [data as Recommendation, ...prev.recommendations] } : prev)
      setForm({ title: '', message: '', recCategory: 'cours', vodCategory: '', directUrl: '', thumbnailUrl: '', thumbnailMode: 'none' })
    }
    setSaving(false)
  }

  async function deleteRecommendation(recId: string) {
    await supabase.from('recommendations').delete().eq('id', recId)
    setSelected(prev => prev ? { ...prev, recommendations: prev.recommendations.filter(r => r.id !== recId) } : prev)
  }

  async function handleLevelChange(newLevel: string) {
    if (!selected || savingLevel) return
    setSavingLevel(true)
    try {
      const res = await fetch('/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, updates: { practice_level: newLevel } }),
      })
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, practice_level: newLevel } : prev)
        setClients(prev => prev.map(c => c.id === selected.id ? { ...c, practice_level: newLevel } : c))
      }
    } catch { /* silent */ }
    setSavingLevel(false)
  }

  async function handleSubscriptionChange(dateStr: string) {
    if (!selected || savingSub) return
    setSavingSub(true)
    try {
      const res = await fetch('/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, updates: { subscription_start: dateStr || null } }),
      })
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, subscription_start: dateStr || null } : prev)
        setClients(prev => prev.map(c => c.id === selected.id ? { ...c, subscription_start: dateStr || null } : c))
      }
    } catch { /* silent */ }
    setSavingSub(false)
  }

  if (!isSupabaseConfigured()) return <p className="text-[#6B6359]">Supabase non configuré.</p>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Users size={20} className="text-[#C6684F]" />
        <h1 className="font-serif text-2xl text-[#2C2C2C]">Suivi des clientes</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
      ) : clients.length === 0 ? (
        <Card><p className="text-center text-[#6B6359] py-6">Aucune cliente pour l'instant.</p></Card>
      ) : (
        <div className="grid gap-3">
          {clients.map(client => (
            <button key={client.id} onClick={() => openClient(client)}
              className="w-full text-left bg-white border border-[#DCCFBF] rounded-xl px-4 py-3 hover:bg-[#FAF6F1] transition flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-sm flex-shrink-0">
                {client.first_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#2C2C2C]">{client.first_name} {client.last_name}</p>
                <p className="text-xs text-[#A09488]">@{client.username}</p>
                <p className="text-xs text-[#6B6359]">
                  {LEVEL_LABELS[client.practice_level || ''] || 'Niveau non défini'} · Membre depuis {new Date(client.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  {client.subscription_start && (() => {
                    const end = new Date(client.subscription_start); end.setFullYear(end.getFullYear() + 1)
                    const info = formatSubscriptionRemaining(end.toISOString())
                    return <span className={info.urgent ? ' text-amber-600 font-medium' : ''}> · {info.label}</span>
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-center hidden sm:block">
                  <p className="text-lg font-bold text-[#2C2C2C]">{client.total_sessions}</p>
                  <p className="text-[10px] text-[#6B6359]">séances</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-lg font-bold text-[#2C2C2C]">{formatDuration(client.total_practice_minutes)}</p>
                  <p className="text-[10px] text-[#6B6359]">pratique</p>
                </div>
                {clientsWithConv.has(client.id) ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#5B9A6B]/10" title="Conversation active">
                    <MessageCircle size={13} className="text-[#5B9A6B]" />
                    <Check size={11} className="text-[#5B9A6B]" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="flex items-center px-2 py-1 rounded-full bg-[#F2E8DF]" title="Pas de conversation">
                    <MessageCircle size={13} className="text-[#A09488]" />
                  </div>
                )}
                <ChevronRight size={16} className="text-[#DCCFBF]" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className={`fixed inset-0 z-50 flex bg-black/30 ${viewMode === 'full' ? 'items-center justify-center p-4' : 'items-stretch justify-end'}`} onClick={() => { if (!modalResizing.current) setSelected(null) }}>
          <div
            className={`bg-white overflow-y-auto shadow-2xl ${viewMode === 'full' ? 'rounded-2xl relative' : 'w-full max-w-3xl h-full'}`}
            style={viewMode === 'full' ? {
              width: modalSize.w || '85vw',
              height: modalSize.h || '85vh',
              minWidth: 500,
              minHeight: 400,
              maxWidth: '95vw',
              maxHeight: '95vh',
            } : undefined}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`sticky top-0 bg-white border-b border-[#DCCFBF] px-5 py-4 flex items-center gap-3 ${viewMode === 'full' ? 'rounded-t-2xl' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold">
                {selected.first_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-[#2C2C2C]">{selected.first_name} {selected.last_name}</h2>
                <p className="text-xs text-[#A09488]">@{selected.username}</p>
                <p className="text-xs text-[#6B6359]">{LEVEL_LABELS[selected.practice_level || ''] || '—'}</p>
              </div>
              {convStatus === 'none' ? (
                <button onClick={() => createConversation(selected.id)} disabled={creatingConv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C6684F] text-white text-xs font-medium hover:bg-[#b05a42] disabled:opacity-50 transition">
                  {creatingConv ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={13} />}
                  Ouvrir conversation
                </button>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5B9A6B]/10 text-[#5B9A6B] text-xs font-medium">
                  <MessageCircle size={13} /> Conversation {convStatus === 'created' ? 'créée' : 'active'}
                </span>
              )}
              <button onClick={() => setViewMode(v => v === 'side' ? 'full' : 'side')}
                className="p-2 rounded-lg hover:bg-[#F2E8DF] text-[#A09488] hover:text-[#6B6359] transition" title={viewMode === 'side' ? 'Plein écran' : 'Panneau latéral'}>
                {viewMode === 'side' ? <Maximize2 size={16} /> : <PanelRight size={16} />}
              </button>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359]"><X size={18} /></button>
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className={`p-5 ${viewMode === 'full' ? 'grid grid-cols-2 gap-6' : 'space-y-6'}`}>
              {/* Left column in full mode */}
              <div className={viewMode === 'full' ? 'space-y-6' : 'contents'}>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: <Trophy size={15} />, value: selected.total_sessions, label: 'séances' },
                    { icon: <Clock size={15} />, value: formatDuration(selected.total_practice_minutes), label: 'pratique' },
                    { icon: <Star size={15} />, value: selected.lives_attended, label: 'lives' },
                  ].map(({ icon, value, label }) => (
                    <div key={label} className="bg-[#FAF6F1] rounded-xl p-3 text-center">
                      <div className="flex justify-center text-[#C6684F] mb-1">{icon}</div>
                      <p className="font-bold text-[#2C2C2C]">{value}</p>
                      <p className="text-[10px] text-[#6B6359]">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Level selector */}
                <div>
                  <h3 className="font-semibold text-sm text-[#2C2C2C] mb-2">Niveau de pratique</h3>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'debutante', label: 'Débutante', emoji: '🌱' },
                      { value: 'initiee', label: 'Initiée', emoji: '🌿' },
                      { value: 'intermediaire', label: 'Intermédiaire', emoji: '💎' },
                      { value: 'avancee', label: 'Avancée', emoji: '👑' },
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={() => handleLevelChange(opt.value)}
                        disabled={savingLevel || opt.value === (selected.practice_level || 'debutante')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          opt.value === (selected.practice_level || 'debutante')
                            ? 'bg-[#C6684F] text-white'
                            : 'bg-[#FAF6F1] text-[#6B6359] hover:bg-[#F2E8DF] disabled:opacity-50'
                        }`}>
                        <span>{opt.emoji}</span> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subscription */}
                <div>
                  <h3 className="font-semibold text-sm text-[#2C2C2C] mb-2 flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#C6684F]" /> Abonnement (1 an)
                  </h3>
                  <div className="bg-[#FAF6F1] rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#6B6359] whitespace-nowrap">Début :</label>
                      <input
                        type="date"
                        value={selected.subscription_start || ''}
                        onChange={e => handleSubscriptionChange(e.target.value)}
                        disabled={savingSub}
                        className="flex-1 text-sm border border-[#DCCFBF] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#C6684F] bg-white disabled:opacity-50"
                      />
                      {selected.subscription_start && (
                        <button onClick={() => handleSubscriptionChange('')} disabled={savingSub}
                          className="text-[#A09488] hover:text-red-500 transition-colors p-1">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {selected.subscription_start && (() => {
                      const endDate = new Date(selected.subscription_start)
                      endDate.setFullYear(endDate.getFullYear() + 1)
                      const info = formatSubscriptionRemaining(endDate.toISOString())
                      return (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={info.urgent ? 'text-amber-600 font-semibold flex items-center gap-1' : 'text-[#6B6359]'}>
                              {info.urgent && <AlertTriangle size={11} />}
                              {info.label}
                            </span>
                            <span className="text-[#A09488]">
                              Fin : {endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#DCCFBF] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${info.urgent ? 'bg-amber-500' : 'bg-[#C6684F]'}`}
                              style={{ width: `${info.percent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })()}
                    {!selected.subscription_start && (
                      <p className="text-xs text-[#A09488]">Aucune date renseignée</p>
                    )}
                  </div>
                </div>

                {selected.limitations && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Limitations signalées</p>
                    <p className="text-sm text-amber-800">{selected.limitations}</p>
                  </div>
                )}
              </div>
              {/* Right column in full mode */}
              <div className={viewMode === 'full' ? 'space-y-6' : 'contents'}>
                {/* Recent courses */}
                <div>
                  <h3 className="font-semibold text-sm text-[#2C2C2C] mb-3">Derniers cours suivis</h3>
                  {selected.completions.length === 0 ? (
                    <p className="text-sm text-[#6B6359]">Aucun cours suivi pour l'instant.</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.completions.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-[#F2E8DF] last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#2C2C2C] truncate">{c.course_title}</p>
                            <p className="text-xs text-[#6B6359]">
                              {new Date(c.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {c.duration_minutes ? ` · ${c.duration_minutes} min` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="font-semibold text-sm text-[#2C2C2C] mb-3">Recommandations personnalisées</h3>

                  {selected.recommendations.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {selected.recommendations.map(rec => (
                        <div key={rec.id} className="bg-[#FAF6F1] border border-[#DCCFBF] rounded-xl overflow-hidden">
                          {rec.link_thumbnail_url && (
                            <img src={rec.link_thumbnail_url} alt="" className="w-full h-32 object-cover" />
                          )}
                          <div className="p-3 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#2C2C2C]">{rec.title}</p>
                              {rec.message && <p className="text-xs text-[#6B6359] mt-0.5">{rec.message}</p>}
                              {rec.link_url && (
                                <a href={rec.link_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 mt-1 text-xs text-[#C6684F] hover:underline">
                                  <ExternalLink size={11} /> {rec.link_label || rec.link_url}
                                </a>
                              )}
                              <p className="text-[10px] text-[#6B6359] mt-1">
                                {new Date(rec.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {' · '}{rec.is_read ? 'Lu' : 'Non lu'}
                              </p>
                            </div>
                            <button onClick={() => deleteRecommendation(rec.id)} className="p-1 rounded hover:bg-[#F2E8DF] text-[#6B6359] flex-shrink-0">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add form */}
                  <div className="bg-white border border-[#DCCFBF] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#6B6359]">Nouvelle recommandation</p>

                    {/* Category */}
                    <div>
                      <p className="text-xs font-medium text-[#6B6359] mb-1.5">Catégorie</p>
                      <div className="flex flex-wrap gap-1.5">
                        {REC_CATEGORIES.map(c => (
                          <button key={c.key} type="button" onClick={() => setForm(f => ({ ...f, recCategory: c.key }))}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${form.recCategory === c.key ? 'border-[#C6684F] bg-[#C6684F]/10 text-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359]'}`}>
                            {c.emoji} {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input type="text" autoCapitalize="sentences" placeholder="Titre *" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />

                    <textarea autoCapitalize="sentences" placeholder="Message personnalisé (ex : idéal pour ton dos…)" value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      rows={3} className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] resize-none" />

                    {/* Link section */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#6B6359]">Lien (optionnel)</p>
                      <select value={form.vodCategory} onChange={e => setForm(f => ({ ...f, vodCategory: e.target.value, directUrl: '' }))}
                        className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] text-[#6B6359]">
                        <option value="">— Choisir une catégorie VOD</option>
                        {categories.map(c => <option key={c.id} value={c.url}>{c.emoji} {c.label}</option>)}
                      </select>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-[#DCCFBF]" />
                        <span className="text-xs text-[#6B6359]">ou</span>
                        <div className="flex-1 h-px bg-[#DCCFBF]" />
                      </div>
                      <div className="relative">
                        <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6359]" />
                        <input type="url" placeholder="URL directe d'un cours spécifique"
                          value={form.directUrl} onChange={e => setForm(f => ({ ...f, directUrl: e.target.value, vodCategory: '' }))}
                          className="w-full text-sm border border-[#DCCFBF] rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
                      </div>
                    </div>

                    {/* Thumbnail section */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#6B6359]">Vignette (optionnel)</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setForm(f => ({ ...f, thumbnailMode: f.thumbnailMode === 'url' ? 'none' : 'url', thumbnailUrl: '' }))}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs border transition ${form.thumbnailMode === 'url' ? 'border-[#C6684F] bg-[#C6684F]/5 text-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359]'}`}>
                          <LinkIcon size={12} /> URL image
                        </button>
                        <button type="button" onClick={() => { setForm(f => ({ ...f, thumbnailMode: f.thumbnailMode === 'upload' ? 'none' : 'upload', thumbnailUrl: '' })); fileInputRef.current?.click() }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs border transition ${form.thumbnailMode === 'upload' ? 'border-[#C6684F] bg-[#C6684F]/5 text-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359]'}`}>
                          <Upload size={12} /> {uploadingThumb ? 'Upload...' : 'Uploader'}
                        </button>
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailFile} />

                      {form.thumbnailMode === 'url' && (
                        <input type="url" placeholder="https://..." value={form.thumbnailUrl}
                          onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))}
                          className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
                      )}

                      {form.thumbnailUrl && (
                        <div className="relative rounded-xl overflow-hidden">
                          <img src={form.thumbnailUrl} alt="" className="w-full h-32 object-cover" />
                          <button onClick={() => setForm(f => ({ ...f, thumbnailUrl: '', thumbnailMode: 'none' }))}
                            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <button onClick={addRecommendation} disabled={saving || !form.title.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-[#C6684F] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#b05a42] disabled:opacity-50 transition">
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus size={15} /> Envoyer la recommandation</>}
                    </button>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Resize handle — bottom right corner */}
            {viewMode === 'full' && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  modalResizing.current = true
                  const el = e.currentTarget.parentElement
                  if (!el) return
                  modalStartPos.current = { x: e.clientX, y: e.clientY, w: el.offsetWidth, h: el.offsetHeight }
                  document.body.style.cursor = 'nwse-resize'
                  document.body.style.userSelect = 'none'

                  function onMove(ev: MouseEvent) {
                    if (!modalResizing.current) return
                    const dw = ev.clientX - modalStartPos.current.x
                    const dh = ev.clientY - modalStartPos.current.y
                    const newW = Math.max(500, Math.min(window.innerWidth * 0.95, modalStartPos.current.w + dw))
                    const newH = Math.max(400, Math.min(window.innerHeight * 0.95, modalStartPos.current.h + dh))
                    setModalSize({ w: newW, h: newH })
                  }
                  function onUp() {
                    document.body.style.cursor = ''
                    document.body.style.userSelect = ''
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                    // Delay reset so the click event on overlay is still blocked
                    setTimeout(() => { modalResizing.current = false }, 100)
                  }
                  window.addEventListener('mousemove', onMove)
                  window.addEventListener('mouseup', onUp)
                }}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-[#F2E8DF] hover:bg-[#E8DDD4] flex items-center justify-center cursor-nwse-resize transition-colors"
                title="Redimensionner"
              >
                <Move size={14} className="text-[#9B8E82] rotate-45" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
