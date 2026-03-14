'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, UserX, Trash2, RotateCcw, Shield, ShieldOff, ChevronRight, AlertTriangle } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'

type Member = {
  id: string
  first_name: string
  last_name: string
  username: string
  email: string
  avatar_url: string | null
  is_admin: boolean
  total_sessions: number
  created_at: string
  banned_until?: string | null
}

export default function MembresPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionModal, setActionModal] = useState<{ member: Member; action: 'disable' | 'enable' | 'delete' } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { profile } = useAuthStore()

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setLoading(false); return }
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, username, email, avatar_url, is_admin, total_sessions, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (data) {
        // Fetch ban status from auth for each user via API
        setMembers(data as Member[])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleAction() {
    if (!actionModal) return
    setProcessing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actionModal.member.id, action: actionModal.action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      if (actionModal.action === 'delete') {
        setMembers(prev => prev.filter(m => m.id !== actionModal.member.id))
      } else if (actionModal.action === 'disable') {
        setMembers(prev => prev.map(m => m.id === actionModal.member.id ? { ...m, banned_until: 'banned' } : m))
      } else if (actionModal.action === 'enable') {
        setMembers(prev => prev.map(m => m.id === actionModal.member.id ? { ...m, banned_until: null } : m))
      }
      setActionModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setProcessing(false)
    }
  }

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    return !q || m.first_name?.toLowerCase().includes(q) || m.last_name?.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
  })

  const activeCount = members.filter(m => !m.banned_until).length
  const disabledCount = members.filter(m => m.banned_until).length

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-[#2C2C2C]">Gestion des membres</h1>
        <p className="text-sm text-[#6B6359] mt-1">Gérer les comptes des clientes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-[#DCCFBF] p-4 text-center">
          <p className="text-2xl font-bold text-[#2C2C2C]">{members.length}</p>
          <p className="text-xs text-[#A09488]">Total</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#DCCFBF] p-4 text-center">
          <p className="text-2xl font-bold text-[#5B9A6B]">{activeCount}</p>
          <p className="text-xs text-[#A09488]">Actifs</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#DCCFBF] p-4 text-center">
          <p className="text-2xl font-bold text-[#C6684F]">{disabledCount}</p>
          <p className="text-xs text-[#A09488]">Désactivés</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A09488]" />
        <input
          type="text"
          placeholder="Rechercher par nom, pseudo ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#DCCFBF] rounded-xl text-sm text-[#2C2C2C] placeholder:text-[#A09488] focus:outline-none focus:border-[#C6684F] transition-colors"
        />
      </div>

      {/* Members list */}
      <div className="bg-white rounded-2xl border border-[#DCCFBF] overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-[#A09488]">
            {search ? 'Aucun résultat' : 'Aucun membre'}
          </div>
        ) : (
          <div className="divide-y divide-[#F5F0EB]">
            {filtered.map(member => {
              const isSelf = member.id === profile?.id
              const isDisabled = !!member.banned_until
              return (
                <div key={member.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F1] transition-colors ${isDisabled ? 'opacity-60' : ''}`}>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#E8D5C4] flex items-center justify-center text-[#C6684F] font-semibold text-sm flex-shrink-0">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatar_url} alt={member.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (member.first_name?.[0] ?? member.username?.[0] ?? '?').toUpperCase()
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#2C2C2C] truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      {member.is_admin && (
                        <span className="text-[9px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-1.5 py-0.5 rounded-full uppercase">Admin</span>
                      )}
                      {isDisabled && (
                        <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full uppercase">Désactivé</span>
                      )}
                    </div>
                    <p className="text-xs text-[#A09488] truncate">@{member.username} · {member.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:block text-right flex-shrink-0">
                    <p className="text-xs text-[#6B6359] font-medium">{member.total_sessions} sessions</p>
                    <p className="text-[10px] text-[#A09488]">
                      Depuis {new Date(member.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Actions — not for self or other admins */}
                  {!isSelf && !member.is_admin ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isDisabled ? (
                        <button
                          onClick={() => setActionModal({ member, action: 'enable' })}
                          className="w-8 h-8 rounded-lg bg-[#5B9A6B]/10 hover:bg-[#5B9A6B]/20 flex items-center justify-center text-[#5B9A6B] transition-colors"
                          title="Réactiver"
                        >
                          <RotateCcw size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setActionModal({ member, action: 'disable' })}
                          className="w-8 h-8 rounded-lg bg-[#F2E8DF] hover:bg-[#DCCFBF] flex items-center justify-center text-[#A09488] hover:text-[#C6684F] transition-colors"
                          title="Désactiver"
                        >
                          <ShieldOff size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setActionModal({ member, action: 'delete' })}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-[#A09488] hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-[72px] flex-shrink-0 flex justify-center">
                      {isSelf && <Shield size={14} className="text-[#7C3AED]" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {actionModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30"
              onClick={() => { if (!processing) setActionModal(null) }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  actionModal.action === 'delete' ? 'bg-red-50' : actionModal.action === 'disable' ? 'bg-amber-50' : 'bg-green-50'
                }`}>
                  {actionModal.action === 'delete' ? (
                    <AlertTriangle size={20} className="text-red-500" />
                  ) : actionModal.action === 'disable' ? (
                    <ShieldOff size={20} className="text-amber-600" />
                  ) : (
                    <RotateCcw size={20} className="text-green-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2C2C2C]">
                    {actionModal.action === 'delete' && 'Supprimer ce compte ?'}
                    {actionModal.action === 'disable' && 'Désactiver ce compte ?'}
                    {actionModal.action === 'enable' && 'Réactiver ce compte ?'}
                  </p>
                  <p className="text-xs text-[#6B6359] mt-1">
                    <span className="font-medium">{actionModal.member.first_name} {actionModal.member.last_name}</span> (@{actionModal.member.username})
                  </p>
                  <p className="text-xs text-[#A09488] mt-2 leading-relaxed">
                    {actionModal.action === 'delete' && 'Le compte sera désactivé et placé dans la corbeille. Tu pourras le restaurer depuis la corbeille si besoin.'}
                    {actionModal.action === 'disable' && 'La cliente ne pourra plus se connecter à l\'application. Son compte et ses données seront conservés.'}
                    {actionModal.action === 'enable' && 'La cliente pourra à nouveau se connecter et utiliser l\'application.'}
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setActionModal(null); setError(null) }}
                  disabled={processing}
                  className="flex-1 py-2.5 rounded-xl border border-[#EDE5DA] text-sm font-medium text-[#6B6359] hover:bg-[#FAF6F1] transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAction}
                  disabled={processing}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                    actionModal.action === 'delete'
                      ? 'bg-red-500 hover:bg-red-600'
                      : actionModal.action === 'disable'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-[#5B9A6B] hover:bg-[#4a8a5a]'
                  }`}
                >
                  {processing ? 'En cours...' : actionModal.action === 'delete' ? 'Supprimer' : actionModal.action === 'disable' ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
