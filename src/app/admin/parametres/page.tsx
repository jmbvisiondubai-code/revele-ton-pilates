'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Upload, X, ExternalLink } from 'lucide-react'

interface FeaturedForm {
  title: string
  description: string
  url: string
  image: string
}

interface ReplayForm {
  url: string
  code: string
  image: string
}

export default function AdminParametresPage() {
  const supabase = createClient()
  const [form, setForm] = useState<FeaturedForm>({
    title: 'Programme Hebdo',
    description: 'Un nouveau programme chaque semaine pour progresser à ton rythme.',
    url: 'https://vod.marjoriejamin.com/programs/programmehebdo?category_id=233117',
    image: '',
  })
  const [replay, setReplay] = useState<ReplayForm>({ url: '', code: '', image: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingReplay, setSavingReplay] = useState(false)
  const [savedReplay, setSavedReplay] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingReplay, setUploadingReplay] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const replayFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['featured_title', 'featured_description', 'featured_url', 'featured_image', 'vimeo_replay_url', 'vimeo_replay_code', 'vimeo_replay_image'])
      if (data) {
        const get = (k: string) => data.find((s: { key: string; value: string | null }) => s.key === k)?.value ?? ''
        setForm({
          title: get('featured_title') || 'Programme Hebdo',
          description: get('featured_description') || 'Un nouveau programme chaque semaine pour progresser à ton rythme.',
          url: get('featured_url') || 'https://vod.marjoriejamin.com/programs/programmehebdo?category_id=233117',
          image: get('featured_image') || '',
        })
        setReplay({
          url: get('vimeo_replay_url') || '',
          code: get('vimeo_replay_code') || '',
          image: get('vimeo_replay_image') || '',
        })
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function upsert(key: string, value: string) {
    await supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' })
  }

  async function save() {
    setSaving(true)
    await Promise.all([
      upsert('featured_title', form.title),
      upsert('featured_description', form.description),
      upsert('featured_url', form.url),
      upsert('featured_image', form.image),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function uploadImage(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `featured/programme-hebdo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('courses').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('courses').getPublicUrl(path)
      setForm(f => ({ ...f, image: publicUrl }))
    }
    setUploading(false)
  }

  async function uploadReplayImage(file: File) {
    setUploadingReplay(true)
    const ext = file.name.split('.').pop()
    const path = `featured/replay-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('courses').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('courses').getPublicUrl(path)
      setReplay(r => ({ ...r, image: publicUrl }))
    }
    setUploadingReplay(false)
  }

  async function saveReplay() {
    setSavingReplay(true)
    await Promise.all([
      upsert('vimeo_replay_url', replay.url),
      upsert('vimeo_replay_code', replay.code),
      upsert('vimeo_replay_image', replay.image),
    ])
    setSavingReplay(false)
    setSavedReplay(true)
    setTimeout(() => setSavedReplay(false), 2500)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-[#2C2C2C]">Paramètres</h1>
        <p className="text-sm text-[#6B6359] mt-1">Gère la carte "Programme de la semaine" sur le dashboard des clientes.</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#DCCFBF] p-6 space-y-5">
        <h2 className="font-semibold text-[#2C2C2C] text-base">Programme de la semaine</h2>

        {/* Image */}
        <div>
          <label className="text-xs text-[#6B6359] font-medium mb-2 block">Photo de couverture</label>
          {form.image ? (
            <div className="relative rounded-xl overflow-hidden mb-2 border border-[#DCCFBF]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.image} alt="couverture" className="w-full h-40 object-cover" />
              <button
                onClick={() => setForm(f => ({ ...f, image: '' }))}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#DCCFBF] rounded-xl p-8 text-center cursor-pointer hover:border-[#C6684F] transition-colors"
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-[#6B6359]">
                  <div className="w-4 h-4 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
                  Envoi en cours...
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto mb-2 text-[#DCCFBF]" />
                  <p className="text-sm text-[#6B6359]">Clique pour uploader une photo</p>
                  <p className="text-xs text-[#DCCFBF] mt-1">JPG, PNG, WebP — max 5 Mo</p>
                </>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadImage(file)
              e.target.value = ''
            }}
          />
          {!form.image && (
            <div className="mt-2">
              <label className="text-xs text-[#6B6359] font-medium mb-1 block">Ou coller une URL d'image</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.image}
                onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
              />
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-[#6B6359] font-medium mb-1 block">Titre</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-[#6B6359] font-medium mb-1 block">Description courte</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] resize-none"
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-xs text-[#6B6359] font-medium mb-1 block">Lien Uscreen *</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className="flex-1 text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
            />
            {form.url && (
              <a
                href={form.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#F2E8DF] text-[#C6684F] text-sm font-medium hover:bg-[#DCCFBF] transition"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end pt-1">
          <button
            onClick={save}
            disabled={saving || !form.url.trim()}
            className="flex items-center gap-2 bg-[#C6684F] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#b05a42] disabled:opacity-50 transition"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <><Check size={15} /> Sauvegardé !</>
            ) : (
              <><Check size={15} /> Enregistrer</>
            )}
          </button>
        </div>
      </div>
      {/* ── Replay section ── */}
      <div className="bg-white rounded-2xl border border-[#DCCFBF] p-6 space-y-5 mt-6">
        <h2 className="font-semibold text-[#2C2C2C] text-base">Replay du dernier live</h2>

        {/* Image */}
        <div>
          <label className="text-xs text-[#6B6359] font-medium mb-2 block">Photo de couverture</label>
          {replay.image ? (
            <div className="relative rounded-xl overflow-hidden mb-2 border border-[#DCCFBF]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={replay.image} alt="couverture replay" className="w-full h-40 object-cover" />
              <button
                onClick={() => setReplay(r => ({ ...r, image: '' }))}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => replayFileRef.current?.click()}
              className="border-2 border-dashed border-[#DCCFBF] rounded-xl p-8 text-center cursor-pointer hover:border-[#C6684F] transition-colors"
            >
              {uploadingReplay ? (
                <div className="flex items-center justify-center gap-2 text-sm text-[#6B6359]">
                  <div className="w-4 h-4 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
                  Envoi en cours...
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto mb-2 text-[#DCCFBF]" />
                  <p className="text-sm text-[#6B6359]">Clique pour uploader une photo</p>
                  <p className="text-xs text-[#DCCFBF] mt-1">JPG, PNG, WebP — max 5 Mo</p>
                </>
              )}
            </div>
          )}
          <input
            ref={replayFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadReplayImage(file)
              e.target.value = ''
            }}
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-xs text-[#6B6359] font-medium mb-1 block">Lien Vimeo du replay</label>
          <input
            type="url"
            placeholder="https://vimeo.com/..."
            value={replay.url}
            onChange={e => setReplay(r => ({ ...r, url: e.target.value }))}
            className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
          />
        </div>

        {/* Code / mot de passe */}
        <div>
          <label className="text-xs text-[#6B6359] font-medium mb-1 block">Mot de passe Vimeo</label>
          <input
            type="text"
            placeholder="Ex: pilates2025"
            value={replay.code}
            onChange={e => setReplay(r => ({ ...r, code: e.target.value }))}
            className="w-full text-sm border border-[#DCCFBF] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pt-1">
          <button
            onClick={saveReplay}
            disabled={savingReplay}
            className="flex items-center gap-2 bg-[#C6684F] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#b05a42] disabled:opacity-50 transition"
          >
            {savingReplay ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : savedReplay ? (
              <><Check size={15} /> Sauvegardé !</>
            ) : (
              <><Check size={15} /> Enregistrer</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
