'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, AlertTriangle, CheckSquare, Square, XCircle, ChevronDown, ChevronRight, Users, FileText, Link as LinkIcon } from 'lucide-react'

// Sections grouping tables by category
const SECTIONS = [
  {
    key: 'membres',
    label: 'Membres',
    icon: Users,
    tables: {
      profiles: { label: 'Comptes clientes', emoji: '👤' },
    },
  },
  {
    key: 'contenus',
    label: 'Contenus',
    icon: FileText,
    tables: {
      articles: { label: 'Articles', emoji: '📝' },
      live_sessions: { label: 'Sessions Live', emoji: '📡' },
      vod_categories: { label: 'Catégories VOD', emoji: '🎬' },
      recommendations: { label: 'Recommandations', emoji: '💡' },
    },
  },
  {
    key: 'liens',
    label: 'Liens & RDV',
    icon: LinkIcon,
    tables: {
      invitations: { label: 'Invitations', emoji: '🔗' },
      private_appointments: { label: 'RDV Privés', emoji: '📅' },
    },
  },
]

type TrashedItem = {
  id: string
  deleted_at: string
  title?: string
  label?: string
  email?: string
  emoji?: string
  category?: string
  scheduled_at?: string
  first_name?: string
  last_name?: string
  username?: string
  avatar_url?: string | null
}

