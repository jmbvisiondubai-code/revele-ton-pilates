'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LiveSession } from '@/types/database'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const EMPTY_FORM = {
  title: '', description: '', scheduled_at: '', duration_minutes: 60,
  meeting_url: '', max_participants: 20,
}

export default function AdminLivesPage() {
  const [lives, setLives] = useState<LiveSession[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LiveSession | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function loadLives() {
    const { data } = await supabase.from('live_sessions').select('*').order('scheduled_at', { ascending: true })
    if (data) setLives(data as LiveSession[])
  }

  useEffect(() => { loadLives() }, [])

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
      max_participants: form.max_participants,
    }
    if (editing) {
      await supabase.from('live_sessions').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('live_sessions').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadLives()
  }

  async function deleteLive(id: string) {
    if (!confirm('Supprimer cette session live ?')) return
    await supabase.from('live_sessions').delete().eq('id', id)
    loadLives()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl text-[#2c2825]">Sessions Live</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#93877e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a6f67] transition-colors">
          <Plus size={16} /> Programmer un live
        </button>
      </div>

      <div className="space-y-3">
        {lives.length === 0 && (
          <div className="text-center py-12 text-[#93877e] bg-white rounded-xl border border-[#e8e0d8]">
            Aucune session live programmée.
          </div>
        )}
        {lives.map(live => (
          <div key={live.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${live.is_cancelled ? 'opacity-50 border-red-200' : 'border-[#e8e0d8]'}`}>
            <div className="w-14 h-14 bg-[#f5f0eb] rounded-xl flex flex-col items-center justify-center text-center">
              <div className="text-xs text-[#93877e] uppercase">{format(new Date(live.scheduled_at), 'MMM', { locale: fr })}</div>
              <div className="text-lg font-bold text-[#2c2825] leading-none">{format(new Date(live.scheduled_at), 'd')}</div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[#2c2825]">{live.title}</h3>
              <p className="text-sm text-[#93877e]">
                {format(new Date(live.scheduled_at), 'EEEE d MMMM à HH:mm', { locale: fr })} · {live.duration_minutes} min · {live.registered_count}/{live.max_participants ?? '∞'} places
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEdit(live)} className="p-2 text-[#93877e] hover:text-[#2c2825]"><Pencil size={16} /></button>
              <button onClick={() => deleteLive(live.id)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#e8e0d8]">
              <h3 className="font-serif text-xl text-[#2c2825]">{editing ? 'Modifier' : 'Nouveau live'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-[#93877e]" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6b5f57] mb-1">Titre *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-[#e8e0d8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#93877e]" placeholder="Pilates Flow — Spécial dos" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b5f57] mb-1">Date et heure *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full border border-[#e8e0d8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#93877e]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#6b5f57] mb-1">Durée (min)</label>
                  <input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))}
                    className="w-full border border-[#e8e0d8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#93877e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b5f57] mb-1">Places max</label>
                  <input type="number" value={form.max_participants} onChange={e => setForm(p => ({ ...p, max_participants: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-[#e8e0d8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#93877e]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b5f57] mb-1">Lien Zoom / Meet</label>
                <input value={form.meeting_url} onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))}
                  className="w-full border border-[#e8e0d8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#93877e]" placeholder="https://zoom.us/j/..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b5f57] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  className="w-full border border-[#e8e0d8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#93877e] resize-none" />
              </div>
            </div>
            <div className="p-6 border-t border-[#e8e0d8] flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-[#e8e0d8] text-[#6b5f57] py-2 rounded-lg text-sm font-medium">Annuler</button>
              <button onClick={save} disabled={saving || !form.title || !form.scheduled_at}
                className="flex-1 bg-[#93877e] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#7a6f67] transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Programmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
