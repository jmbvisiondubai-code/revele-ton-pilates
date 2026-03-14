'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, ExternalLink, Upload, Link as LinkIcon, Trash2 } from 'lucide-react'
import type { Recommendation } from '@/types/database'

const REC_CATEGORIES = [
  { key: 'mouvement', label: 'Mouvement', emoji: '🧘‍♀️' },
  { key: 'nutrition', label: 'Nutrition', emoji: '🥗' },
  { key: 'bien_etre', label: 'Bien-être', emoji: '🌿' },
  { key: 'mindset', label: 'Mindset', emoji: '🧠' },
  { key: 'cours', label: 'Cours', emoji: '🎯' },
  { key: 'autre', label: 'Autre', emoji: '💬' },
]

const EMPTY_FORM = { title: '', message: '', category: 'mouvement', linkUrl: '', linkLabel: '', thumbnailUrl: '', thumbnailMode: 'none' as 'none' | 'url' | 'upload' }

export default function AdminConseilsPage() {
  const supabase = createClient()
  const [tips, setTips] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadTips() }, [])

  async function loadTips() {
    const { data } = await supabase
      .from('recommendations')
      .select('*')
      .is('user_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setTips((data as Recommendation[]) ?? [])
    setLoading(false)
  }

  async function uploadThumb(file: File): Promise<string | null> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `tips/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('courses').upload(path, file, { upsert: true })
    if (error) { setUploading(false); return null }
    const { data } = supabase.storage.from('courses').getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const { data: me } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        user_id: null,
        created_by: me.user?.id,
        title: form.title.trim(),
        message: form.message.trim() || null,
        category: form.category,
        link_url: form.linkUrl.trim() || null,
        link_label: form.linkLabel.trim() || null,
        link_thumbnail_url: form.thumbnailUrl.trim() || null,
        is_read: true,
      })
      .select('*').single()
    if (!error && data) {
      setTips(prev => [data as Recommendation, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteTip(id: string) {
    setDeleting(id)
    await fetch('/api/admin/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'recommendations', ids: [id] }),
    })
    setTips(prev => prev.filter(t => t.id !== id))
    setDeleting(null)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-[#2C2C2C]">Conseils généraux</h1>
          <p className="text-sm text-[#6B6359] mt-1">Visibles par toutes les clientes dans l'onglet "Pour toutes".</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#C6684F] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#b05a42] transition">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#2C2C2C]">Nouveau conseil général</h2>
              <button onClick={() => setShowForm(false)} className="text-[#6B6359]"><X size={18} /></button>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-[#6B6359] font-medium mb-2 block">Catégorie</label>
              <div className="flex flex-wrap gap-2">
                {REC_CATEGORIES.map(c => (
                  <button key={c.key} type="button" onClick={() => setForm(f => ({ ...f, category: c.key }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${form.category === c.key ? 'border-[#C6684F] bg-[#C6684F]/10 text-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359]'}`}>
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-[#6B6359] font-medium mb-1 block">Titre *</label>
              <input type="text" autoCapitalize="sentences" placeholder="Ex : Astuce pour mieux dormir" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-[#6B6359] font-medium mb-1 block">Message</label>
              <textarea autoCapitalize="sentences" placeholder="Développe ton conseil ici..." value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={3} className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] resize-none" />
            </div>

            {/* Link */}
            <div className="space-y-2">
              <label className="text-xs text-[#6B6359] font-medium block">Lien (optionnel)</label>
              <div className="relative">
                <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6359]" />
                <input type="url" placeholder="https://..." value={form.linkUrl}
                  onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                  className="w-full text-sm border border-[#DCCFBF] rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
              </div>
              {form.linkUrl && (
                <input type="text" autoCapitalize="sentences" placeholder="Texte du bouton (ex : Voir la recette)" value={form.linkLabel}
                  onChange={e => setForm(f => ({ ...f, linkLabel: e.target.value }))}
                  className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
              )}
            </div>

            {/* Thumbnail */}
            <div className="space-y-2">
              <label className="text-xs text-[#6B6359] font-medium block">Image (optionnel)</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, thumbnailMode: f.thumbnailMode === 'url' ? 'none' : 'url', thumbnailUrl: '' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs border transition ${form.thumbnailMode === 'url' ? 'border-[#C6684F] bg-[#C6684F]/5 text-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359]'}`}>
                  <LinkIcon size={12} /> URL
                </button>
                <button type="button" onClick={() => { setForm(f => ({ ...f, thumbnailMode: 'upload', thumbnailUrl: '' })); fileRef.current?.click() }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs border transition ${form.thumbnailMode === 'upload' ? 'border-[#C6684F] bg-[#C6684F]/5 text-[#C6684F]' : 'border-[#DCCFBF] text-[#6B6359]'}`}>
                  <Upload size={12} /> {uploading ? 'Upload...' : 'Uploader'}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await uploadThumb(f); if (url) setForm(p => ({ ...p, thumbnailUrl: url, thumbnailMode: 'upload' })) }; e.target.value = '' }} />
              {form.thumbnailMode === 'url' && (
                <input type="url" placeholder="https://..." value={form.thumbnailUrl}
                  onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))}
                  className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]" />
              )}
              {form.thumbnailUrl && (
                <div className="relative rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.thumbnailUrl} alt="" className="w-full h-32 object-cover" />
                  <button onClick={() => setForm(f => ({ ...f, thumbnailUrl: '', thumbnailMode: 'none' }))}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><X size={12} /></button>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm text-[#6B6359]">Annuler</button>
              <button onClick={save} disabled={saving || !form.title.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#C6684F] text-white text-sm font-medium hover:bg-[#b05a42] disabled:opacity-50 transition flex items-center justify-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus size={15} /> Publier</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" /></div>
      ) : tips.length === 0 ? (
        <p className="text-center py-12 text-[#6B6359]">Aucun conseil général. Clique sur "Ajouter" pour commencer.</p>
      ) : (
        <div className="space-y-3">
          {tips.map(tip => {
            const cat = REC_CATEGORIES.find(c => c.key === tip.category) ?? { emoji: '✨', label: 'Conseil' }
            return (
              <div key={tip.id} className="bg-white border border-[#DCCFBF] rounded-xl overflow-hidden">
                {tip.link_thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tip.link_thumbnail_url} alt="" className="w-full h-28 object-cover" />
                )}
                <div className="p-4 flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-[#C6684F] uppercase tracking-wide mb-0.5">{cat.label}</p>
                    <p className="text-sm font-semibold text-[#2C2C2C]">{tip.title}</p>
                    {tip.message && <p className="text-xs text-[#6B6359] mt-1 line-clamp-2">{tip.message}</p>}
                    {tip.link_url && (
                      <a href={tip.link_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1.5 text-xs text-[#C6684F] hover:underline">
                        <ExternalLink size={11} /> {tip.link_label || tip.link_url}
                      </a>
                    )}
                    <p className="text-[10px] text-[#DCCFBF] mt-1.5">
                      {new Date(tip.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => deleteTip(tip.id)} disabled={deleting === tip.id}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition flex-shrink-0">
                    {deleting === tip.id
                      ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 size={14} />}
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
