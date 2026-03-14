'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LiveSession } from '@/types/database'
import type { LiveSessionType } from '@/types/database'
import { Plus, Pencil, Trash2, X, Settings, Save, Users, UserPlus, UserMinus, Check, ChevronRight, Search } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const SESSION_TYPES: { value: LiveSessionType; label: string; emoji: string }[] = [
  { value: 'collectif', label: 'Cours collectif', emoji: '🧘' },
  { value: 'masterclass', label: 'Masterclass', emoji: '🎓' },
  { value: 'faq', label: 'Session FAQ', emoji: '❓' },
  { value: 'atelier', label: 'Atelier', emoji: '🛠️' },
  { value: 'autre', label: 'Autre', emoji: '📌' },
]

const EMPTY_FORM = {
  title: '', description: '', scheduled_at: '', duration_minutes: 60,
  meeting_url: '', max_participants: 20, is_unlimited: false, equipment: '', is_collective: true,
  session_type: 'collectif' as LiveSessionType,
}

export default function AdminLivesPage() {
  const [lives, setLives] = useState<LiveSession[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LiveSession | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Attendance panel
  const [attendanceLive, setAttendanceLive] = useState<LiveSession | null>(null)
  type Registration = { id: string; user_id: string; attended: boolean; first_name: string; last_name: string; username: string; avatar_url: string | null }
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [allClients, setAllClients] = useState<{ id: string; first_name: string; last_name: string; username: string; avatar_url: string | null }[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)

  // App settings
  const [vimeoUrl, setVimeoUrl] = useState('')
  const [vimeoCode, setVimeoCode] = useState('')
  const [zoomUrl, setZoomUrl] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const supabase = createClient()

  async function loadLives() {
    const { data } = await supabase.from('live_sessions').select('*').is('deleted_at', null).order('scheduled_at', { ascending: true })
    if (data) setLives(data as LiveSession[])
  }

  async function loadSettings() {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['vimeo_replay_url', 'vimeo_replay_code', 'collective_zoom_url'])
    if (data) {
      const vimeo = data.find((s: { key: string; value: string | null }) => s.key === 'vimeo_replay_url')
      const code = data.find((s: { key: string; value: string | null }) => s.key === 'vimeo_replay_code')
      const zoom = data.find((s: { key: string; value: string | null }) => s.key === 'collective_zoom_url')
      if (vimeo?.value) setVimeoUrl(vimeo.value)
      if (code?.value) setVimeoCode(code.value)
      if (zoom?.value) setZoomUrl(zoom.value)
    }
  }

  useEffect(() => { loadLives(); loadSettings() }, [])

  async function saveSettings() {
    setSavingSettings(true)
    await supabase.from('app_settings').upsert([
      { key: 'vimeo_replay_url', value: vimeoUrl || null },
      { key: 'vimeo_replay_code', value: vimeoCode || null },
      { key: 'collective_zoom_url', value: zoomUrl || null },
    ], { onConflict: 'key' })
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(live: LiveSession) {
    setEditing(live)
    const dt = new Date(live.scheduled_at)
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setForm({
      title: live.title,
      description: live.description ?? '',
      scheduled_at: local,
      duration_minutes: live.duration_minutes,
      meeting_url: live.meeting_url ?? '',
      max_participants: live.max_participants ?? 20,
      is_unlimited: live.max_participants === null,
      equipment: live.equipment ?? '',
      is_collective: live.is_collective ?? true,
      session_type: live.session_type ?? 'collectif',
    })
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    const payload = {
      title: form.title,
      description: form.description || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      meeting_url: form.meeting_url || null,
      max_participants: form.is_unlimited ? null : form.max_participants,
      equipment: form.equipment || null,
      is_collective: form.session_type === 'collectif',
      session_type: form.session_type,
    }
    if (editing) {
      await supabase.from('live_sessions').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('live_sessions').insert(payload)
      // Notify all subscribed users about new live
      const dateStr = format(new Date(form.scheduled_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broadcast: true,
          title: '🎥 Nouveau live programmé !',
          body: `${form.title} — ${dateStr}`,
          url: '/cours',
          tag: 'new-live',
        }),
      }).catch(() => {})
    }
    setSaving(false)
    setShowForm(false)
    loadLives()
  }

  async function deleteLive(id: string) {
    await fetch('/api/admin/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'live_sessions', ids: [id] }),
    })
    loadLives()
  }

  async function openAttendance(live: LiveSession) {
    setAttendanceLive(live)
    setLoadingAttendance(true)
    setShowAddClient(false)
    setAddSearch('')

    // Fetch registrations with profile info
    const { data: regs } = await supabase
      .from('live_registrations')
      .select('id, user_id, attended, profiles(first_name, last_name, username, avatar_url)')
      .eq('live_session_id', live.id)

    const mapped = (regs ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      attended: r.attended,
      first_name: r.profiles?.first_name ?? '',
      last_name: r.profiles?.last_name ?? '',
      username: r.profiles?.username ?? '',
      avatar_url: r.profiles?.avatar_url ?? null,
    }))
    setRegistrations(mapped)

    // Fetch all non-admin clients for the "add" feature
    const { data: clients } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username, avatar_url')
      .eq('is_admin', false)
      .is('deleted_at', null)
      .order('first_name')
    setAllClients(clients ?? [])
    setLoadingAttendance(false)
  }

  async function toggleAttendance(reg: Registration) {
    const newValue = !reg.attended
    await supabase.from('live_registrations').update({ attended: newValue }).eq('id', reg.id)
    setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, attended: newValue } : r))
  }

  async function addParticipant(userId: string) {
    if (!attendanceLive) return
    // Insert registration with attended = true
    const { data, error } = await supabase
      .from('live_registrations')
      .insert({ user_id: userId, live_session_id: attendanceLive.id, attended: true })
      .select('id, user_id, attended')
      .single()
    if (error || !data) return

    const client = allClients.find(c => c.id === userId)
    setRegistrations(prev => [...prev, {
      id: data.id,
      user_id: data.user_id,
      attended: true,
      first_name: client?.first_name ?? '',
      last_name: client?.last_name ?? '',
      username: client?.username ?? '',
      avatar_url: client?.avatar_url ?? null,
    }])
    setShowAddClient(false)
    setAddSearch('')
  }

  async function removeParticipant(reg: Registration) {
    await supabase.from('live_registrations').delete().eq('id', reg.id)
    setRegistrations(prev => prev.filter(r => r.id !== reg.id))
  }

  const attendedCount = registrations.filter(r => r.attended).length
  const availableClients = allClients.filter(c =>
    !registrations.some(r => r.user_id === c.id) &&
    (!addSearch || `${c.first_name} ${c.last_name} ${c.username}`.toLowerCase().includes(addSearch.toLowerCase()))
  )

  return (
    <div>
      {/* Settings section */}
      <div className="bg-white rounded-xl border border-[#DCCFBF] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} className="text-[#C6684F]" />
          <h2 className="font-medium text-[#2C2C2C]">Liens globaux</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[#6B6359] mb-1">Lien Vimeo — Replays</label>
            <input
              value={vimeoUrl}
              onChange={e => setVimeoUrl(e.target.value)}
              placeholder="https://vimeo.com/showcase/..."
              className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6B6359] mb-1">Code d'accès Vimeo</label>
            <input
              value={vimeoCode}
              onChange={e => setVimeoCode(e.target.value)}
              placeholder="ex: pilates2025"
              className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]"
            />
            <p className="text-xs text-[#A09488] mt-1">Les clientes verront ce code et pourront le copier pour accéder au showcase Vimeo.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6B6359] mb-1">Lien Zoom — Cours collectifs</label>
            <input
              value={zoomUrl}
              onChange={e => setZoomUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]"
            />
          </div>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="flex items-center gap-2 bg-[#C6684F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#A8543D] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {savingSettings ? 'Enregistrement...' : settingsSaved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Lives list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-[#2C2C2C]">Sessions Live</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#C6684F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#A8543D] transition-colors">
          <Plus size={16} /> Programmer un live
        </button>
      </div>

      <div className="space-y-3">
        {lives.length === 0 && (
          <div className="text-center py-12 text-[#C6684F] bg-white rounded-xl border border-[#DCCFBF]">
            Aucune session live programmée.
          </div>
        )}
        {lives.map(live => {
          const isPast = new Date(live.scheduled_at) < new Date()
          return (
            <div key={live.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${live.is_cancelled ? 'opacity-50 border-red-200' : 'border-[#DCCFBF]'} ${isPast ? 'cursor-pointer hover:bg-[#FAF6F1]' : ''} transition-colors`}
              onClick={() => isPast && openAttendance(live)}>
              <div className="w-14 h-14 bg-[#F2E8DF] rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0">
                <div className="text-xs text-[#C6684F] uppercase">{format(new Date(live.scheduled_at), 'MMM', { locale: fr })}</div>
                <div className="text-lg font-bold text-[#2C2C2C] leading-none">{format(new Date(live.scheduled_at), 'd')}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[#2C2C2C]">{live.title}</h3>
                  <span className="text-[10px] bg-[#F2E8DF] text-[#C6684F] px-1.5 py-0.5 rounded font-medium">
                    {SESSION_TYPES.find(t => t.value === live.session_type)?.emoji}{' '}
                    {SESSION_TYPES.find(t => t.value === live.session_type)?.label ?? 'Cours collectif'}
                  </span>
                </div>
                <p className="text-sm text-[#C6684F]">
                  {format(new Date(live.scheduled_at), 'EEEE d MMMM à HH:mm', { locale: fr })} · {live.duration_minutes} min
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  {live.max_participants ? (
                    <span className="text-xs text-[#6B6359]">{live.registered_count}/{live.max_participants} places</span>
                  ) : (
                    <span className="text-xs text-[#A09488]">Places illimitées</span>
                  )}
                  {live.equipment && (
                    <span className="text-xs text-[#6B6359]">· Matériel : {live.equipment}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {isPast && (
                  <button onClick={() => openAttendance(live)} className="p-2 text-[#5B9A6B] hover:text-[#4a8a5a]" title="Suivi des présences">
                    <Users size={16} />
                  </button>
                )}
                <button onClick={() => openEdit(live)} className="p-2 text-[#C6684F] hover:text-[#2C2C2C]"><Pencil size={16} /></button>
                <button onClick={() => deleteLive(live.id)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Attendance panel */}
      {attendanceLive && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30" onClick={() => setAttendanceLive(null)}>
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-[#DCCFBF] px-5 py-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-[#2C2C2C]">{attendanceLive.title}</h2>
                  <p className="text-xs text-[#C6684F]">
                    {format(new Date(attendanceLive.scheduled_at), 'EEEE d MMMM à HH:mm', { locale: fr })}
                  </p>
                </div>
                <button onClick={() => setAttendanceLive(null)} className="p-2 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359]"><X size={18} /></button>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <Users size={14} className="text-[#6B6359]" />
                  <span className="text-[#6B6359]">{registrations.length} inscrite{registrations.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Check size={14} className="text-[#5B9A6B]" />
                  <span className="text-[#5B9A6B] font-medium">{attendedCount} présente{attendedCount > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {loadingAttendance ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Registrations list */}
                {registrations.length === 0 ? (
                  <p className="text-sm text-[#A09488] text-center py-6">Aucune inscription pour ce live.</p>
                ) : (
                  <div className="space-y-2">
                    {registrations.map(reg => (
                      <div key={reg.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${reg.attended ? 'bg-[#5B9A6B]/5 border-[#5B9A6B]/20' : 'bg-white border-[#DCCFBF]'}`}>
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-sm flex-shrink-0">
                          {reg.avatar_url ? (
                            <img src={reg.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (reg.first_name?.[0] ?? '?').toUpperCase()
                          )}
                        </div>
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#2C2C2C] truncate">{reg.first_name} {reg.last_name}</p>
                          <p className="text-xs text-[#A09488]">@{reg.username}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => toggleAttendance(reg)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              reg.attended
                                ? 'bg-[#5B9A6B] text-white hover:bg-[#4a8a5a]'
                                : 'bg-[#F2E8DF] text-[#6B6359] hover:bg-[#DCCFBF]'
                            }`}
                          >
                            {reg.attended ? 'Présente' : 'Absente'}
                          </button>
                          <button
                            onClick={() => removeParticipant(reg)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-[#A09488] hover:text-red-500 transition-colors"
                            title="Retirer"
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add participant */}
                <div className="border-t border-[#DCCFBF] pt-4">
                  {!showAddClient ? (
                    <button
                      onClick={() => setShowAddClient(true)}
                      className="flex items-center gap-2 text-sm font-medium text-[#C6684F] hover:text-[#A8543D] transition-colors"
                    >
                      <UserPlus size={16} /> Ajouter une participante
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#2C2C2C]">Ajouter une participante</p>
                        <button onClick={() => { setShowAddClient(false); setAddSearch('') }} className="text-[#A09488] hover:text-[#6B6359]">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A09488]" />
                        <input
                          type="text"
                          placeholder="Rechercher par nom ou pseudo..."
                          value={addSearch}
                          onChange={e => setAddSearch(e.target.value)}
                          autoFocus
                          className="w-full pl-9 pr-3 py-2 border border-[#DCCFBF] rounded-lg text-sm focus:outline-none focus:border-[#C6684F]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {availableClients.length === 0 ? (
                          <p className="text-xs text-[#A09488] text-center py-3">
                            {addSearch ? 'Aucun résultat' : 'Toutes les clientes sont déjà inscrites'}
                          </p>
                        ) : (
                          availableClients.slice(0, 20).map(client => (
                            <button
                              key={client.id}
                              onClick={() => addParticipant(client.id)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#FAF6F1] transition-colors text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-xs flex-shrink-0">
                                {client.avatar_url ? (
                                  <img src={client.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (client.first_name?.[0] ?? '?').toUpperCase()
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#2C2C2C] truncate">{client.first_name} {client.last_name}</p>
                                <p className="text-xs text-[#A09488]">@{client.username}</p>
                              </div>
                              <UserPlus size={14} className="text-[#5B9A6B] flex-shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#DCCFBF]">
              <h3 className="font-serif text-xl text-[#2C2C2C]">{editing ? 'Modifier' : 'Nouveau live'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-[#C6684F]" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Type de session */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-2">Type de session *</label>
                <div className="grid grid-cols-2 gap-2">
                  {SESSION_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, session_type: t.value }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors text-left ${
                        form.session_type === t.value
                          ? 'bg-[#C6684F] text-white border-[#C6684F]'
                          : 'border-[#DCCFBF] text-[#6B6359] hover:border-[#C6684F]'
                      }`}
                    >
                      <span>{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Titre *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="Pilates Flow — Spécial dos" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Date et heure *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Durée (min)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
              </div>

              {/* Places */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-2">Nombre de places</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, is_unlimited: true }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.is_unlimited ? 'bg-[#C6684F] text-white border-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359] hover:border-[#C6684F]'}`}
                  >
                    Illimité
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, is_unlimited: false }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!form.is_unlimited ? 'bg-[#C6684F] text-white border-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359] hover:border-[#C6684F]'}`}
                  >
                    Limité
                  </button>
                </div>
                {!form.is_unlimited && (
                  <input type="number" value={form.max_participants} onChange={e => setForm(p => ({ ...p, max_participants: parseInt(e.target.value) || 1 }))}
                    min={1} placeholder="Nombre de places"
                    className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
                )}
                {!form.is_unlimited && (
                  <p className="text-xs text-[#A09488] mt-1">Les clientes pourront réserver et annuler leur place.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Matériel nécessaire</label>
                <input value={form.equipment} onChange={e => setForm(p => ({ ...p, equipment: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="Tapis, foam roller, élastique..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Lien Zoom (optionnel — remplace le lien global)</label>
                <input value={form.meeting_url} onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="https://zoom.us/j/... (laisser vide pour lien global)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F] resize-none" />
              </div>
            </div>
            <div className="p-6 border-t border-[#DCCFBF] flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-[#DCCFBF] text-[#6B6359] py-2 rounded-lg text-sm font-medium">Annuler</button>
              <button onClick={save} disabled={saving || !form.title || !form.scheduled_at}
                className="flex-1 bg-[#C6684F] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#A8543D] transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Programmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
