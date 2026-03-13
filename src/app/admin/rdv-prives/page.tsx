'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PrivateAppointment, MeetingType, AppointmentStatus } from '@/types/database'
import { Plus, Pencil, Trash2, X, MessageCircle, Video, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type ClientOption = { id: string; first_name: string; last_name: string; username: string }

const MEETING_TYPES: { value: MeetingType; label: string; emoji: string }[] = [
  { value: 'zoom', label: 'Zoom', emoji: '📹' },
  { value: 'meet', label: 'Google Meet', emoji: '🎥' },
  { value: 'other', label: 'Autre', emoji: '🔗' },
]

const STATUS_LABELS: Record<AppointmentStatus, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmé', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700' },
  completed: { label: 'Terminé', color: 'bg-gray-100 text-gray-500' },
}

const EMPTY_FORM = {
  client_id: '',
  title: '',
  description: '',
  scheduled_at: '',
  duration_minutes: 60,
  meeting_url: '',
  meeting_type: 'zoom' as MeetingType,
  status: 'pending' as AppointmentStatus,
}

export default function AdminRdvPrivesPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<(PrivateAppointment & { client?: ClientOption })[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PrivateAppointment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const supabase = createClient()

  async function loadAppointments() {
    const { data } = await supabase
      .from('private_appointments')
      .select('*')
      .order('scheduled_at', { ascending: false })
    if (!data) return

    // Fetch client profiles for display
    const clientIds = [...new Set(data.map(a => a.client_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username')
      .in('id', clientIds)

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p as ClientOption]))
    setAppointments(data.map(a => ({ ...a, client: profileMap.get(a.client_id) })))
  }

  async function loadClients() {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username')
      .eq('is_admin', false)
      .order('first_name')
    if (data) setClients(data as ClientOption[])
  }

  useEffect(() => { loadAppointments(); loadClients() }, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSearch('')
    setShowForm(true)
  }

  function openEdit(appt: PrivateAppointment) {
    setEditing(appt)
    const dt = new Date(appt.scheduled_at)
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setForm({
      client_id: appt.client_id,
      title: appt.title,
      description: appt.description ?? '',
      scheduled_at: local,
      duration_minutes: appt.duration_minutes,
      meeting_url: appt.meeting_url ?? '',
      meeting_type: appt.meeting_type,
      status: appt.status,
    })
    setSearch('')
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      client_id: form.client_id,
      created_by: user!.id,
      title: form.title,
      description: form.description || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      meeting_url: form.meeting_url || null,
      meeting_type: form.meeting_type,
      status: form.status,
    }
    if (editing) {
      await supabase.from('private_appointments').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('private_appointments').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadAppointments()
  }

  async function deleteAppt(id: string) {
    if (!confirm('Supprimer ce rendez-vous ?')) return
    await supabase.from('private_appointments').delete().eq('id', id)
    loadAppointments()
  }

  const filteredClients = search.trim()
    ? clients.filter(c =>
        `${c.first_name} ${c.last_name} ${c.username}`.toLowerCase().includes(search.toLowerCase())
      )
    : clients

  const selectedClient = clients.find(c => c.id === form.client_id)

  // Split upcoming vs past
  const now = new Date().toISOString()
  const upcoming = appointments.filter(a => a.scheduled_at >= now && a.status !== 'cancelled')
  const past = appointments.filter(a => a.scheduled_at < now || a.status === 'cancelled')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-[#2C2C2C]">RDV Prives</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#C6684F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#A8543D] transition-colors">
          <Plus size={16} /> Nouveau RDV
        </button>
      </div>

      {/* Upcoming */}
      <div className="space-y-3 mb-8">
        {upcoming.length === 0 && (
          <div className="text-center py-12 text-[#A09488] bg-white rounded-xl border border-[#DCCFBF]">
            Aucun rendez-vous a venir.
          </div>
        )}
        {upcoming.map(appt => (
          <AppointmentCard key={appt.id} appt={appt} onEdit={openEdit} onDelete={deleteAppt} onMessage={(id) => router.push(`/messages?to=${id}`)} />
        ))}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <>
          <h3 className="font-medium text-[#A09488] text-sm mb-3 uppercase tracking-wide">Passes / Annules</h3>
          <div className="space-y-3 opacity-60">
            {past.map(appt => (
              <AppointmentCard key={appt.id} appt={appt} onEdit={openEdit} onDelete={deleteAppt} onMessage={(id) => router.push(`/messages?to=${id}`)} />
            ))}
          </div>
        </>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#DCCFBF]">
              <h3 className="font-serif text-xl text-[#2C2C2C]">{editing ? 'Modifier le RDV' : 'Nouveau RDV prive'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-[#C6684F]" /></button>
            </div>
            <div className="p-6 space-y-4">

              {/* Client selector */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Cliente *</label>
                {selectedClient ? (
                  <div className="flex items-center gap-2 border border-[#C6684F] rounded-lg px-3 py-2">
                    <span className="text-sm flex-1">{selectedClient.first_name} {selectedClient.last_name} <span className="text-[#A09488]">@{selectedClient.username}</span></span>
                    <button type="button" onClick={() => setForm(p => ({ ...p, client_id: '' }))} className="text-[#C6684F]"><X size={14} /></button>
                  </div>
                ) : (
                  <div>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher une cliente..."
                      className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]"
                    />
                    {search.trim() && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-[#DCCFBF] rounded-lg bg-white">
                        {filteredClients.length === 0 && <p className="text-xs text-[#A09488] p-2">Aucun resultat</p>}
                        {filteredClients.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setForm(p => ({ ...p, client_id: c.id })); setSearch('') }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#F2E8DF] transition-colors"
                          >
                            {c.first_name} {c.last_name} <span className="text-[#A09488]">@{c.username}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Titre *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]"
                  placeholder="Cours prive Pilates, Bilan posture..." />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Date et heure *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Duree (min)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
              </div>

              {/* Meeting type */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-2">Type de visio</label>
                <div className="grid grid-cols-3 gap-2">
                  {MEETING_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, meeting_type: t.value }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors text-left ${
                        form.meeting_type === t.value
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

              {/* Meeting URL */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Lien de la visio *</label>
                <input value={form.meeting_url} onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]"
                  placeholder="https://zoom.us/j/... ou https://meet.google.com/..." />
              </div>

              {/* Status (only when editing) */}
              {editing && (
                <div>
                  <label className="block text-sm font-medium text-[#6B6359] mb-2">Statut</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(STATUS_LABELS) as [AppointmentStatus, { label: string; color: string }][]).map(([value, { label }]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, status: value }))}
                        className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          form.status === value
                            ? 'bg-[#C6684F] text-white border-[#C6684F]'
                            : 'border-[#DCCFBF] text-[#6B6359] hover:border-[#C6684F]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F] resize-none"
                  placeholder="Details du rendez-vous..." />
              </div>
            </div>

            <div className="p-6 border-t border-[#DCCFBF] flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-[#DCCFBF] text-[#6B6359] py-2 rounded-lg text-sm font-medium">Annuler</button>
              <button onClick={save} disabled={saving || !form.title || !form.scheduled_at || !form.client_id}
                className="flex-1 bg-[#C6684F] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#A8543D] transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Mettre a jour' : 'Programmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card component ────────────────────────────────────────────────────────────
function AppointmentCard({ appt, onEdit, onDelete, onMessage }: {
  appt: PrivateAppointment & { client?: { id: string; first_name: string; last_name: string; username: string } }
  onEdit: (a: PrivateAppointment) => void
  onDelete: (id: string) => void
  onMessage: (clientId: string) => void
}) {
  const status = STATUS_LABELS[appt.status]
  const meetingType = MEETING_TYPES.find(t => t.value === appt.meeting_type)
  return (
    <div className="bg-white rounded-xl border border-[#DCCFBF] p-4 flex items-center gap-4">
      <div className="w-14 h-14 bg-[#F2E8DF] rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0">
        <div className="text-xs text-[#C6684F] uppercase">{format(new Date(appt.scheduled_at), 'MMM', { locale: fr })}</div>
        <div className="text-lg font-bold text-[#2C2C2C] leading-none">{format(new Date(appt.scheduled_at), 'd')}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-[#2C2C2C]">{appt.title}</h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.color}`}>{status.label}</span>
          <span className="text-[10px] bg-[#F2E8DF] text-[#C6684F] px-1.5 py-0.5 rounded font-medium">
            {meetingType?.emoji} {meetingType?.label}
          </span>
        </div>
        <p className="text-sm text-[#C6684F]">
          {format(new Date(appt.scheduled_at), 'EEEE d MMMM à HH:mm', { locale: fr })} · {appt.duration_minutes} min
        </p>
        {appt.client && (
          <p className="text-xs text-[#6B6359] mt-0.5">
            {appt.client.first_name} {appt.client.last_name} <span className="text-[#A09488]">@{appt.client.username}</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onMessage(appt.client_id)} className="p-2 text-[#6B6359] hover:text-[#C6684F]" title="Envoyer un message">
          <MessageCircle size={16} />
        </button>
        {appt.meeting_url && (
          <a href={appt.meeting_url} target="_blank" rel="noopener noreferrer" className="p-2 text-[#6B6359] hover:text-[#C6684F]" title="Ouvrir le lien">
            <ExternalLink size={16} />
          </a>
        )}
        <button onClick={() => onEdit(appt)} className="p-2 text-[#C6684F] hover:text-[#2C2C2C]"><Pencil size={16} /></button>
        <button onClick={() => onDelete(appt.id)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
      </div>
    </div>
  )
}