export default function CorbeillePage() {
  const [trash, setTrash] = useState<Record<string, TrashedItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false)
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

  function toggleCollapse(sectionKey: string) {
    setCollapsed(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }

  function toggleSelect(table: string, id: string) {
    setSelected(prev => {
      const set = new Set(prev[table] || [])
      if (set.has(id)) set.delete(id); else set.add(id)
      return { ...prev, [table]: set }
    })
  }

  function toggleSelectAllTable(table: string) {
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

  async function deleteSelectedPermanently() {
    setProcessing(true)
    for (const [table, ids] of Object.entries(selected)) {
      if (ids.size === 0) continue
      await fetch('/api/admin/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, ids: Array.from(ids) }),
      })
    }
    setConfirmDeleteSelected(false)
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
    if (table === 'profiles') return `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username || item.id.slice(0, 8)
    if (item.title) return item.title
    if (item.label) return `${item.emoji || ''} ${item.label}`.trim()
    if (item.email) return item.email
    return item.id.slice(0, 8)
  }

  function getItemSub(table: string, item: TrashedItem): string {
    const d = new Date(item.deleted_at)
    const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    if (table === 'profiles') return `@${item.username || '?'} · ${item.email || ''} · Supprimé le ${dateStr}`
    if (item.category) return `${item.category} · Supprimé le ${dateStr}`
    if (item.scheduled_at) return `Prévu le ${new Date(item.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · Supprimé le ${dateStr}`
    return `Supprimé le ${dateStr}`
  }

  function getItemAvatar(table: string, item: TrashedItem): React.ReactNode {
    if (table === 'profiles') {
      return (
        <div className="w-8 h-8 rounded-full bg-[#E8D5C4] flex items-center justify-center text-[#C6684F] font-semibold text-xs flex-shrink-0 overflow-hidden">
          {item.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={item.avatar_url} alt="" className="w-full h-full object-cover" />
            : (item.first_name?.[0] || '?').toUpperCase()
          }
        </div>
      )
    }
    return null
  }

  // Count items per section
  function sectionItemCount(section: typeof SECTIONS[number]): number {
    return Object.keys(section.tables).reduce((sum, t) => sum + (trash[t]?.length || 0), 0)
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
            <button onClick={() => setSelected({})}
              className="text-xs text-[#A09488] hover:text-[#6B6359] px-2 py-1 transition-colors">
              Désélectionner
            </button>
            <button onClick={restoreSelected} disabled={processing}
              className="flex items-center gap-1.5 text-xs font-medium text-[#5B9A6B] bg-[#5B9A6B]/10 hover:bg-[#5B9A6B]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <RotateCcw size={12} /> Restaurer
            </button>
            <button onClick={() => setConfirmDeleteSelected(true)} disabled={processing}
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
        <div className="space-y-3">
          {SECTIONS.map(section => {
            const count = sectionItemCount(section)
            if (count === 0) return null
            const isCollapsed = collapsed[section.key]
            const Icon = section.icon

            return (
              <div key={section.key} className="bg-white border border-[#DCCFBF] rounded-2xl overflow-hidden">
                {/* Section header — clickable to collapse */}
                <button
                  onClick={() => toggleCollapse(section.key)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#FAF6F1] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#C6684F]/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-[#C6684F]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-[#2C2C2C]">{section.label}</p>
                    <p className="text-[11px] text-[#A09488]">{count} élément{count > 1 ? 's' : ''}</p>
                  </div>
                  {isCollapsed
                    ? <ChevronRight size={16} className="text-[#DCCFBF]" />
                    : <ChevronDown size={16} className="text-[#DCCFBF]" />
                  }
                </button>

                {/* Section content */}
                {!isCollapsed && (
                  <div className="border-t border-[#F5F0EB] px-4 pb-4 space-y-4">
                    {Object.entries(section.tables).map(([table, tableInfo]) => {
                      const items = trash[table]
                      if (!items || items.length === 0) return null
                      const tableSelected = selected[table] || new Set()
                      const allSelected = items.every(i => tableSelected.has(i.id))

                      return (
                        <div key={table} className="pt-3">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <p className="text-xs font-semibold text-[#6B6359] uppercase tracking-wide flex items-center gap-1.5">
                              <span>{tableInfo.emoji}</span> {tableInfo.label} ({items.length})
                            </p>
                            <button onClick={() => toggleSelectAllTable(table)}
                              className="text-[11px] text-[#A09488] hover:text-[#6B6359] transition-colors">
                              {allSelected ? 'Désélectionner' : 'Tout sélectionner'}
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {items.map(item => {
                              const isSelected = tableSelected.has(item.id)
                              return (
                                <div key={item.id}
                                  className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 transition-colors ${isSelected ? 'border-[#C6684F]/40 bg-[#C6684F]/5' : 'border-[#F5F0EB] bg-[#FAF6F1]/50'}`}>
                                  <button onClick={() => toggleSelect(table, item.id)} className="flex-shrink-0">
                                    {isSelected ? <CheckSquare size={16} className="text-[#C6684F]" /> : <Square size={16} className="text-[#DCCFBF]" />}
                                  </button>
                                  {getItemAvatar(table, item)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#2C2C2C] truncate">{getItemLabel(table, item)}</p>
                                    <p className="text-[10px] text-[#A09488] truncate">{getItemSub(table, item)}</p>
                                  </div>
                                  <button onClick={() => restoreOne(table, item.id)} disabled={processing}
                                    title="Restaurer"
                                    className="w-7 h-7 rounded-lg bg-[#5B9A6B]/10 flex items-center justify-center text-[#5B9A6B] hover:bg-[#5B9A6B]/20 transition-colors flex-shrink-0 disabled:opacity-50">
                                    <RotateCcw size={13} />
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
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm empty trash modal */}
      {confirmEmpty && (
        <ConfirmModal
          title="Vider la corbeille ?"
          message={`${totalItems} élément${totalItems > 1 ? 's' : ''} seront supprimé${totalItems > 1 ? 's' : ''} définitivement. Cette action est irréversible.`}
          confirmLabel={processing ? 'Suppression...' : 'Supprimer tout'}
          onConfirm={emptyTrash}
          onCancel={() => setConfirmEmpty(false)}
          processing={processing}
        />
      )}

      {/* Confirm delete selected modal */}
      {confirmDeleteSelected && (
        <ConfirmModal
          title="Supprimer définitivement ?"
          message={`${selectedCount} élément${selectedCount > 1 ? 's' : ''} seront supprimé${selectedCount > 1 ? 's' : ''} de manière irréversible.`}
          confirmLabel={processing ? 'Suppression...' : 'Supprimer'}
          onConfirm={deleteSelectedPermanently}
          onCancel={() => setConfirmDeleteSelected(false)}
          processing={processing}
        />
      )}
    </div>
  )
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, processing }: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  processing: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-red-50 px-6 pt-6 pb-4 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h3 className="font-semibold text-[#2C2C2C] text-lg">{title}</h3>
          <p className="text-sm text-[#6B6359] mt-1">{message}</p>
        </div>
        <div className="px-6 py-4 flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm font-medium text-[#6B6359] hover:bg-[#FAF6F1] transition-colors">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={processing}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
