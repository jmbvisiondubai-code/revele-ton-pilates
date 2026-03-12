'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, ArrowLeft, MessageSquare } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { formatRelativeDate } from '@/lib/utils'
import type { DirectMessage } from '@/types/database'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type ConvProfile = {
  id: string
  first_name: string
  avatar_url: string | null
}

type ConversationPreview = {
  partner: ConvProfile
  lastMessage: string | null
  lastAt: string | null
  unreadCount: number
}

export default function MessagesPage() {
  const { profile } = useAuthStore()
  const myId = profile?.id
  const isAdmin = profile?.is_admin ?? false
  const router = useRouter()

  const [convs, setConvs] = useState<ConversationPreview[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState<ConvProfile | null>(null)
  const [showCommunaute, setShowCommunaute] = useState(false)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [showList, setShowList] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load conversation list ─────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()

    const { data: dms } = await supabase
      .from('direct_messages')
      .select('sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false })

    // Build map: partnerId -> preview
    const partnerMap = new Map<string, { lastMessage: string; lastAt: string; unreadCount: number }>()
    for (const dm of (dms ?? [])) {
      const partnerId = dm.sender_id === myId ? dm.receiver_id : dm.sender_id
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { lastMessage: dm.content, lastAt: dm.created_at, unreadCount: 0 })
      }
      if (dm.receiver_id === myId && !dm.read_at) {
        partnerMap.get(partnerId)!.unreadCount++
      }
    }

    // Load profiles
    let profiles: ConvProfile[] = []
    if (isAdmin) {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url')
        .eq('is_admin', false)
        .order('first_name')
      profiles = data ?? []
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url')
        .eq('is_admin', true)
        .limit(1)
      profiles = data ?? []
    }

    const result: ConversationPreview[] = profiles.map(p => ({
      partner: p,
      lastMessage: partnerMap.get(p.id)?.lastMessage ?? null,
      lastAt: partnerMap.get(p.id)?.lastAt ?? null,
      unreadCount: partnerMap.get(p.id)?.unreadCount ?? 0,
    }))

    result.sort((a, b) => {
      if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt)
      if (a.lastAt) return -1
      if (b.lastAt) return 1
      return a.partner.first_name.localeCompare(b.partner.first_name)
    })

    setConvs(result)
    setLoadingConvs(false)
  }, [myId, isAdmin])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // ── Load messages for active conversation ──────────────────────────────────
  const loadMessages = useCallback(async (partnerId: string) => {
    if (!myId || !isSupabaseConfigured()) return
    setLoadingMsgs(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myId})`
      )
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoadingMsgs(false)

    // Mark incoming messages as read
    supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', myId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
      .then(() => loadConversations())
  }, [myId, loadConversations])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
  }, [activeId, loadMessages])

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()

    const channel = supabase
      .channel(`dm-inbox-${myId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${myId}`,
      }, (payload) => {
        const msg = payload.new as DirectMessage
        if (msg.sender_id === activeId) {
          setMessages(prev => [...prev, msg])
          supabase.from('direct_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', msg.id)
            .then(() => {})
        }
        loadConversations()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [myId, activeId, loadConversations])

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!myId || !activeId || !inputText.trim() || !isSupabaseConfigured()) return
    const text = inputText.trim()
    setInputText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const optimistic: DirectMessage = {
      id: `opt-${Date.now()}`,
      sender_id: myId,
      receiver_id: activeId,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
      edited_at: null,
    }
    setMessages(prev => [...prev, optimistic])

    const supabase = createClient()
    const { data, error } = await supabase
      .from('direct_messages')
      .insert({ sender_id: myId, receiver_id: activeId, content: text })
      .select()
      .single()

    if (!error && data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
      loadConversations()
    }
  }

  function openConversation(conv: ConversationPreview) {
    setActiveId(conv.partner.id)
    setActiveProfile(conv.partner)
    setShowCommunaute(false)
    setShowList(false)
  }

  // ── Avatar helper ──────────────────────────────────────────────────────────
  function ProfileAvatar({ p, size = 48 }: { p: ConvProfile; size?: number }) {
    if (p.avatar_url) {
      return <Image src={p.avatar_url} alt={p.first_name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
    }
    return (
      <div
        className="rounded-full bg-[#E8D5C4] flex items-center justify-center text-[#C6684F] font-semibold flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {p.first_name.charAt(0).toUpperCase()}
      </div>
    )
  }

  // ── Not configured ─────────────────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-2rem)]">
        <div className="text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#F2E8DF] flex items-center justify-center mx-auto mb-3">
            <MessageSquare size={24} className="text-[#C6684F]" />
          </div>
          <p className="font-serif text-lg text-[#2C2C2C] font-semibold mb-1">Messages privés</p>
          <p className="text-sm text-[#A09488]">Configurez Supabase pour activer la messagerie.</p>
        </div>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-2rem)] overflow-hidden -mt-0">

      {/* ── Conversation list ─────────────────────────────────────────────── */}
      <div className={`
        flex-col w-full lg:w-80 lg:flex-shrink-0
        border-r border-[#DCCFBF] bg-white overflow-hidden
        ${showList ? 'flex' : 'hidden lg:flex'}
      `}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-[#DCCFBF] flex-shrink-0">
          <h1 className="font-serif text-xl text-[#2C2C2C] font-semibold">Messages</h1>
        </div>

        {/* Communauté — always first */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              router.push('/communaute')
            } else {
              setShowCommunaute(true)
              setActiveId(null)
              setActiveProfile(null)
              setShowList(false)
            }
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F1] transition-colors border-b border-[#EDE5DA] flex-shrink-0 text-left ${showCommunaute && !activeId ? 'bg-[#F2E8DF]' : ''}`}
        >
          <div className="w-12 h-12 rounded-full bg-[#F2E8DF] flex items-center justify-center flex-shrink-0">
            <MessageSquare size={22} className="text-[#C6684F]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#2C2C2C] text-sm">Communauté</p>
            <p className="text-xs text-[#A09488] truncate">Discussion de groupe</p>
          </div>
        </button>

        {/* DM list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : convs.length === 0 ? (
            <p className="text-center text-sm text-[#A09488] py-10 px-4">
              {isAdmin ? 'Aucun membre pour l\'instant.' : 'Aucune conversation.'}
            </p>
          ) : (
            convs.map(conv => (
              <button
                key={conv.partner.id}
                onClick={() => openConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F1] transition-colors text-left ${
                  activeId === conv.partner.id ? 'bg-[#F2E8DF]' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <ProfileAvatar p={conv.partner} size={48} />
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#C6684F] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-[#2C2C2C]' : 'font-medium text-[#2C2C2C]'}`}>
                      {conv.partner.first_name}
                    </p>
                    {conv.lastAt && (
                      <span className="text-[10px] text-[#A09488] flex-shrink-0">{formatRelativeDate(conv.lastAt)}</span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-medium text-[#2C2C2C]' : 'text-[#A09488]'}`}>
                    {conv.lastMessage ?? 'Aucun message'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ─────────────────────────────────────────────────────── */}
      <div className={`
        flex-col overflow-hidden
        ${activeId || showCommunaute || !showList ? 'flex flex-1' : 'hidden'}
        lg:flex lg:flex-1
      `}>
        {!activeId && !showCommunaute ? (
          /* Empty state — desktop only */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-[#FAF6F1]">
            <div className="w-16 h-16 rounded-2xl bg-[#F2E8DF] flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-[#C6684F]" />
            </div>
            <p className="font-serif text-lg text-[#2C2C2C] font-semibold mb-1">Sélectionnez une conversation</p>
            <p className="text-sm text-[#A09488]">Choisissez une discussion dans la liste à gauche</p>
          </div>
        ) : showCommunaute && !activeId ? (
          /* Communauté embedded view — desktop */
          <iframe
            src="/communaute"
            className="w-full min-h-0 border-0"
            style={{ flex: 1 }}
            title="Communauté"
          />
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#DCCFBF] flex-shrink-0">
              <button
                onClick={() => { setShowList(true); setActiveId(null); setMessages([]); setShowCommunaute(false) }}
                className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-[#FAF6F1] transition-colors"
              >
                <ArrowLeft size={20} className="text-[#6B6359]" />
              </button>
              {activeProfile && <ProfileAvatar p={activeProfile} size={36} />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#2C2C2C] text-sm">{activeProfile?.first_name}</p>
              </div>
            </div>

            {/* Messages list */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
              style={{ background: 'linear-gradient(to bottom, #FAF6F1, #F5EFE8)' }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-5 h-5 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-sm text-[#A09488]">Commencez la conversation ✨</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === myId
                  const prev = messages[i - 1]
                  const showDate = !prev ||
                    new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] text-[#A09488] bg-[#EDE5DA]/80 rounded-full px-3 py-1">
                            {new Date(msg.created_at).toLocaleDateString('fr-FR', {
                              weekday: 'short', day: 'numeric', month: 'short',
                            })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5`}>
                        <div className={`
                          max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm
                          ${isMe
                            ? 'bg-[#C6684F] text-white rounded-br-sm'
                            : 'bg-white text-[#2C2C2C] rounded-bl-sm border border-[#EDE5DA]'
                          }
                        `}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-0.5 text-right ${isMe ? 'text-white/60' : 'text-[#A09488]'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {msg.edited_at && <span className="ml-1">· modifié</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose bar */}
            <div className="flex-shrink-0 bg-white border-t border-[#DCCFBF] px-4 py-3 safe-bottom">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleInput}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Écrire un message..."
                  rows={1}
                  className="flex-1 resize-none rounded-2xl border border-[#DCCFBF] bg-[#FAF6F1] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#A09488] focus:outline-none focus:border-[#C6684F] transition-colors leading-relaxed"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className="w-10 h-10 flex-shrink-0 rounded-full bg-[#C6684F] flex items-center justify-center disabled:opacity-40 transition-all hover:bg-[#A8543D] active:scale-95"
                >
                  <Send size={16} className="text-white translate-x-px" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
