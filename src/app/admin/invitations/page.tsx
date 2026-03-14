'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Copy, Check, Trash2, Clock, UserCheck, Link as LinkIcon } from 'lucide-react'
import { formatRelativeDate, formatFutureDate } from '@/lib/utils'

interface Invitation {
  id: string
  token: string
  email: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  used_by: string | null
  used_by_profile?: { first_name: string } | null
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const supabase = createClient()

  const loadInvitations = useCallback(async () => {
    const { data } = await supabase
      .from('invitations')
      .select('*, used_by_profile:profiles!invitations_used_by_fkey(first_name)')
      .order('created_at', { ascending: false })
    if (data) setInvitations(data as Invitation[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadInvitations() }, [loadInvitations])

  async function createInvitation() {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email: email.trim() || null,
        created_by: user.id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (!error && data) {
      setInvitations(prev => [data, ...prev])
      setEmail('')
    }
    setCreating(false)
  }

  async function deleteInvitation(id: string) {
    // Try client-side first, fallback to server API (RLS might block)
    const { error } = await supabase.from('invitations').delete().eq('id', id)
    if (error) {
      await fetch('/api/mark-invitation-used', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    }
    setInvitations(prev => prev.filter(i => i.id !== id))
  }

  function getInviteUrl(token: string) {
    return `${window.location.origin}/signup?token=${token}`
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(getInviteUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const pending = invitations.filter(i => !i.used_at && new Date(i.expires_at) > new Date())
  const used = invitations.filter(i => i.used_at)
  const expired = invitations.filter(i => !i.used_at && new Date(i.expires_at) <= new Date())

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h2 className="text-2xl font-serif text-[#2C2C2C] mb-1">Invitations</h2>
        <p className="text-sm text-[#C6684F]">
          Génère des liens d&apos;invitation privés pour tes clientes. Sans lien valide, personne ne peut créer de compte.
        </p>
      </div>

      {/* Créer une invitation */}
      <div className="bg-white rounded-2xl border border-[#DCCFBF] p-5 mb-8">
        <h3 className="font-medium text-[#2C2C2C] mb-4">Nouvelle invitation</h3>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="Email de la cliente (optionnel)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 bg-[#FAF6F1] border border-[#DCCFBF] rounded-xl px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#A09488] focus:outline-none focus:border-[#C6684F]"
          />
          <button
            onClick={createInvitation}
            disabled={creating}
            className="flex items-center gap-2 bg-[#C6684F] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#A8543D] transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            {creating ? 'Création…' : 'Créer le lien'}
          </button>
        </div>
        <p className="text-xs text-[#A09488] mt-2">
          Si tu précises l&apos;email, la cliente devra utiliser cette adresse pour créer son compte. Le lien expire dans 30 jours.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'En attente', count: pending.length, color: 'text-amber-600 bg-amber-50' },
              { label: 'Utilisées', count: used.length, color: 'text-green-600 bg-green-50' },
              { label: 'Expirées', count: expired.length, color: 'text-[#A09488] bg-[#F2E8DF]' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-white rounded-xl border border-[#DCCFBF] p-4 text-center">
                <p className={`text-2xl font-bold ${color.split(' ')[0]}`}>{count}</p>
                <p className="text-xs text-[#C6684F] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Liste invitations actives */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#6B6359] uppercase tracking-wide mb-3">
                En attente ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map(inv => (
                  <div key={inv.id} className="bg-white rounded-xl border border-[#DCCFBF] p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                        <LinkIcon size={14} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2C2C2C]">
                          {inv.email || 'Invitation ouverte'}
                        </p>
                        <p className="text-xs text-[#A09488] mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {formatFutureDate(inv.expires_at)}
                        </p>
                        <p className="text-xs text-[#A09488] font-mono mt-1 truncate">
                          /signup?token={inv.token.slice(0, 16)}…
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => copyLink(inv.token)}
                          className="w-8 h-8 rounded-lg bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] hover:bg-[#DCCFBF] transition-colors"
                          title="Copier le lien"
                        >
                          {copied === inv.token ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => deleteInvitation(inv.id)}
                          className="w-8 h-8 rounded-lg bg-[#F2E8DF] flex items-center justify-center text-[#A09488] hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invitations utilisées */}
          {used.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#6B6359] uppercase tracking-wide mb-3">
                Utilisées ({used.length})
              </h3>
              <div className="space-y-2">
                {used.map(inv => (
                  <div key={inv.id} className="bg-white rounded-xl border border-[#DCCFBF] p-4 opacity-75">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                        <UserCheck size={14} className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#2C2C2C]">
                          {inv.email || 'Invitation ouverte'}
                        </p>
                        <p className="text-xs text-[#A09488]">
                          Compte créé {inv.used_at ? formatRelativeDate(inv.used_at) : ''}
                          {inv.used_by_profile?.first_name && ` · ${inv.used_by_profile.first_name}`}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteInvitation(inv.id)}
                        className="w-8 h-8 rounded-lg bg-[#F2E8DF] flex items-center justify-center text-[#A09488] hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invitations.length === 0 && (
            <div className="text-center py-12 text-[#A09488] text-sm">
              Aucune invitation créée pour l&apos;instant
            </div>
          )}
        </div>
      )}
    </div>
  )
}
