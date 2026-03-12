'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X, ExternalLink, GripVertical } from 'lucide-react'
import type { VodCategory } from '@/types/database'

const EMPTY_FORM = { label: '', emoji: '🎯', url: '' }

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
    const { data } = await supabase
      .from('vod_categories')
      .select('*')
      .order('order_index')
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
    setForm({ label: cat.label, emoji: cat.emoji, url: cat.url })
    setShowForm(true)
  }

  async function save() {
    if (!form.label.trim() || !form.url.trim()) return
    setSaving(true)
    if (editing) {
      const { data } = await supabase
        .from('vod_categories')
        .update({ label: form.label.trim(), emoji: form.emoji.trim() || '🎯', url: form.url.trim() })
        .eq('id', editing.id)
        .select()
        .single()
      if (data) setCategories(prev => prev.map(c => c.id === editing.id ? data as VodCategory : c))
    } else {
      const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order_index)) + 1 : 1
      const { data } = await supabase
        .from('vod_categories')
        .insert({ label: form.label.trim(), emoji: form.emoji.trim() || '🎯', url: form.url.trim(), order_index: nextOrder })
        .select()
        .single()
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

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-[#2C2C2C]">Catégories VOD</h1>
          <p className="text-sm text-[#6B6359] mt-1">Ces catégories s'affichent dans l'app et dans les recommandations clientes.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#C6684F] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#b05a42] transition"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#2C2C2C]">{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#6B6359] hover:text-[#2C2C2C]"><X size={18} /></button>
            </div>

            <div className="flex gap-3">
              <div className="w-20">
                <label className="text-xs text-[#6B6359] font-medium mb-1 block">Emoji</label>
                <input
                  type="text"
                  value={form.emoji}
                  onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                  className="w-full text-center text-2xl border border-[#DCCFBF] rounded-lg px-2 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
                  maxLength={2}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#6B6359] font-medium mb-1 block">Titre *</label>
                <input
                  type="text"
                  placeholder="Ex : Full Body"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#6B6359] font-medium mb-1 block">URL Uscreen *</label>
              <input
                type="url"
                placeholder="https://vod.marjoriejamin.com/categories/..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm text-[#6B6359]">
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving || !form.label.trim() || !form.url.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#C6684F] text-white text-sm font-medium hover:bg-[#b05a42] disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={15} /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-[#6B6359]">
          <p>Aucune catégorie. Clique sur "Ajouter" pour commencer.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#DCCFBF] rounded-xl overflow-hidden">
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              className={`flex items-center gap-3 px-4 py-3 ${i < categories.length - 1 ? 'border-b border-[#F2E8DF]' : ''} ${!cat.is_active ? 'opacity-40' : ''}`}
            >
              <GripVertical size={14} className="text-[#DCCFBF] flex-shrink-0 cursor-grab" />
              <span className="text-xl w-7 text-center flex-shrink-0">{cat.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#2C2C2C]">{cat.label}</p>
                <a
                  href={cat.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#C6684F] hover:underline flex items-center gap-0.5 truncate max-w-xs"
                >
                  {cat.url.replace('https://', '')} <ExternalLink size={10} />
                </a>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleActive(cat)}
                  title={cat.is_active ? 'Masquer' : 'Afficher'}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {cat.is_active ? 'Visible' : 'Masqué'}
                </button>
                <button
                  onClick={() => openEdit(cat)}
                  className="p-2 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359] transition"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  disabled={deleting === cat.id}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition"
                >
                  {deleting === cat.id ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
