'use client'

import { useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Card } from '@/components/ui'
import { ClipboardCheck, CheckCircle2, Circle, ChevronDown, ChevronUp, Search, LayoutGrid, List, Users, StickyNote, X, AlertTriangle } from 'lucide-react'
import { LEVEL_LABELS } from '@/lib/utils'

type Client = {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  practice_level: string | null
  subscription_start: string | null
  created_at: string
}

type Bilan = {
  id: string
  user_id: string
  phase: 'debut' | 'milieu' | 'fin'
  completed: boolean
  completed_at: string | null
  notes: string | null
}

type ViewMode = 'phases' | 'liste' | 'clientes'

const PHASE_CONFIG = {
  debut: { label: 'Début', subtitle: '1 à 4 mois', color: '#C6684F', bgLight: '#FDF0ED', months: [1, 4] },
  milieu: { label: 'Milieu', subtitle: '4 à 8 mois', color: '#D4A056', bgLight: '#FDF6EC', months: [4, 8] },
  fin: { label: 'Fin', subtitle: '8 à 12 mois', color: '#7B9E6B', bgLight: '#F0F5ED', months: [8, 12] },
} as const

function getClientPhase(subscriptionStart: string | null): 'debut' | 'milieu' | 'fin' | null {
  if (!subscriptionStart) return null
  const start = new Date(subscriptionStart)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (months < 0) return null
  if (months < 4) return 'debut'
  if (months < 8) return 'milieu'
  if (months <= 12) return 'fin'
  return null // expired
}

function getMonthsElapsed(subscriptionStart: string): number {
  const start = new Date(subscriptionStart)
  const now = new Date()
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
}

function getInitials(first: string, last: string) {
  return (first?.[0] || '') + (last?.[0] || '')
}

