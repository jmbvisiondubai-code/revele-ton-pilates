'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Course, CourseLevel, CourseFocus } from '@/types/database'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Check } from 'lucide-react'

const LEVELS: { value: CourseLevel; label: string }[] = [
  { value: 'debutante', label: 'Débutante' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'avancee', label: 'Avancée' },
  { value: 'tous_niveaux', label: 'Tous niveaux' },
]

const FOCUSES: { value: CourseFocus; label: string }[] = [
  { value: 'posture', label: 'Posture' },
  { value: 'renforcement', label: 'Renforcement' },
  { value: 'souplesse', label: 'Souplesse' },
  { value: 'relaxation', label: 'Relaxation' },
  { value: 'cardio', label: 'Cardio' },
]

const EMPTY_FORM = {
  title: '', description: '', uscreen_url: '', thumbnail_url: '',
  duration_minutes: 30, level: 'tous_niveaux' as CourseLevel,
  focus: [] as CourseFocus[], marjorie_notes: '', benefits: '',
  is_published: false,
}

export default function AdminCoursPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const supabase = createClient()

  async function loadCourses() {
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    if (data) setCourses(data as Course[])
  }

  useEffect(() => { loadCourses() }, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(course: Course) {
    setEditing(course)
    setForm({
      title: course.title,
      description: course.description ?? '',
      uscreen_url: course.uscreen_url,
      thumbnail_url: course.thumbnail_url ?? '',
      duration_minutes: course.duration_minutes,
      level: course.level,
      focus: course.focus,
      marjorie_notes: course.marjorie_notes ?? '',
      benefits: course.benefits.join(', '),
      is_published: course.is_published,
    })
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    const payload = {
      title: form.title,
      description: form.description || null,
      uscreen_url: form.uscreen_url,
      thumbnail_url: form.thumbnail_url || null,
      duration_minutes: form.duration_minutes,
      level: form.level,
      focus: form.focus,
      marjorie_notes: form.marjorie_notes || null,
      benefits: form.benefits.split(',').map(b => b.trim()).filter(Boolean),
      is_published: form.is_published,
    }

    if (editing) {
      await supabase.from('courses').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('courses').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    loadCourses()
  }

  async function togglePublish(course: Course) {
    await supabase.from('courses').update({ is_published: !course.is_published }).eq('id', course.id)
    loadCourses()
  }

  async function deleteCourse(id: string) {
    if (!confirm('Supprimer ce cours ?')) return
    setDeleting(id)
    await supabase.from('courses').delete().eq('id', id)
    setDeleting(null)
    loadCourses()
  }

  function toggleFocus(f: CourseFocus) {
    setForm(prev => ({
      ...prev,
      focus: prev.focus.includes(f) ? prev.focus.filter(x => x !== f) : [...prev.focus, f]
    }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl text-[#2C2C2C]">Cours VOD</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#C6684F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#A8543D] transition-colors">
          <Plus size={16} /> Ajouter un cours
        </button>
      </div>

      {/* Course list */}
      <div className="space-y-3">
        {courses.length === 0 && (
          <div className="text-center py-12 text-[#C6684F] bg-white rounded-xl border border-[#DCCFBF]">
            Aucun cours pour l'instant. Clique sur "Ajouter un cours" pour commencer.
          </div>
        )}
        {courses.map(course => (
          <div key={course.id} className="bg-white rounded-xl border border-[#DCCFBF] p-4 flex items-center gap-4">
            {course.thumbnail_url && (
              <img src={course.thumbnail_url} alt={course.title} className="w-16 h-12 object-cover rounded-lg" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-[#2C2C2C] truncate">{course.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {course.is_published ? 'Publié' : 'Brouillon'}
                </span>
              </div>
              <p className="text-sm text-[#C6684F]">{course.duration_minutes} min · {LEVELS.find(l => l.value === course.level)?.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => togglePublish(course)} className="p-2 text-[#C6684F] hover:text-[#2C2C2C] transition-colors" title={course.is_published ? 'Dépublier' : 'Publier'}>
                {course.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => openEdit(course)} className="p-2 text-[#C6684F] hover:text-[#2C2C2C] transition-colors">
                <Pencil size={16} />
              </button>
              <button onClick={() => deleteCourse(course.id)} disabled={deleting === course.id} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#DCCFBF]">
              <h3 className="font-serif text-xl text-[#2C2C2C]">{editing ? 'Modifier le cours' : 'Nouveau cours'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-[#C6684F]" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Titre *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="Pilates Fondamentaux" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">URL uscreen *</label>
                <input value={form.uscreen_url} onChange={e => setForm(p => ({ ...p, uscreen_url: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="https://mjpilates.uscreen.tv/..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">URL miniature (image)</label>
                <input value={form.thumbnail_url} onChange={e => setForm(p => ({ ...p, thumbnail_url: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="https://..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#6B6359] mb-1">Durée (min)</label>
                  <input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6B6359] mb-1">Niveau</label>
                  <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value as CourseLevel }))}
                    className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]">
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-2">Focus</label>
                <div className="flex flex-wrap gap-2">
                  {FOCUSES.map(f => (
                    <button key={f.value} type="button" onClick={() => toggleFocus(f.value)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.focus.includes(f.value) ? 'bg-[#C6684F] text-white border-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359]'}`}>
                      {form.focus.includes(f.value) && <Check size={12} />}
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F] resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Note de Marjorie</label>
                <textarea value={form.marjorie_notes} onChange={e => setForm(p => ({ ...p, marjorie_notes: e.target.value }))} rows={2}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F] resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Bénéfices (séparés par des virgules)</label>
                <input value={form.benefits} onChange={e => setForm(p => ({ ...p, benefits: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="Renforce le core, Améliore la posture" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-6 rounded-full transition-colors ${form.is_published ? 'bg-[#C6684F]' : 'bg-gray-200'}`}
                  onClick={() => setForm(p => ({ ...p, is_published: !p.is_published }))}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${form.is_published ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-[#6B6359]">Publier immédiatement</span>
              </label>
            </div>

            <div className="p-6 border-t border-[#DCCFBF] flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-[#DCCFBF] text-[#6B6359] py-2 rounded-lg text-sm font-medium">
                Annuler
              </button>
              <button onClick={save} disabled={saving || !form.title || !form.uscreen_url}
                className="flex-1 bg-[#C6684F] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#A8543D] transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
