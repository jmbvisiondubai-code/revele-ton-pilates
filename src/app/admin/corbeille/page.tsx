'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, AlertTriangle, CheckSquare, Square, XCircle } from 'lucide-react'

const TABLE_LABELS: Record<string, { label: string; emoji: string }> = {
  articles: { label: 'Articles', emoji: '📝' },
  live_sessions: { label: 'Sessions Live', emoji: '📡' },
  invitations: { label: 'Invitations', emoji: '🔗' },
  vod_categories: { label: 'Catégories VOD', emoji: '🎬' },
  private_appointments: { label: 'RDV Privés', emoji: '📅' },
  recommendations: { label: 'Recommandations', emoji: '💡' },
}

type TrashedItem = {
  id: string
  deleted_at: string
  title?: string
  label?: string
  email?: string
  emoji?: string
  category?: string
  scheduled_at?: string
}

export default function CorbeillePage() {
  const [trash, setTrash] = useState<Record<string, TrashedItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [processing, setProcessing] = useState(false)

  const loadTrash = useCallback(async () => {
    const res = await fetch('/api/admin/trash')
    if (res.ok) {
      const data = await res.json()
      setTrash(data)
      setSelected({})
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTrash() }, [loadTrash])

  const totalItems = Object.values(trash).reduce((sum, items) => sum + items.length, 0)

  function toggleSelect(table: string, id: string) {
    setSelected(prev => {
      const set = new Set(prev[table] || [])
      if (set.has(id)) set.delete(id); else set.add(id)
      return { ...prev, [table]: set }
    })
  }

  function toggleSelectAll(table: string) {
    setSelected(prev => {
      const items = trash[table] || []
      const current = prev[table] || new Set()
      const allSelected = items.every(i => current.has(i.id))
      return { ...prev, [table]: allSelected ? new Set() : new Set(items.map(i => i.id)) }
    })
  }

  const selectedCount = Object.values(selected).reduce((sum, set) => sum + set.size, 0)

  async function restoreSelected() {
    setProcessing(true)
    for (const [table, ids] of Object.entries(selected)) {
      if (ids.size === 0) continue
      await fetch('/api/admin/trash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, ids: Array.from(ids) }),
      })
    }
    await loadTrash()
    setProcessing(false)
  }

  async function deleteSelected() {
    setProcessing(true)
    for (const [table, ids] of Object.entries(selected)) {
      if (ids.size === 0) continue
      await fetch('/api/admin/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, ids: Array.from(ids) }),
      })
    }
    await loadTrash()
    setProcessing(false)
  }

  async function emptyTrash() {
    setProcessing(true)
    for (const [table, items] of Object.entries(trash)) {
      if (items.length === 0) continue
      await fetch('/api/admin/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, ids: items.map(i => i.id) }),
      })
    }
    setConfirmEmpty(false)
    await loadTrash()
    setProcessing(false)
  }

  function restoreOne(table: string, id: string) {
    setProcessing(true)
    fetch('/api/admin/trash', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ids: [id] }),
    }).then(() => loadTrash()).finally(() => setProcessing(false))
  }

  function getItemLabel(table: string, item: TrashedItem): string {
    if (item.title) return item.title
    if (item.label) return `${item.emoji || ''} ${item.label}`.trim()
    if (item.email) return item.email
    return item.id.slice(0, 8)
  }

  function getItemSub(table: string, item: TrashedItem): string {
    const d = new Date(item.deleted_at)
    const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    if (item.category) return `${item.category} · Supprimé le ${dateStr}`
    if (item.scheduled_at) return `Prévu le ${new Date(item.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · Supprimé le ${dateStr}`
    return `Supprimé le ${dateStr}`
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-serif text-[#2C2C2C] mb-1 flex items-center gap-2">
            <Trash2 size={22} className="text-[#C6684F]" /> Corbeille
          </h2>
          <p className="text-sm text-[#A09488]">
            {totalItems === 0 ? 'La corbeille est vide' : `${totalItems} élément${totalItems > 1 ? 's' : ''} dans la corbeille`}
          </p>
        </div>
        {totalItems > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
          >
            <XCircle size={14} /> Vider la corbeille
          </button>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-10 bg-white border border-[#DCCFBF] rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-sm">
          <p className="text-sm text-[#2C2C2C] font-medium">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</p>
          <div className="flex gap-2">
            <button onClick={restoreSelected} disabled={processing}
              className="flex items-center gap-1.5 text-xs font-medium text-[#5B9A6B] bg-[#5B9A6B]/10 hover:bg-[#5B9A6B]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <RotateCcw size={12} /> Restaurer
            </button>
            <button onClick={deleteSelected} disabled={processing}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <Trash2 size={12} /> Supprimer définitivement
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalItems === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#F2E8DF] rounded-full flex items-center justify-center">
            <Trash2 size={28} className="text-[#DCCFBF]" />
          </div>
          <p className="text-sm text-[#A09488]">Aucun élément supprimé</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(trash).map(([table, items]) => {
            const info = TABLE_LABELS[table] || { label: table, emoji: '📦' }
            const tableSelected = selected[table] || new Set()
            const allSelected = items.every(i => tableSelected.has(i.id))

            return (
              <div key={table}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[#6B6359] uppercase tracking-wide flex items-center gap-1.5">
                    <span>{info.emoji}</span> {info.label} ({items.length})
                  </h3>
                  <button onClick={() => toggleSelectAll(table)}
                    className="text-xs text-[#A09488] hover:text-[#6B6359] transition-colors">
                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {items.map(item => {
                    const isSelected = tableSelected.has(item.id)
                    return (
                      <div key={item.id}
                        className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-colors ${isSelected ? 'border-[#C6684F]/40 bg-[#C6684F]/5' : 'border-[#DCCFBF]'}`}>
                        <button onClick={() => toggleSelect(table, item.id)} className="flex-shrink-0 text-[#C6684F]">
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-[#DCCFBF]" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#2C2C2C] truncate">{getItemLabel(table, item)}</p>
                          <p className="text-[11px] text-[#A09488]">{getItemSub(table, item)}</p>
                        </div>
                        <button onClick={() => restoreOne(table, item.id)} disabled={processing}
                          title="Restaurer"
                          className="w-8 h-8 rounded-lg bg-[#5B9A6B]/10 flex items-center justify-center text-[#5B9A6B] hover:bg-[#5B9A6B]/20 transition-colors flex-shrink-0 disabled:opacity-50">
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm empty modal */}
      {confirmEmpty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmEmpty(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-red-50 px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h3 className="font-semibold text-[#2C2C2C] text-lg">Vider la corbeille ?</h3>
              <p className="text-sm text-[#6B6359] mt-1">
                {totalItems} élément{totalItems > 1 ? 's' : ''} seront supprimé{totalItems > 1 ? 's' : ''} définitivement.
                Cette action est irréversible.
              </p>
            </div>
            <div className="px-6 py-4 flex gap-2">
              <button onClick={() => setConfirmEmpty(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm font-medium text-[#6B6359] hover:bg-[#FAF6F1] transition-colors">
                Annuler
              </button>
              <button onClick={emptyTrash} disabled={processing}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                {processing ? 'Suppression...' : 'Supprimer tout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
