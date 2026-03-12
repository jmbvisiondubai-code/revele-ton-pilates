'use client'

import { useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card } from '@/components/ui'
import { Users, Clock, Trophy, Star, X, Plus, ExternalLink, ChevronRight } from 'lucide-react'
import { formatDuration, LEVEL_LABELS } from '@/lib/utils'
import type { Course, Recommendation } from '@/types/database'

type ClientSummary = {
  id: string
  first_name: string
  avatar_url: string | null
  practice_level: string | null
  total_sessions: number
  total_practice_minutes: number
  limitations: string | null
  goals: string[]
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
  const [courses, setCourses] = useState<Pick<Course, 'id' | 'title'>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', course_id: '' })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url, practice_level, total_sessions, total_practice_minutes, limitations, goals, created_at')
        .eq('is_admin', false)
        .order('total_sessions', { ascending: false })
      setClients((data as ClientSummary[]) ?? [])

      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title')
        .eq('is_published', true)
        .order('title')
      setCourses(coursesData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function openClient(client: ClientSummary) {
    setLoadingDetail(true)
    setSelected({ ...client, completions: [], lives_attended: 0, recommendations: [] })

    const [{ data: completions }, { data: registrations }, { data: recs }] = await Promise.all([
      supabase
        .from('course_completions')
        .select('completed_at, duration_watched_minutes, courses(title, duration_minutes)')
        .eq('user_id', client.id)
        .order('completed_at', { ascending: false })
        .limit(20),
      supabase
        .from('live_registrations')
        .select('attended')
        .eq('user_id', client.id),
      supabase
        .from('recommendations')
        .select('*, courses(id, title, thumbnail_url, uscreen_url)')
        .eq('user_id', client.id)
        .order('created_at', { ascending: false }),
    ])

    const formattedCompletions = (completions ?? []).map((c: any) => ({
      course_title: c.courses?.title ?? 'Cours',
      completed_at: c.completed_at,
      duration_minutes: c.duration_watched_minutes ?? c.courses?.duration_minutes ?? null,
    }))

    setSelected({
      ...client,
      completions: formattedCompletions,
      lives_attended: (registrations ?? []).filter((r: any) => r.attended).length,
      recommendations: (recs as unknown as Recommendation[]) ?? [],
    })
    setLoadingDetail(false)
  }

  async function addRecommendation() {
    if (!selected || !form.title.trim()) return
    setSaving(true)
    const { data: me } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        user_id: selected.id,
        created_by: me.user?.id,
        title: form.title.trim(),
        message: form.message.trim() || null,
        course_id: form.course_id || null,
      })
      .select('*, courses(id, title, thumbnail_url, uscreen_url)')
      .single()

    if (!error && data) {
      setSelected(prev => prev ? {
        ...prev,
        recommendations: [data as unknown as Recommendation, ...prev.recommendations],
      } : prev)
      setForm({ title: '', message: '', course_id: '' })
    }
    setSaving(false)
  }

  async function deleteRecommendation(recId: string) {
    await supabase.from('recommendations').delete().eq('id', recId)
    setSelected(prev => prev ? {
      ...prev,
      recommendations: prev.recommendations.filter(r => r.id !== recId),
    } : prev)
  }

  if (!isSupabaseConfigured()) {
    return <p className="text-[#6B6359]">Supabase non configuré.</p>
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Users size={20} className="text-[#C6684F]" />
        <h1 className="font-serif text-2xl text-[#2C2C2C]">Suivi des clientes</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <Card><p className="text-center text-[#6B6359] py-6">Aucune cliente pour l'instant.</p></Card>
      ) : (
        <div className="grid gap-3">
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => openClient(client)}
              className="w-full text-left bg-white border border-[#DCCFBF] rounded-xl px-4 py-3 hover:bg-[#FAF6F1] transition flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-sm flex-shrink-0">
                {client.first_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#2C2C2C]">{client.first_name}</p>
                <p className="text-xs text-[#6B6359]">
                  {LEVEL_LABELS[client.practice_level || ''] || 'Niveau non défini'}
                  {' · '}Membre depuis {new Date(client.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
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
                <ChevronRight size={16} className="text-[#DCCFBF]" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-[#DCCFBF] px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold">
                {selected.first_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-[#2C2C2C]">{selected.first_name}</h2>
                <p className="text-xs text-[#6B6359]">{LEVEL_LABELS[selected.practice_level || ''] || '—'}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359]">
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-5 space-y-6">
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

                {/* Limitations */}
                {selected.limitations && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Limitations signalées</p>
                    <p className="text-sm text-amber-800">{selected.limitations}</p>
                  </div>
                )}

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

                  {/* Existing */}
                  {selected.recommendations.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {selected.recommendations.map(rec => (
                        <div key={rec.id} className="bg-[#FAF6F1] border border-[#DCCFBF] rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#2C2C2C]">{rec.title}</p>
                              {rec.message && <p className="text-xs text-[#6B6359] mt-0.5">{rec.message}</p>}
                              {rec.courses && (
                                <div className="flex items-center gap-1 mt-1">
                                  <ExternalLink size={11} className="text-[#C6684F]" />
                                  <span className="text-xs text-[#C6684F]">{rec.courses.title}</span>
                                </div>
                              )}
                              <p className="text-[10px] text-[#6B6359] mt-1">
                                {new Date(rec.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {' · '}{rec.is_read ? 'Lu' : 'Non lu'}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteRecommendation(rec.id)}
                              className="p-1 rounded hover:bg-[#F2E8DF] text-[#6B6359] flex-shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add form */}
                  <div className="bg-white border border-[#DCCFBF] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#6B6359]">Ajouter une recommandation</p>
                    <input
                      type="text"
                      placeholder="Titre *"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
                    />
                    <textarea
                      placeholder="Message personnalisé (optionnel)"
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      rows={3}
                      className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] resize-none"
                    />
                    <select
                      value={form.course_id}
                      onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                      className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] text-[#6B6359]"
                    >
                      <option value="">Lier un cours (optionnel)</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={addRecommendation}
                      disabled={saving || !form.title.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-[#C6684F] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#b05a42] disabled:opacity-50 transition"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><Plus size={15} /> Envoyer la recommandation</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
