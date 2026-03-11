'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Article, ArticleCategory } from '@/types/database'
import { Plus, Pencil, Trash2, Eye, EyeOff, X } from 'lucide-react'

const CATEGORIES: { value: ArticleCategory; label: string }[] = [
  { value: 'pratique', label: 'Pratique' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'bien_etre', label: 'Bien-être' },
  { value: 'recuperation', label: 'Récupération' },
]

const EMPTY_FORM = {
  title: '', content: '', category: 'pratique' as ArticleCategory,
  thumbnail_url: '', reading_time_minutes: 5, marjorie_note: '',
  tags: '', is_published: false,
}

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Article | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function loadArticles() {
    const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false })
    if (data) setArticles(data as Article[])
  }

  useEffect(() => { loadArticles() }, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(article: Article) {
    setEditing(article)
    setForm({
      title: article.title,
      content: article.content,
      category: article.category,
      thumbnail_url: article.thumbnail_url ?? '',
      reading_time_minutes: article.reading_time_minutes ?? 5,
      marjorie_note: article.marjorie_note ?? '',
      tags: article.tags.join(', '),
      is_published: article.is_published,
    })
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    const payload = {
      title: form.title,
      content: form.content,
      category: form.category,
      thumbnail_url: form.thumbnail_url || null,
      reading_time_minutes: form.reading_time_minutes,
      marjorie_note: form.marjorie_note || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      is_published: form.is_published,
    }
    if (editing) {
      await supabase.from('articles').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('articles').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadArticles()
  }

  async function togglePublish(article: Article) {
    await supabase.from('articles').update({ is_published: !article.is_published }).eq('id', article.id)
    loadArticles()
  }

  async function deleteArticle(id: string) {
    if (!confirm('Supprimer cet article ?')) return
    await supabase.from('articles').delete().eq('id', id)
    loadArticles()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl text-[#2C2C2C]">Articles & Conseils</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#C6684F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#A8543D] transition-colors">
          <Plus size={16} /> Nouvel article
        </button>
      </div>

      <div className="space-y-3">
        {articles.length === 0 && (
          <div className="text-center py-12 text-[#C6684F] bg-white rounded-xl border border-[#DCCFBF]">
            Aucun article pour l'instant.
          </div>
        )}
        {articles.map(article => (
          <div key={article.id} className="bg-white rounded-xl border border-[#DCCFBF] p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-[#2C2C2C] truncate">{article.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${article.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {article.is_published ? 'Publié' : 'Brouillon'}
                </span>
              </div>
              <p className="text-sm text-[#C6684F]">
                {CATEGORIES.find(c => c.value === article.category)?.label} · {article.reading_time_minutes} min de lecture
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => togglePublish(article)} className="p-2 text-[#C6684F] hover:text-[#2C2C2C]" title={article.is_published ? 'Dépublier' : 'Publier'}>
                {article.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => openEdit(article)} className="p-2 text-[#C6684F] hover:text-[#2C2C2C]"><Pencil size={16} /></button>
              <button onClick={() => deleteArticle(article.id)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#DCCFBF]">
              <h3 className="font-serif text-xl text-[#2C2C2C]">{editing ? 'Modifier l\'article' : 'Nouvel article'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-[#C6684F]" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Titre *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#6B6359] mb-1">Catégorie</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ArticleCategory }))}
                    className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6B6359] mb-1">Temps de lecture (min)</label>
                  <input type="number" value={form.reading_time_minutes} onChange={e => setForm(p => ({ ...p, reading_time_minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Contenu *</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={8}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F] resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Note de Marjorie</label>
                <textarea value={form.marjorie_note} onChange={e => setForm(p => ({ ...p, marjorie_note: e.target.value }))} rows={2}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F] resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">Tags (séparés par des virgules)</label>
                <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="respiration, core, dos" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6359] mb-1">URL miniature</label>
                <input value={form.thumbnail_url} onChange={e => setForm(p => ({ ...p, thumbnail_url: e.target.value }))}
                  className="w-full border border-[#DCCFBF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C6684F]" placeholder="https://..." />
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
              <button onClick={() => setShowForm(false)} className="flex-1 border border-[#DCCFBF] text-[#6B6359] py-2 rounded-lg text-sm font-medium">Annuler</button>
              <button onClick={save} disabled={saving || !form.title || !form.content}
                className="flex-1 bg-[#C6684F] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#A8543D] transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
