'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LiveSession } from '@/types/database'
import { Plus, Pencil, Trash2, X, Settings, Save } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const EMPTY_FORM = {
  title: '', description: '', scheduled_at: '', duration_minutes: 60,
  meeting_url: '', max_participants: 20, equipment: '', is_collective: true,
}

export default function AdminLivesPage() {
  const [lives, setLives] = useState<LiveSession[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LiveSession | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // App settings
  const [vimeoUrl, setVimeoUrl] = useState('')
  const [zoomUrl, setZoomUrl] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const supabase = createClient()

  async function loadLives() {
    const { data } = await supabase.from('live_sessions').select('*').order('scheduled_at', { ascending: true })
    if (data) setLives(data as LiveSession[])
  }

  async function loadSettings() {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['vimeo_replay_url', 'collective_zoom_url'])
    if (data) {
      const vimeo = data.find((s: { key: string; value: string | null }) => s.key === 'vimeo_replay_url')
      const zoom = data.find((s: { key: string; value: string | null }) => s.key === 'collective_zoom_url')
      if (vimeo?.value) setVimeoUrl(vimeo.value)
      if (zoom?.value) setZoomUrl(zoom.value)
    }
  }

  useEffect(() => { loadLives(); loadSettings() }, [])

  async function saveSettings() {
    setSavingSettings(true)
    await supabase.from('app_settings').upsert([
      { key: 'vimeo_replay_url', value: vimeoUrl || null },
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
      equipment: live.equipment ?? '',
      is_collective: live.is_collective ?? true,
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
      equipment: form.equipment || null,
      is_collective: form.is_collective,
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
        {lives.map(live => (
          <div key={live.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${live.is_cancelled ? 'opacity-50 border-red-200' : 'border-[#DCCFBF]'}`}>
            <div className="w-14 h-14 bg-[#F2E8DF] rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0">
              <div className="text-xs text-[#C6684F] uppercase">{format(new Date(live.scheduled_at), 'MMM', { locale: fr })}</div>
              <div className="text-lg font-bold text-[#2C2C2C] leading-none">{format(new Date(live.scheduled_at), 'd')}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-[#2C2C2C]">{live.title}</h3>
                {live.is_collective && (
                  <span className="text-[10px] bg-[#F2E8DF] text-[#C6684F] px-1.5 py-0.5 rounded font-medium">Collectif</span>
                )}
              </div>
              <p className="text-sm text-[#C6684F]">
                {format(new Date(live.scheduled_at), 'EEEE d MMMM à HH:mm', { locale: fr })} · {live.duration_minutes} min
              </p>
              {live.equipment && (
                <p className="text-xs text-[#6B6359] mt-0.5">Matériel : {live.equipment}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEdit(live)} className="p-2 text-[#C6684F] hover:text-[#2C2C2C]"><Pencil size={16} /></button>
              <button onClick={() => deleteLive(live.id)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#DCCFBF]">
              <h3 className="font-serif text-xl text-[#2C2C2C]">{editing ? 'Modifier' : 'Nouveau live'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-[#C6684F]" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Type */}
              <div className="flex items-center gap-3 p-3 bg-[#F2E8DF] rounded-xl">
                <input
                  type="checkbox"
                  id="is_collective"
                  checked={form.is_collective}
                  onChange={e => setForm(p => ({ ...p, is_collective: e.target.checked }))}
                  className="w-4 h-4 accent-[#C6684F]"
                />
                <label htmlFor="is_collective" className="text-sm font-medium text-[#2C2C2C] cursor-pointer">
                  Cours collectif (affiché dans l'onglet Lives)
                </label>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#6B6359] mb-1">Durée (min)</label>
                  <input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))}
                    className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6B6359] mb-1">Places max</label>
                  <input type="number" value={form.max_participants} onChange={e => setForm(p => ({ ...p, max_participants: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
                </div>
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