export default function BilansPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [bilans, setBilans] = useState<Bilan[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('phases')
  const [search, setSearch] = useState('')
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({ aclasser: true, debut: true, milieu: true, fin: true })
  const [notesModal, setNotesModal] = useState<{ userId: string; phase: 'debut' | 'milieu' | 'fin'; notes: string } | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    loadData()
  }, [])

  async function loadData() {
    const [{ data: profiles }, { data: bilanData }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, avatar_url, practice_level, subscription_start, created_at')
        .eq('is_admin', false).is('deleted_at', null).order('first_name'),
      supabase.from('bilans').select('*'),
    ])
    setClients((profiles as Client[]) ?? [])
    setBilans((bilanData as Bilan[]) ?? [])
    setLoading(false)
  }

  async function toggleBilan(userId: string, phase: 'debut' | 'milieu' | 'fin') {
    const existing = bilans.find(b => b.user_id === userId && b.phase === phase)

    if (existing) {
      const newCompleted = !existing.completed
      await supabase.from('bilans').update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      }).eq('id', existing.id)
      setBilans(prev => prev.map(b => b.id === existing.id ? { ...b, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : b))
    } else {
      const { data } = await supabase.from('bilans').insert({
        user_id: userId,
        phase,
        completed: true,
        completed_at: new Date().toISOString(),
      }).select().single()
      if (data) setBilans(prev => [...prev, data as Bilan])
    }
  }

  async function saveNotes() {
    if (!notesModal) return
    setSavingNotes(true)
    const existing = bilans.find(b => b.user_id === notesModal.userId && b.phase === notesModal.phase)
    if (existing) {
      await supabase.from('bilans').update({ notes: notesModal.notes || null }).eq('id', existing.id)
      setBilans(prev => prev.map(b => b.id === existing.id ? { ...b, notes: notesModal.notes || null } : b))
    } else {
      const { data } = await supabase.from('bilans').insert({
        user_id: notesModal.userId,
        phase: notesModal.phase,
        completed: false,
        notes: notesModal.notes || null,
      }).select().single()
      if (data) setBilans(prev => [...prev, data as Bilan])
    }
    setSavingNotes(false)
    setNotesModal(null)
  }

  function getBilan(userId: string, phase: string): Bilan | undefined {
    return bilans.find(b => b.user_id === userId && b.phase === phase)
  }

  const searchFilter = (c: Client) => {
    if (!search) return true
    const full = `${c.first_name} ${c.last_name}`.toLowerCase()
    return full.includes(search.toLowerCase())
  }

  const activeClients = clients.filter(c => c.subscription_start && getClientPhase(c.subscription_start) !== null)
  const unclassifiedClients = clients.filter(c => !c.subscription_start || getClientPhase(c.subscription_start) === null)
  const filtered = activeClients.filter(searchFilter)
  const filteredUnclassified = unclassifiedClients.filter(searchFilter)

  // Stats
  const totalBilansDone = bilans.filter(b => b.completed).length
  const totalBilansPossible = activeClients.length * 3
  const phases: ('debut' | 'milieu' | 'fin')[] = ['debut', 'milieu', 'fin']

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const renderClientRow = (client: Client, phase: 'debut' | 'milieu' | 'fin', compact = false) => {
    const bilan = getBilan(client.id, phase)
    const conf = PHASE_CONFIG[phase]
    const months = client.subscription_start ? getMonthsElapsed(client.subscription_start) : 0

    return (
      <div key={`${client.id}-${phase}`} className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${compact ? 'hover:bg-[#F2E8DF]/50' : 'bg-white hover:bg-[#F9F5F0]'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => toggleBilan(client.id, phase)}
            className="flex-shrink-0"
          >
            {bilan?.completed ? (
              <CheckCircle2 size={20} className="text-[#7B9E6B]" />
            ) : (
              <Circle size={20} className="text-[#DCCFBF] hover:text-[#C6684F]" />
            )}
          </button>
          <div className="w-8 h-8 rounded-full bg-[#F2E8DF] flex items-center justify-center text-xs font-medium text-[#6B6359] flex-shrink-0">
            {client.avatar_url ? (
              <img src={client.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              getInitials(client.first_name, client.last_name)
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#2C2C2C] truncate">{client.first_name} {client.last_name}</p>
            <p className="text-xs text-[#A09488]">
              {LEVEL_LABELS[client.practice_level || ''] || 'N/A'} · {months} mois
              {bilan?.completed_at && <span className="text-[#7B9E6B]"> · fait le {new Date(bilan.completed_at).toLocaleDateString('fr-FR')}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {bilan?.notes && (
            <span className="w-2 h-2 bg-[#D4A056] rounded-full" title="Notes disponibles" />
          )}
          <button
            onClick={() => setNotesModal({ userId: client.id, phase, notes: bilan?.notes || '' })}
            className="p-1.5 rounded-md hover:bg-[#F2E8DF] text-[#A09488] hover:text-[#6B6359] transition-colors"
            title="Notes"
          >
            <StickyNote size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-[#2C2C2C]">Bilans clientes</h2>
          <p className="text-sm text-[#A09488] mt-1">Suivi des 3 bilans par cliente au cours de l'accompagnement</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#C6684F]">{totalBilansDone}<span className="text-sm text-[#A09488] font-normal">/{totalBilansPossible}</span></p>
          <p className="text-xs text-[#A09488]">bilans réalisés</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {phases.map(phase => {
          const conf = PHASE_CONFIG[phase]
          const clientsInPhase = filtered.filter(c => getClientPhase(c.subscription_start) === phase)
          const done = clientsInPhase.filter(c => getBilan(c.id, phase)?.completed).length
          return (
            <Card key={phase} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: conf.color }} />
                <span className="text-sm font-medium text-[#2C2C2C]">{conf.label}</span>
                <span className="text-xs text-[#A09488]">({conf.subtitle})</span>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-xl font-bold" style={{ color: conf.color }}>{done}<span className="text-sm text-[#A09488] font-normal">/{clientsInPhase.length}</span></p>
                <p className="text-xs text-[#A09488]">{clientsInPhase.length > 0 ? Math.round((done / clientsInPhase.length) * 100) : 0}%</p>
              </div>
              <div className="mt-2 h-1.5 bg-[#F2E8DF] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${clientsInPhase.length > 0 ? (done / clientsInPhase.length) * 100 : 0}%`, backgroundColor: conf.color }} />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A09488]" />
          <input
            type="text"
            placeholder="Rechercher une cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#DCCFBF] rounded-xl text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C6684F]/20"
          />
        </div>
        <div className="flex bg-white border border-[#DCCFBF] rounded-xl overflow-hidden">
          {([
            { key: 'phases' as ViewMode, icon: LayoutGrid, label: 'Par phase' },
            { key: 'liste' as ViewMode, icon: List, label: 'Liste' },
            { key: 'clientes' as ViewMode, icon: Users, label: 'Par cliente' },
          ]).map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${view === v.key ? 'bg-[#C6684F] text-white' : 'text-[#6B6359] hover:bg-[#F2E8DF]'}`}
            >
              <v.icon size={14} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* À classer banner (all views) */}
      {filteredUnclassified.length > 0 && (
        <Card className="overflow-hidden border-dashed border-[#D4A056]">
          <button
            onClick={() => setExpandedPhases(prev => ({ ...prev, aclasser: !prev.aclasser }))}
            className="w-full flex items-center justify-between p-4 hover:bg-[#FDF6EC] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FDF6EC]">
                <AlertTriangle size={20} className="text-[#D4A056]" />
              </div>
              <div className="text-left">
                <p className="font-medium text-[#2C2C2C]">À classer</p>
                <p className="text-xs text-[#A09488]">{filteredUnclassified.length} cliente{filteredUnclassified.length > 1 ? 's' : ''} sans date d'abonnement</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#D4A056] bg-[#FDF6EC] px-2 py-1 rounded-full">{filteredUnclassified.length}</span>
              {expandedPhases.aclasser ? <ChevronUp size={18} className="text-[#A09488]" /> : <ChevronDown size={18} className="text-[#A09488]" />}
            </div>
          </button>

          {expandedPhases.aclasser && (
            <div className="border-t border-[#DCCFBF] p-3 space-y-1">
              {filteredUnclassified.map(client => (
                <div key={client.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white hover:bg-[#F9F5F0] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#F2E8DF] flex items-center justify-center text-xs font-medium text-[#6B6359] flex-shrink-0">
                      {client.avatar_url ? (
                        <img src={client.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        getInitials(client.first_name, client.last_name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#2C2C2C] truncate">{client.first_name} {client.last_name}</p>
                      <p className="text-xs text-[#A09488]">{LEVEL_LABELS[client.practice_level || ''] || 'N/A'} · Inscrite le {new Date(client.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#D4A056] bg-[#FDF6EC] px-2 py-0.5 rounded-full font-medium flex-shrink-0">Date manquante</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* VIEW: Par phase */}
      {view === 'phases' && (
        <div className="space-y-4">
          {phases.map(phase => {
            const conf = PHASE_CONFIG[phase]
            const clientsInPhase = filtered.filter(c => getClientPhase(c.subscription_start) === phase)
            const done = clientsInPhase.filter(c => getBilan(c.id, phase)?.completed)
            const notDone = clientsInPhase.filter(c => !getBilan(c.id, phase)?.completed)
            const expanded = expandedPhases[phase]

            return (
              <Card key={phase} className="overflow-hidden">
                <button
                  onClick={() => setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#F9F5F0] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: conf.bgLight }}>
                      <ClipboardCheck size={20} style={{ color: conf.color }} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[#2C2C2C]">Bilan {conf.label}</p>
                      <p className="text-xs text-[#A09488]">{conf.subtitle} · {done.length}/{clientsInPhase.length} réalisés</p>
                    </div>
                  </div>
                  {expanded ? <ChevronUp size={18} className="text-[#A09488]" /> : <ChevronDown size={18} className="text-[#A09488]" />}
                </button>

                {expanded && (
                  <div className="border-t border-[#DCCFBF]">
                    {clientsInPhase.length === 0 ? (
                      <p className="text-sm text-[#A09488] text-center py-6">Aucune cliente dans cette phase</p>
                    ) : (
                      <div className="p-3 space-y-1">
                        {notDone.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-[#C6684F] uppercase tracking-wide px-3 py-1.5">N'a pas encore eu son bilan ({notDone.length})</p>
                            {notDone.map(c => renderClientRow(c, phase))}
                          </>
                        )}
                        {done.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-[#7B9E6B] uppercase tracking-wide px-3 py-1.5 mt-2">A eu son bilan ({done.length})</p>
                            {done.map(c => renderClientRow(c, phase))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* VIEW: Liste complète */}
      {view === 'liste' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DCCFBF]">
                  <th className="text-left px-4 py-3 text-[#6B6359] font-medium">Cliente</th>
                  <th className="text-center px-4 py-3 text-[#6B6359] font-medium">Mois</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: PHASE_CONFIG.debut.color }}>Début</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: PHASE_CONFIG.milieu.color }}>Milieu</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: PHASE_CONFIG.fin.color }}>Fin</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && filteredUnclassified.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-[#A09488]">Aucune cliente</td></tr>
                ) : (<>
                  {filtered.map(client => {
                    const months = client.subscription_start ? getMonthsElapsed(client.subscription_start) : 0
                    const currentPhase = getClientPhase(client.subscription_start)
                    return (
                      <tr key={client.id} className="border-b border-[#F2E8DF] hover:bg-[#F9F5F0] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#F2E8DF] flex items-center justify-center text-xs font-medium text-[#6B6359] flex-shrink-0">
                              {client.avatar_url ? (
                                <img src={client.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                getInitials(client.first_name, client.last_name)
                              )}
                            </div>
                            <span className="font-medium text-[#2C2C2C]">{client.first_name} {client.last_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-[#A09488]">{months}</td>
                        {phases.map(phase => {
                          const bilan = getBilan(client.id, phase)
                          const isCurrentPhase = currentPhase === phase
                          return (
                            <td key={phase} className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => toggleBilan(client.id, phase)}
                                  className={`transition-colors ${isCurrentPhase ? '' : 'opacity-40'}`}
                                >
                                  {bilan?.completed ? (
                                    <CheckCircle2 size={20} className="text-[#7B9E6B]" />
                                  ) : (
                                    <Circle size={20} className="text-[#DCCFBF] hover:text-[#C6684F]" />
                                  )}
                                </button>
                                {bilan?.notes && <span className="w-1.5 h-1.5 bg-[#D4A056] rounded-full" />}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {filteredUnclassified.length > 0 && (
                    <>
                      <tr><td colSpan={5} className="px-4 py-2 text-xs font-semibold text-[#D4A056] uppercase tracking-wide bg-[#FDF6EC]">À classer — date manquante ({filteredUnclassified.length})</td></tr>
                      {filteredUnclassified.map(client => (
                        <tr key={client.id} className="border-b border-[#F2E8DF] hover:bg-[#FDF6EC]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#F2E8DF] flex items-center justify-center text-xs font-medium text-[#6B6359] flex-shrink-0">
                                {client.avatar_url ? (
                                  <img src={client.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                                ) : (
                                  getInitials(client.first_name, client.last_name)
                                )}
                              </div>
                              <span className="font-medium text-[#2C2C2C]">{client.first_name} {client.last_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-[#D4A056]">—</td>
                          <td className="px-4 py-3 text-center text-[#DCCFBF]"><Circle size={20} className="mx-auto opacity-30" /></td>
                          <td className="px-4 py-3 text-center text-[#DCCFBF]"><Circle size={20} className="mx-auto opacity-30" /></td>
                          <td className="px-4 py-3 text-center text-[#DCCFBF]"><Circle size={20} className="mx-auto opacity-30" /></td>
                        </tr>
                      ))}
                    </>
                  )}
                </>)}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* VIEW: Par cliente */}
      {view === 'clientes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.length === 0 && filteredUnclassified.length === 0 ? (
            <p className="text-sm text-[#A09488] col-span-2 text-center py-6">Aucune cliente</p>
          ) : (<>
            {filtered.map(client => {
              const months = client.subscription_start ? getMonthsElapsed(client.subscription_start) : 0
              const currentPhase = getClientPhase(client.subscription_start)
              const bilansDone = phases.filter(p => getBilan(client.id, p)?.completed).length
              return (
                <Card key={client.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-sm font-medium text-[#6B6359]">
                      {client.avatar_url ? (
                        <img src={client.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        getInitials(client.first_name, client.last_name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C2C2C] truncate">{client.first_name} {client.last_name}</p>
                      <p className="text-xs text-[#A09488]">{LEVEL_LABELS[client.practice_level || ''] || 'N/A'} · {months} mois · {bilansDone}/3 bilans</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {phases.map(phase => {
                      const conf = PHASE_CONFIG[phase]
                      const bilan = getBilan(client.id, phase)
                      const isCurrentPhase = currentPhase === phase
                      return (
                        <div
                          key={phase}
                          className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isCurrentPhase ? 'border border-dashed' : 'bg-[#F9F5F0]'}`}
                          style={isCurrentPhase ? { borderColor: conf.color, backgroundColor: conf.bgLight } : {}}
                        >
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleBilan(client.id, phase)}>
                              {bilan?.completed ? (
                                <CheckCircle2 size={18} className="text-[#7B9E6B]" />
                              ) : (
                                <Circle size={18} className="text-[#DCCFBF] hover:text-[#C6684F]" />
                              )}
                            </button>
                            <div>
                              <span className="text-xs font-medium" style={{ color: conf.color }}>{conf.label}</span>
                              <span className="text-xs text-[#A09488] ml-1.5">{conf.subtitle}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {bilan?.completed_at && (
                              <span className="text-[10px] text-[#7B9E6B]">{new Date(bilan.completed_at).toLocaleDateString('fr-FR')}</span>
                            )}
                            {bilan?.notes && <span className="w-1.5 h-1.5 bg-[#D4A056] rounded-full" />}
                            <button
                              onClick={() => setNotesModal({ userId: client.id, phase, notes: bilan?.notes || '' })}
                              className="p-1 rounded hover:bg-white/50 text-[#A09488] hover:text-[#6B6359]"
                            >
                              <StickyNote size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
            {filteredUnclassified.map(client => (
              <Card key={client.id} className="p-4 border-dashed border-[#D4A056]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-sm font-medium text-[#6B6359]">
                    {client.avatar_url ? (
                      <img src={client.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      getInitials(client.first_name, client.last_name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#2C2C2C] truncate">{client.first_name} {client.last_name}</p>
                    <p className="text-xs text-[#A09488]">{LEVEL_LABELS[client.practice_level || ''] || 'N/A'} · Inscrite le {new Date(client.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FDF6EC]">
                  <AlertTriangle size={14} className="text-[#D4A056] flex-shrink-0" />
                  <p className="text-xs text-[#D4A056]">Date de début d'abonnement à renseigner dans la fiche cliente</p>
                </div>
              </Card>
            ))}
          </>)}
        </div>
      )}

      {/* Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setNotesModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#DCCFBF]">
              <div>
                <h3 className="font-medium text-[#2C2C2C]">Notes — Bilan {PHASE_CONFIG[notesModal.phase].label}</h3>
                <p className="text-xs text-[#A09488]">
                  {clients.find(c => c.id === notesModal.userId)?.first_name} {clients.find(c => c.id === notesModal.userId)?.last_name}
                </p>
              </div>
              <button onClick={() => setNotesModal(null)} className="p-1.5 hover:bg-[#F2E8DF] rounded-lg text-[#A09488]">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={notesModal.notes}
                onChange={e => setNotesModal(prev => prev ? { ...prev, notes: e.target.value } : null)}
                placeholder="Ajouter des notes sur ce bilan..."
                rows={5}
                autoCapitalize="sentences"
                className="w-full border border-[#DCCFBF] rounded-xl p-3 text-sm text-[#2C2C2C] resize-none focus:outline-none focus:ring-2 focus:ring-[#C6684F]/20"
              />
            </div>
            <div className="flex justify-end gap-2 px-4 pb-4">
              <button onClick={() => setNotesModal(null)} className="px-4 py-2 text-sm text-[#6B6359] hover:bg-[#F2E8DF] rounded-xl">
                Annuler
              </button>
              <button onClick={saveNotes} disabled={savingNotes} className="px-4 py-2 text-sm bg-[#C6684F] text-white rounded-xl hover:bg-[#b55a43] disabled:opacity-50">
                {savingNotes ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
