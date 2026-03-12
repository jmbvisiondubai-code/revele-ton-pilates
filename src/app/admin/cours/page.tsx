'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X, ExternalLink, GripVertical } from 'lucide-react'
import type { VodCategory } from '@/types/database'

export const COLOR_OPTIONS = [
  { key: 'rose',   label: 'Rose',    bg: '#fff1f2', border: '#fda4af', text: '#be123c', swatch: '#fda4af' },
  { key: 'pink',   label: 'Fuchsia', bg: '#fdf2f8', border: '#f0abfc', text: '#a21caf', swatch: '#f0abfc' },
  { key: 'red',    label: 'Rouge',   bg: '#fff5f5', border: '#fca5a5', text: '#b91c1c', swatch: '#fca5a5' },
  { key: 'orange', label: 'Orange',  bg: '#fff7ed', border: '#fdba74', text: '#c2410c', swatch: '#fdba74' },
  { key: 'amber',  label: 'Ambre',   bg: '#fffbeb', border: '#fcd34d', text: '#b45309', swatch: '#fcd34d' },
  { key: 'yellow', label: 'Jaune',   bg: '#fefce8', border: '#fde047', text: '#a16207', swatch: '#fde047' },
  { key: 'lime',   label: 'Citron',  bg: '#f7fee7', border: '#bef264', text: '#4d7c0f', swatch: '#bef264' },
  { key: 'green',  label: 'Vert',    bg: '#f0fdf4', border: '#86efac', text: '#15803d', swatch: '#86efac' },
  { key: 'teal',   label: 'Teal',    bg: '#f0fdfa', border: '#5eead4', text: '#0f766e', swatch: '#5eead4' },
  { key: 'sky',    label: 'Ciel',    bg: '#f0f9ff', border: '#7dd3fc', text: '#0369a1', swatch: '#7dd3fc' },
  { key: 'indigo', label: 'Indigo',  bg: '#eef2ff', border: '#a5b4fc', text: '#4338ca', swatch: '#a5b4fc' },
  { key: 'violet', label: 'Violet',  bg: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9', swatch: '#c4b5fd' },
  { key: 'purple', label: 'Pourpre', bg: '#faf5ff', border: '#d8b4fe', text: '#7e22ce', swatch: '#d8b4fe' },
]

export const COLOR_CLASSES: Record<string, string> = {
  rose:   'bg-rose-50 border-rose-200 text-rose-700',
  pink:   'bg-pink-50 border-pink-200 text-pink-700',
  red:    'bg-red-50 border-red-200 text-red-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  amber:  'bg-amber-50 border-amber-200 text-amber-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  lime:   'bg-lime-50 border-lime-200 text-lime-700',
  green:  'bg-green-50 border-green-200 text-green-700',
  teal:   'bg-teal-50 border-teal-200 text-teal-700',
  sky:    'bg-sky-50 border-sky-200 text-sky-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  violet: 'bg-violet-50 border-violet-200 text-violet-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
}

const EMPTY_FORM = { label: '', emoji: '🎯', url: '', color: 'rose' }

export default function AdminCoursPage() {
  const [categories, setCategories] = useState<VodCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<VodCategory | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    const { data } = await supabase.from('vod_categories').select('*').order('order_index')
    setCategories((data as VodCategory[]) ?? [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(cat: VodCategory) {
    setEditing(cat)
    setForm({ label: cat.label, emoji: cat.emoji, url: cat.url, color: cat.color || 'rose' })
    setShowForm(true)
  }

  async function save() {
    if (!form.label.trim() || !form.url.trim()) return
    setSaving(true)
    if (editing) {
      const { data } = await supabase
        .from('vod_categories')
        .update({ label: form.label.trim(), emoji: form.emoji.trim() || '🎯', url: form.url.trim(), color: form.color })
        .eq('id', editing.id).select().single()
      if (data) setCategories(prev => prev.map(c => c.id === editing.id ? data as VodCategory : c))
    } else {
      const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order_index)) + 1 : 1
      const { data } = await supabase
        .from('vod_categories')
        .insert({ label: form.label.trim(), emoji: form.emoji.trim() || '🎯', url: form.url.trim(), color: form.color, order_index: nextOrder })
        .select().single()
      if (data) setCategories(prev => [...prev, data as VodCategory])
    }
    setSaving(false)
    setShowForm(false)
  }

  async function toggleActive(cat: VodCategory) {
    await supabase.from('vod_categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
  }

  async function deleteCategory(id: string) {
    setDeleting(id)
    await supabase.from('vod_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  const selectedColor = COLOR_OPTIONS.find(c => c.key === form.color) ?? COLOR_OPTIONS[0]

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-[#2C2C2C]">Catégories VOD</h1>
          <p className="text-sm text-[#6B6359] mt-1">Ces catégories s'affichent dans l'app et dans les recommandations clientes.</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-[#C6684F] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#b05a42] transition">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#2C2C2C]">{editing ? 'Modifier' : 'Nouvelle catégorie'}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#6B6359]"><X size={18} /></button>
            </div>

            <div className="flex gap-3">
              <div className="w-20">
                <label className="text-xs text-[#6B6359] font-medium mb-1 block">Emoji</label>
                <input type="text" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                  className="w-full text-center text-2xl border border-[#DCCFBF] rounded-lg px-2 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" maxLength={2} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#6B6359] font-medium mb-1 block">Titre *</label>
                <input type="text" placeholder="Ex : Full Body" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#6B6359] font-medium mb-1 block">URL Uscreen *</label>
              <input type="url" placeholder="https://vod.marjoriejamin.com/categories/..." value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
            </div>

            {/* Color picker */}
            <div>
              <label className="text-xs text-[#6B6359] font-medium mb-2 block">Couleur de la tuile</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {COLOR_OPTIONS.map(c => (
                  <button key={c.key} type="button" onClick={() => setForm(f => ({ ...f, color: c.key }))}
                    title={c.label}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c.key ? 'border-[#2C2C2C] scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.swatch }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold"
                style={{ backgroundColor: selectedColor.bg, borderColor: selectedColor.border, color: selectedColor.text }}>
                <span className="text-xl">{form.emoji || '🎯'}</span>
                <span>{form.label || 'Aperçu de la tuile'}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm text-[#6B6359]">Annuler</button>
              <button onClick={save} disabled={saving || !form.label.trim() || !form.url.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#C6684F] text-white text-sm font-medium hover:bg-[#b05a42] disabled:opacity-50 transition flex items-center justify-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={15} /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
      ) : categories.length === 0 ? (
        <p className="text-center py-12 text-[#6B6359]">Aucune catégorie. Clique sur "Ajouter" pour commencer.</p>
      ) : (
        <div className="bg-white border border-[#DCCFBF] rounded-xl overflow-hidden">
          {categories.map((cat, i) => {
            const col = COLOR_OPTIONS.find(c => c.key === cat.color) ?? COLOR_OPTIONS[0]
            return (
              <div key={cat.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < categories.length - 1 ? 'border-b border-[#F2E8DF]' : ''} ${!cat.is_active ? 'opacity-40' : ''}`}>
                <GripVertical size={14} className="text-[#DCCFBF] flex-shrink-0 cursor-grab" />
                {/* Color swatch */}
                <div className="w-4 h-4 rounded-full flex-shrink-0 border" style={{ backgroundColor: col.swatch, borderColor: col.border }} />
                <span className="text-xl w-7 text-center flex-shrink-0">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2C2C2C]">{cat.label}</p>
                  <a href={cat.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#C6684F] hover:underline flex items-center gap-0.5 truncate max-w-xs">
                    {cat.url.replace('https://', '')} <ExternalLink size={10} />
                  </a>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(cat)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {cat.is_active ? 'Visible' : 'Masqué'}
                  </button>
                  <button onClick={() => openEdit(cat)} className="p-2 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359] transition"><Pencil size={14} /></button>
                  <button onClick={() => deleteCategory(cat.id)} disabled={deleting === cat.id}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition">
                    {deleting === cat.id ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
