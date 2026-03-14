'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { MessageSquare, Send, ArrowLeft, Search, Plus, Check, CheckCheck } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import type { DirectMessage } from '@/types/database'
import Image from 'next/image'

type ClientProfile = {
  id: string
  first_name: string
  last_name: string
  username: string
  avatar_url: string | null
}

type ConvPreview = {
  client: ClientProfile
  lastMessage: string | null
  lastAt: string | null
  unreadCount: number
  hasConversation: boolean
}

export default function AdminMessagesPage() {
  const { profile } = useAuthStore()
  const myId = profile?.id

  const [clients, setClients] = useState<ConvPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [activeClient, setActiveClient] = useState<ClientProfile | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const msgListRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // ── Load all clients + conversation status ──────────────────────────────
  const loadClients = useCallback(async () => {
    if (!myId || !isSupabaseConfigured()) return
    setLoading(true)

    // Get all non-admin profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username, avatar_url')
      .eq('is_admin', false)
      .order('first_name')

    if (!profiles || profiles.length === 0) {
      setClients([])
      setLoading(false)
      return
    }

    // Get all DMs involving admin
    const { data: dms } = await supabase
      .from('direct_messages')
      .select('sender_id, receiver_id, content, image_url, file_name, created_at, read_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false })

    const allDms = dms ?? []

    // Build per-client stats
    const statsMap = new Map<string, { lastMessage: string | null; lastAt: string | null; unreadCount: number; hasConversation: boolean }>()

    profiles.forEach(p => statsMap.set(p.id, { lastMessage: null, lastAt: null, unreadCount: 0, hasConversation: false }))

    allDms.forEach(m => {
      const otherId = m.sender_id === myId ? m.receiver_id : m.sender_id
      const s = statsMap.get(otherId)
      if (!s) return
      s.hasConversation = true
      if (!s.lastAt || m.created_at > s.lastAt) {
        s.lastAt = m.created_at
        s.lastMessage = m.content || (m.image_url ? '📷 Photo' : m.file_name ? `📎 ${m.file_name}` : '')
      }
      if (m.receiver_id === myId && !m.read_at) s.unreadCount++
    })

    const result: ConvPreview[] = profiles.map(p => ({
      client: p as ClientProfile,
      ...(statsMap.get(p.id) ?? { lastMessage: null, lastAt: null, unreadCount: 0, hasConversation: false }),
    }))

    // Sort: unread first, then by last message date, then clients without conversation last
    result.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1
      if (a.hasConversation && !b.hasConversation) return -1
      if (!a.hasConversation && b.hasConversation) return 1
      if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt)
      return a.client.first_name.localeCompare(b.client.first_name)
    })

    setClients(result)
    setLoading(false)
  }, [myId])

  useEffect(() => { loadClients() }, [loadClients])

  // ── Load messages for active conversation ───────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!myId || !activeClient || !isSupabaseConfigured()) return
    setLoadingMsgs(true)
    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${activeClient.id}),and(sender_id.eq.${activeClient.id},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true })

    setMessages(msgs ?? [])
    setLoadingMsgs(false)

    // Mark received as read
    const unread = (msgs ?? []).filter(m => m.receiver_id === myId && !m.read_at).map(m => m.id)
    if (unread.length) {
      await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', unread)
      loadClients()
    }
  }, [myId, activeClient])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Real-time listener
  useEffect(() => {
    if (!myId || !isSupabaseConfigured()) return
    const channel = supabase.channel(`admin-dm-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${myId}` }, (payload) => {
        const msg = payload.new as DirectMessage
        if (activeClient && msg.sender_id === activeClient.id) {
          setMessages(prev => [...prev, msg])
          supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).then(() => loadClients())
        } else {
          loadClients()
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${myId}` }, (payload) => {
        const msg = payload.new as DirectMessage
        if (activeClient && msg.receiver_id === activeClient.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [myId, activeClient])

  // ── Send message ────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!myId || !activeClient || !inputText.trim() || sending) return
    setSending(true)
    const text = inputText.trim()
    setInputText('')

    const { data, error } = await supabase.from('direct_messages')
      .insert({ sender_id: myId, receiver_id: activeClient.id, content: text })
      .select().single()

    if (!error && data) {
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev
        return [...prev, data]
      })
    }
    setSending(false)
    loadClients()
  }

  // ── Open conversation (create welcome if needed) ────────────────────────
  async function openConversation(conv: ConvPreview) {
    setActiveClient(conv.client)
    if (!conv.hasConversation) {
      // Create welcome message via API
      await fetch('/api/welcome-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: conv.client.id }),
      })
    }
  }

  // ── Filtered clients ───────────────────────────────────────────────────
  const filtered = search.trim()
    ? clients.filter(c => {
        const q = search.toLowerCase()
        return c.client.first_name.toLowerCase().includes(q)
          || c.client.last_name.toLowerCase().includes(q)
          || c.client.username.toLowerCase().includes(q)
      })
    : clients

  const withConv = filtered.filter(c => c.hasConversation)
  const withoutConv = filtered.filter(c => !c.hasConversation)

  if (!isSupabaseConfigured()) return <p className="text-[#6B6359]">Supabase non configuré.</p>

  return (
    <div className="flex h-[calc(100vh-120px)] -m-6">
      {/* ── Left: Client list ─────────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-[#DCCFBF] bg-white w-80 flex-shrink-0 ${activeClient ? 'hidden lg:flex' : 'flex'}`}>
        <div className="px-4 py-3 border-b border-[#DCCFBF]">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={18} className="text-[#C6684F]" />
            <h2 className="font-serif text-lg text-[#2C2C2C]">Messages</h2>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A09488]" />
            <input
              type="text"
              placeholder="Rechercher une cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-[#DCCFBF] rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Conversations actives */}
              {withConv.length > 0 && (
                <div>
                  {withConv.map(conv => (
                    <button
                      key={conv.client.id}
                      onClick={() => openConversation(conv)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#FAF6F1] transition border-b border-[#F2E8DF] ${
                        activeClient?.id === conv.client.id ? 'bg-[#FAF6F1]' : ''
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        {conv.client.avatar_url ? (
                          <Image src={conv.client.avatar_url} alt="" width={40} height={40} className="rounded-full object-cover" style={{ width: 40, height: 40 }} />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-sm">
                            {conv.client.first_name.charAt(0)}
                          </div>
                        )}
                        {conv.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#C6684F] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-[#2C2C2C]' : 'font-medium text-[#2C2C2C]'}`}>
                            {conv.client.first_name} {conv.client.last_name}
                          </p>
                          {conv.lastAt && (
                            <span className="text-[10px] text-[#A09488] flex-shrink-0 ml-2">
                              {formatRelativeDate(conv.lastAt)}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-[#2C2C2C] font-medium' : 'text-[#A09488]'}`}>
                          {conv.lastMessage || 'Aucun message'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Clients sans conversation */}
              {withoutConv.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-[#FAF6F1] border-b border-[#DCCFBF]">
                    <p className="text-[10px] font-semibold text-[#A09488] uppercase tracking-wider">
                      Sans conversation ({withoutConv.length})
                    </p>
                  </div>
                  {withoutConv.map(conv => (
                    <button
                      key={conv.client.id}
                      onClick={() => openConversation(conv)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#FAF6F1] transition border-b border-[#F2E8DF]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#A09488] flex-shrink-0">
                        {conv.client.first_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#6B6359]">{conv.client.first_name} {conv.client.last_name}</p>
                        <p className="text-[11px] text-[#A09488]">@{conv.client.username}</p>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#C6684F]/10 text-[#C6684F]">
                        <Plus size={12} />
                        <span className="text-[10px] font-medium">Ouvrir</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filtered.length === 0 && !loading && (
                <p className="text-sm text-[#A09488] text-center py-8">Aucune cliente trouvée</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Conversation ───────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col bg-[#FAF6F1] ${activeClient ? 'flex' : 'hidden lg:flex'}`}>
        {activeClient ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-[#DCCFBF] px-4 py-3 flex items-center gap-3">
              <button onClick={() => setActiveClient(null)} className="lg:hidden p-1 rounded-lg hover:bg-[#F2E8DF] text-[#6B6359]">
                <ArrowLeft size={18} />
              </button>
              {activeClient.avatar_url ? (
                <Image src={activeClient.avatar_url} alt="" width={36} height={36} className="rounded-full object-cover" style={{ width: 36, height: 36 }} />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#F2E8DF] flex items-center justify-center text-[#C6684F] font-semibold text-sm">
                  {activeClient.first_name.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold text-sm text-[#2C2C2C]">{activeClient.first_name} {activeClient.last_name}</p>
                <p className="text-[11px] text-[#A09488]">@{activeClient.username}</p>
              </div>
            </div>

            {/* Messages */}
            <div ref={msgListRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare size={40} className="text-[#DCCFBF] mb-3" />
                  <p className="text-sm text-[#A09488]">Aucun message avec {activeClient.first_name}</p>
                  <p className="text-xs text-[#DCCFBF] mt-1">Envoie un message pour démarrer la conversation</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isOwn = msg.sender_id === myId
                    const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString()
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-3">
                            <span className="text-[10px] text-[#A09488] bg-white px-3 py-1 rounded-full border border-[#DCCFBF]">
                              {new Date(msg.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            isOwn
                              ? 'bg-[#C6684F] text-white rounded-br-md'
                              : 'bg-white text-[#2C2C2C] border border-[#DCCFBF] rounded-bl-md'
                          }`}>
                            {msg.image_url && (
                              <img src={msg.image_url} alt="" className="rounded-lg mb-2 max-w-full max-h-60 object-cover" />
                            )}
                            {msg.content && (
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                            <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-[#A09488]'}`}>
                                {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isOwn && (
                                msg.read_at
                                  ? <CheckCheck size={12} className="text-white/60" />
                                  : <Check size={12} className="text-white/40" />
                              )}
                              {msg.edited_at && (
                                <span className={`text-[9px] ${isOwn ? 'text-white/40' : 'text-[#DCCFBF]'}`}>modifié</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="bg-white border-t border-[#DCCFBF] px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                  }}
                  placeholder={`Message à ${activeClient.first_name}...`}
                  rows={1}
                  autoCapitalize="sentences"
                  className="flex-1 text-sm border border-[#DCCFBF] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C6684F] bg-[#FAF6F1] resize-none max-h-32"
                  style={{ minHeight: '42px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || sending}
                  className="p-2.5 rounded-xl bg-[#C6684F] text-white hover:bg-[#b05a42] disabled:opacity-40 transition flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <MessageSquare size={48} className="text-[#DCCFBF] mb-4" />
            <p className="text-[#6B6359] font-medium">Messages privés</p>
            <p className="text-sm text-[#A09488] mt-1">Sélectionne une cliente pour voir la conversation</p>
          </div>
        )}
      </div>
    </div>
  )
}
