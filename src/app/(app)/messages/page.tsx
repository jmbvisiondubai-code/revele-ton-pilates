'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Send, ArrowLeft, Smile, Paperclip, X,
  CornerUpLeft, Check, Pencil, Trash2, Pin, PinOff,
  MoreHorizontal, FileText, Archive, ArchiveRestore, ChevronDown,
  EyeOff, Eye, Copy,
} from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { formatRelativeDate, parseTextWithLinks, safeUrl } from '@/lib/utils'
import type { DirectMessage, ReactionType } from '@/types/database'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// ── Constants ────────────────────────────────────────────────────────────────
const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'pouce',           emoji: '👍🏻', label: 'Super' },
  { type: 'coeur',           emoji: '❤️',  label: 'Adore' },
  { type: 'applaudissement', emoji: '👏🏻', label: 'Bravo' },
  { type: 'priere',         emoji: '🙏🏻', label: 'Merci' },
  { type: 'muscle',         emoji: '💪🏻', label: 'Force' },
  { type: 'fete',           emoji: '🎉',  label: 'Youpi' },
  { type: 'feu',            emoji: '🔥',  label: 'Feu'   },
]
const EMPTY_REACTIONS: Record<ReactionType, number> = {
  pouce: 0, coeur: 0, applaudissement: 0, priere: 0, muscle: 0, fete: 0, feu: 0,
}

// ── Types ────────────────────────────────────────────────────────────────────
type ConvProfile    = { id: string; username: string; avatar_url: string | null }
type ConvPreview    = { partner: ConvProfile; lastMessage: string | null; lastAt: string | null; unreadCount: number; isArchived: boolean }
type MsgWithMeta    = DirectMessage & { reaction_counts: Record<ReactionType, number>; user_reactions: ReactionType[] }
type ReplyTarget    = { id: string; preview: string; author: string }
type MsgMenu        = { msgId: string; isOwn: boolean; content: string; isPinned: boolean }
type PendingFile    = { file: File; preview: string | null; isImage: boolean }

// ── Avatar component ─────────────────────────────────────────────────────────
function ProfileAvatar({ p, size = 44 }: { p: ConvProfile; size?: number }) {
  if (p.avatar_url)
    return <Image src={p.avatar_url} alt={p.username} width={size} height={size} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  return (
    <div className="rounded-full bg-[#E8D5C4] flex items-center justify-center text-[#C6684F] font-semibold flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {p.username.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const { profile, setProfile } = useAuthStore()
  const myId    = profile?.id
  const isAdmin = profile?.is_admin ?? false
  const router  = useRouter()

  // ── State ─────────────────────────────────────────────────────────────────
  const [convs,          setConvs]          = useState<ConvPreview[]>([])
  const [loadingConvs,   setLoadingConvs]   = useState(true)
  const [showList,       setShowList]       = useState(true)
  const [showCommunaute, setShowCommunaute] = useState(false)
  const [showArchived,   setShowArchived]   = useState(false)
  const [convSwipeId,    setConvSwipeId]    = useState<string | null>(null)
  const [convMenuId,     setConvMenuId]     = useState<string | null>(null)
  const [convMenuPos,    setConvMenuPos]    = useState<{ top: number; right: number } | null>(null)

  // Active conversation
  const [activeId,      setActiveId]      = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState<ConvProfile | null>(null)

  // Messages
  const [messages,    setMessages]    = useState<MsgWithMeta[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [inputText,   setInputText]   = useState('')
  const [replyingTo,  setReplyingTo]  = useState<ReplyTarget | null>(null)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Interaction
  const [msgMenu,        setMsgMenu]        = useState<MsgMenu | null>(null)
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [editText,       setEditText]       = useState('')
  const [deletingMsgId,  setDeletingMsgId]  = useState<string | null>(null)
  const [highlightMsg,   setHighlightMsg]   = useState<string | null>(null)
  const [hoverReaction,  setHoverReaction]  = useState<string | null>(null)
  const [swipingMsg,     setSwipingMsg]     = useState<{ msgId: string; deltaX: number } | null>(null)
  const [doubleTapHeart, setDoubleTapHeart] = useState<string | null>(null)

  // Refs
  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const msgListRef      = useRef<HTMLDivElement>(null)
  const textareaRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const longPressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef   = useRef<{ x: number; y: number } | null>(null)
  const convTouchRef    = useRef<{ startX: number; startY: number } | null>(null)
  const lastTapRef      = useRef<{ msgId: string; time: number } | null>(null)

  // ── Self-load profile if Zustand store is empty ──────────────────────────
  useEffect(() => {
    if (profile || !isSupabaseConfigured()) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoadingConvs(false); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
      else setLoadingConvs(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load conversations ───────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    let resolvedId = myId
    if (!resolvedId) {
      const { data: { user } } = await supabase.auth.getUser()
      resolvedId = user?.id
    }
    if (!resolvedId) { setLoadingConvs(false); return }

    setLoadingConvs(true)

    // Fetch all DMs involving this user
    const { data: sent }     = await supabase.from('direct_messages').select('*').eq('sender_id', resolvedId).order('created_at', { ascending: false })
    const { data: received } = await supabase.from('direct_messages').select('*').eq('receiver_id', resolvedId).order('created_at', { ascending: false })
    const allMsgs = [...(sent ?? []), ...(received ?? [])]

    // Build partner list
    const partnerIds = new Set<string>()
    allMsgs.forEach(m => {
      const other = m.sender_id === resolvedId ? m.receiver_id : m.sender_id
      partnerIds.add(other)
    })

    // Fetch partner profiles
    const ids = [...partnerIds]
    if (ids.length === 0) { setConvs([]); setLoadingConvs(false); return }
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)

    // Compute per-partner stats
    type Stats = { lastMessage: string | null; lastAt: string | null; unreadCount: number }
    const partnerMap = new Map<string, Stats>()
    ids.forEach(id => partnerMap.set(id, { lastMessage: null, lastAt: null, unreadCount: 0 }))
    allMsgs.forEach(m => {
      const other = m.sender_id === resolvedId ? m.receiver_id : m.sender_id
      const s = partnerMap.get(other)!
      if (!s.lastAt || m.created_at > s.lastAt) {
        s.lastAt = m.created_at
        s.lastMessage = m.content || (m.image_url ? '📷 Photo' : m.file_name ? `📎 ${m.file_name}` : '')
      }
      if (m.receiver_id === resolvedId && !m.read_at) s.unreadCount++
    })

    // Fetch archived set (admin only)
    const archivedSet = new Set<string>()
    if (isAdmin || profile?.is_admin) {
      const { data: archived } = await supabase.from('dm_archived_conversations').select('client_id').eq('admin_id', resolvedId)
      ;(archived ?? []).forEach(a => archivedSet.add(a.client_id))
    }

    const result: ConvPreview[] = (profiles ?? []).map(p => ({
      partner: p as ConvProfile,
      lastMessage: partnerMap.get(p.id)?.lastMessage ?? null,
      lastAt: partnerMap.get(p.id)?.lastAt ?? null,
      unreadCount: partnerMap.get(p.id)?.unreadCount ?? 0,
      isArchived: archivedSet.has(p.id),
    }))
    result.sort((a, b) => {
      if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1
      if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt)
      return a.partner.username.localeCompare(b.partner.username)
    })
    setConvs(result)
    setLoadingConvs(false)
  }, [myId, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadConversations() }, [loadConversations])

  // Restore active conversation from sessionStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('dm_active_conv') : null
    if (saved) { setActiveId(saved); setShowList(false) }
  }, [])
  useEffect(() => {
    if (activeId && !activeProfile && convs.length > 0) {
      const conv = convs.find(c => c.partner.id === activeId)
      if (conv) setActiveProfile(conv.partner)
      else { setActiveId(null); setShowList(true); sessionStorage.removeItem('dm_active_conv') }
    }
  }, [convs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load messages ────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!myId || !activeId || !isSupabaseConfigured()) return
    setLoadingMsgs(true)
    const supabase = createClient()
    const { data: msgs } = await supabase
      .from('direct_messages').select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${activeId}),and(sender_id.eq.${activeId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true })

    const { data: rxns } = isSupabaseConfigured()
      ? await supabase.from('direct_message_reactions').select('message_id, user_id, reaction_type').in('message_id', (msgs ?? []).map(m => m.id))
      : { data: [] as { message_id: string; user_id: string; reaction_type: string }[] }

    const msgsWithMeta: MsgWithMeta[] = (msgs ?? []).map(msg => {
      const msgRxns = (rxns ?? []).filter(r => r.message_id === msg.id)
      const reaction_counts = { ...EMPTY_REACTIONS }
      msgRxns.forEach(r => { if (r.reaction_type in reaction_counts) reaction_counts[r.reaction_type as ReactionType]++ })
      const user_reactions = msgRxns.filter(r => r.user_id === myId).map(r => r.reaction_type as ReactionType)
      return { ...msg, reaction_counts, user_reactions }
    })

    setMessages(msgsWithMeta)
    setLoadingMsgs(false)

    // Mark received messages as read
    const unread = (msgs ?? []).filter(m => m.receiver_id === myId && !m.read_at).map(m => m.id)
    if (unread.length) {
      await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', unread)
      loadConversations()
    }
  }, [myId, activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMessages() }, [loadMessages])

  // Real-time new message listener
  useEffect(() => {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()
    const channel = supabase.channel(`dm-inbox-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${myId}` }, (payload) => {
        const msg = payload.new as DirectMessage
        if (msg.sender_id === activeId) {
          setMessages(prev => [...prev, { ...msg, reaction_counts: { ...EMPTY_REACTIONS }, user_reactions: [] }])
          supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).then(() => loadConversations())
        } else {
          loadConversations()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [myId, activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Non-passive touchmove on messages list to allow preventDefault on horizontal swipe (iOS fix)
  useEffect(() => {
    const el = msgListRef.current
    if (!el) return
    function onTouchMove(e: TouchEvent) {
      if (!touchStartRef.current) return
      const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x)
      const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y)
      if (dx > dy && dx > 8) e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  // ── Scroll to message (reply navigation) ────────────────────────────────
  function scrollToMsg(msgId: string) {
    const el = document.getElementById(`msg-${msgId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightMsg(msgId)
    setTimeout(() => setHighlightMsg(null), 1400)
  }

  // ── Gesture handlers (mobile swipe-to-reply + long-press menu) ──────────
  function startGesture(msgId: string, isOwn: boolean, content: string, isPinned: boolean, x: number, y: number) {
    touchStartRef.current = { x, y }
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      setMsgMenu({ msgId, isOwn, content, isPinned })
    }, 500)
  }
  function moveGesture(msgId: string, x: number, y: number) {
    if (!touchStartRef.current) return
    const dx = x - touchStartRef.current.x
    const dy = Math.abs(y - touchStartRef.current.y)
    if (dx > 8 && dy < 30) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
      setSwipingMsg({ msgId, deltaX: Math.min(dx, 80) })
    }
  }
  function endGesture(msgId: string, content: string, isOwn: boolean) {
    const wasQuickTap = longPressTimer.current !== null
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (swipingMsg?.msgId === msgId && swipingMsg.deltaX >= 60) {
      const author = isOwn ? (profile?.username ?? 'Toi') : (activeProfile?.username ?? '')
      setReplyingTo({ id: msgId, preview: content.substring(0, 80), author })
    } else if (wasQuickTap) {
      const now = Date.now()
      if (lastTapRef.current?.msgId === msgId && now - lastTapRef.current.time < 350) {
        lastTapRef.current = null
        const msg = messages.find(m => m.id === msgId)
        if (!msg?.user_reactions.includes('coeur')) toggleReaction(msgId, 'coeur')
        setDoubleTapHeart(msgId)
        setTimeout(() => setDoubleTapHeart(null), 700)
      } else {
        lastTapRef.current = { msgId, time: now }
      }
    }
    setSwipingMsg(null)
    touchStartRef.current = null
  }

  // ── Toggle reaction ──────────────────────────────────────────────────────
  async function toggleReaction(messageId: string, type: ReactionType) {
    if (!myId || !isSupabaseConfigured()) return
    const msg = messages.find(m => m.id === messageId)
    const prevType = msg?.user_reactions[0] ?? null
    const isSame   = prevType === type
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m
      const counts = { ...m.reaction_counts }
      if (prevType) counts[prevType] = Math.max(0, counts[prevType] - 1)
      if (!isSame) counts[type] = counts[type] + 1
      return { ...m, reaction_counts: counts, user_reactions: isSame ? [] : [type] }
    }))
    setHoverReaction(null)
    setMsgMenu(null)
    const supabase = createClient()
    if (prevType) await supabase.from('direct_message_reactions').delete().eq('message_id', messageId).eq('user_id', myId)
    if (!isSame)  await supabase.from('direct_message_reactions').insert({ message_id: messageId, user_id: myId, reaction_type: type })
  }

  // ── Send message ─────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!myId || !activeId || (!inputText.trim() && !pendingFile) || isUploading || !isSupabaseConfigured()) return
    const supabase = createClient()
    let image_url: string | null = null, file_url: string | null = null, file_name: string | null = null

    if (pendingFile) {
      setIsUploading(true)
      const ext  = pendingFile.file.name.split('.').pop()
      const path = `dm/${myId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('messages').upload(path, pendingFile.file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('messages').getPublicUrl(path)
        if (pendingFile.isImage) image_url = urlData.publicUrl
        else { file_url = urlData.publicUrl; file_name = pendingFile.file.name }
      }
      setIsUploading(false)
    }

    const text  = inputText.trim()
    const reply = replyingTo
    setInputText(''); setPendingFile(null); setReplyingTo(null)

    const optimistic: MsgWithMeta = {
      id: `opt-${Date.now()}`, sender_id: myId, receiver_id: activeId, content: text,
      created_at: new Date().toISOString(), read_at: null, edited_at: null, is_pinned: false,
      reply_to_id: reply?.id ?? null, reply_to_preview: reply?.preview ?? null, reply_to_author: reply?.author ?? null,
      image_url, file_url, file_name,
      reaction_counts: { ...EMPTY_REACTIONS }, user_reactions: [],
    }
    setMessages(prev => [...prev, optimistic])

    // Auto-unarchive
    if (isAdmin && activeId) {
      const conv = convs.find(c => c.partner.id === activeId)
      if (conv?.isArchived) {
        await supabase.from('dm_archived_conversations').delete().eq('admin_id', myId).eq('client_id', activeId)
      }
    }

    const { data, error } = await supabase.from('direct_messages')
      .insert({ sender_id: myId, receiver_id: activeId, content: text, image_url, file_url, file_name, reply_to_id: reply?.id, reply_to_preview: reply?.preview, reply_to_author: reply?.author })
      .select().single()

    if (!error && data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...data, reaction_counts: { ...EMPTY_REACTIONS }, user_reactions: [] } : m))
      // Push notification to recipient
      const senderName = profile?.username ?? 'Quelqu\'un'
      const preview = text || (image_url ? '📷 Photo' : file_name ? `📎 ${file_name}` : 'Message')
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeId,
          title: `💬 ${senderName}`,
          body: preview.length > 80 ? preview.slice(0, 80) + '…' : preview,
          url: '/messages',
          tag: `dm-${myId}`,
        }),
      }).catch(() => {})
    }
    loadConversations()
  }

  // ── Edit message ─────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editingId || !editText.trim() || !myId) return
    const supabase = createClient()
    await supabase.from('direct_messages').update({ content: editText.trim(), edited_at: new Date().toISOString() }).eq('id', editingId).eq('sender_id', myId)
    setMessages(prev => prev.map(m => m.id === editingId ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() } : m))
    setEditingId(null)
  }

  // ── Delete message ───────────────────────────────────────────────────────
  async function deleteMessage(msgId: string) {
    if (!myId) return
    await createClient().from('direct_messages').delete().eq('id', msgId).eq('sender_id', myId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setDeletingMsgId(null)
    loadConversations()
  }

  // ── Pin message ──────────────────────────────────────────────────────────
  async function togglePin(msgId: string, isPinned: boolean) {
    await createClient().from('direct_messages').update({ is_pinned: !isPinned }).eq('id', msgId)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: !isPinned } : m))
    setMsgMenu(null)
  }

  // ── Archive / Unarchive ──────────────────────────────────────────────────
  async function archiveConversation(partnerId: string) {
    if (!myId || !isAdmin || !isSupabaseConfigured()) return
    await createClient().from('dm_archived_conversations').upsert({ admin_id: myId, client_id: partnerId })
    if (activeId === partnerId) { setActiveId(null); setActiveProfile(null); setMessages([]); setShowList(true) }
    loadConversations()
    setConvMenuId(null); setConvMenuPos(null)
  }
  async function unarchiveConversation(partnerId: string) {
    if (!myId || !isAdmin || !isSupabaseConfigured()) return
    await createClient().from('dm_archived_conversations').delete().eq('admin_id', myId).eq('client_id', partnerId)
    loadConversations()
  }

  // ── Mark as unread ───────────────────────────────────────────────────────
  async function markConvAsUnread(partnerId: string) {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()
    const { data: lastMsg } = await supabase.from('direct_messages').select('id')
      .eq('receiver_id', myId).eq('sender_id', partnerId)
      .order('created_at', { ascending: false }).limit(1).single()
    if (lastMsg) {
      await supabase.from('direct_messages').update({ read_at: null }).eq('id', lastMsg.id)
      loadConversations()
    }
    setConvSwipeId(null); setConvMenuId(null); setConvMenuPos(null)
  }

  // ── Mark as read ─────────────────────────────────────────────────────────
  async function markConvAsRead(partnerId: string) {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', myId).eq('sender_id', partnerId).is('read_at', null)
    loadConversations()
    setConvSwipeId(null); setConvMenuId(null); setConvMenuPos(null)
  }

  // ── Open conversation ────────────────────────────────────────────────────
  function openConversation(conv: ConvPreview) {
    if (typeof window !== 'undefined') sessionStorage.setItem('dm_active_conv', conv.partner.id)
    setActiveId(conv.partner.id)
    setActiveProfile(conv.partner)
    setShowCommunaute(false)
    setShowList(false)
    setConvSwipeId(null)
  }

  // ── File picker ──────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const preview = isImage ? URL.createObjectURL(file) : null
    setPendingFile({ file, preview, isImage })
    e.target.value = ''
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const pinnedMessages      = messages.filter(m => m.is_pinned)
  const activePartnerName   = activeProfile?.username ?? ''
  const activeConvIsArchived = activeId ? (convs.find(c => c.partner.id === activeId)?.isArchived ?? false) : false
  const activeConvUnread    = activeId ? (convs.find(c => c.partner.id === activeId)?.unreadCount ?? 0) : 0

  // ── Conversation swipe touch handlers ────────────────────────────────────
  const convTouchStart = (conv: ConvPreview, e: React.TouchEvent) => {
    if (convSwipeId && convSwipeId !== conv.partner.id) setConvSwipeId(null)
    convTouchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }
  }
  const convTouchEnd = (conv: ConvPreview, e: React.TouchEvent) => {
    if (!convTouchRef.current) return
    const dx = e.changedTouches[0].clientX - convTouchRef.current.startX
    const dy = Math.abs(e.changedTouches[0].clientY - convTouchRef.current.startY)
    convTouchRef.current = null
    if (dy > 20) return
    if (dx < -50) setConvSwipeId(conv.partner.id)
    else if (dx > 20) setConvSwipeId(null)
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-2rem)]">
        <p className="text-sm text-[#A09488]">Configurez Supabase pour activer la messagerie.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-2rem)] overflow-hidden">

      {/* ── Conversation list ──────────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-[#EDE5DA] bg-white w-full lg:w-80 flex-shrink-0 ${showList ? 'flex' : 'hidden'} lg:flex`}>
        <div className="px-4 py-4 border-b border-[#EDE5DA] flex-shrink-0">
          <h1 className="font-serif text-xl font-semibold text-[#2C2C2C]">Messages</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Communauté button */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) router.push('/communaute')
              else { setShowCommunaute(true); setActiveId(null); setActiveProfile(null); setShowList(false) }
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F1] transition-colors border-b border-[#EDE5DA] flex-shrink-0 text-left ${showCommunaute && !activeId ? 'bg-[#F2E8DF]' : ''}`}
          >
            <div className="w-11 h-11 rounded-full bg-[#F2E8DF] flex items-center justify-center flex-shrink-0">
              <MessageSquare size={20} className="text-[#C6684F]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-[#2C2C2C]">Communauté</p>
              <p className="text-xs text-[#A09488] truncate">Discussion de groupe</p>
            </div>
          </button>

          {/* DM list */}
          {loadingConvs ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : convs.length === 0 ? (
            <p className="text-center text-sm text-[#A09488] py-10 px-4">{isAdmin ? 'Aucun membre pour l\'instant.' : 'Aucune conversation.'}</p>
          ) : (
            <>
              {/* Active conversations */}
              {convs.filter(c => !c.isArchived).map(conv => {
                const isUnread = conv.unreadCount > 0
                return (
                <div key={conv.partner.id} className="relative overflow-hidden">
                  {/* Swipe-reveal action buttons (mobile) */}
                  <div className="absolute right-0 top-0 h-full flex">
                    <button
                      onClick={(e) => { e.stopPropagation(); isUnread ? markConvAsRead(conv.partner.id) : markConvAsUnread(conv.partner.id) }}
                      className="w-20 h-full bg-[#5B8DEF] flex flex-col items-center justify-center gap-1"
                    >
                      {isUnread ? <Eye size={15} className="text-white" /> : <EyeOff size={15} className="text-white" />}
                      <span className="text-[10px] text-white font-medium">{isUnread ? 'Lu' : 'Non lu'}</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); archiveConversation(conv.partner.id) }}
                        className="w-20 h-full bg-[#A09488] flex flex-col items-center justify-center gap-1"
                      >
                        <Archive size={15} className="text-white" />
                        <span className="text-[10px] text-white font-medium">Archiver</span>
                      </button>
                    )}
                  </div>
                  {/* Row */}
                  <div
                    className={`relative flex items-center gap-3 px-4 py-3 bg-white cursor-pointer transition-colors group/row ${activeId === conv.partner.id && !showCommunaute ? '!bg-[#F2E8DF]' : 'hover:bg-[#FAF6F1]'}`}
                    style={{ transform: convSwipeId === conv.partner.id ? `translateX(-${isAdmin ? 160 : 80}px)` : 'translateX(0)', transition: 'transform 0.25s ease' }}
                    onClick={() => { if (convSwipeId === conv.partner.id) { setConvSwipeId(null); return } setConvMenuId(null); setConvMenuPos(null); openConversation(conv) }}
                    onTouchStart={(e) => convTouchStart(conv, e)}
                    onTouchEnd={(e) => convTouchEnd(conv, e)}
                  >
                    <ProfileAvatar p={conv.partner} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm text-[#2C2C2C] truncate ${isUnread ? 'font-bold' : 'font-medium'}`}>{conv.partner.username}</p>
                        {conv.lastAt && <span className="text-[10px] text-[#A09488] flex-shrink-0 ml-1">{formatRelativeDate(conv.lastAt)}</span>}
                      </div>
                      <p className={`text-xs truncate ${isUnread ? 'text-[#2C2C2C] font-semibold' : 'text-[#A09488]'}`}>{conv.lastMessage ?? 'Nouveau contact'}</p>
                    </div>
                    {/* Unread badge OR desktop ⋯ menu */}
                    <div className="flex-shrink-0 flex items-center">
                      {isUnread && (
                        <span className="w-5 h-5 rounded-full bg-[#C6684F] text-white text-[10px] font-bold flex items-center justify-center mr-1">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                      {/* Desktop ⋯ button — hidden on mobile */}
                      <div className="hidden md:block" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            if (convMenuId === conv.partner.id) {
                              setConvMenuId(null); setConvMenuPos(null)
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setConvMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setConvMenuId(conv.partner.id)
                            }
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#A09488] hover:bg-[#EDE5DA] hover:text-[#6B6359] transition-colors opacity-0 group-hover/row:opacity-100"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}

              {/* Archived section (admin only) */}
              {isAdmin && convs.some(c => c.isArchived) && (
                <>
                  <button
                    onClick={() => setShowArchived(v => !v)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#A09488] hover:bg-[#FAF6F1] transition-colors border-t border-[#EDE5DA]"
                  >
                    <Archive size={13} />
                    <span>Archivées ({convs.filter(c => c.isArchived).length})</span>
                    <ChevronDown size={13} className={`ml-auto transition-transform ${showArchived ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showArchived && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                        {convs.filter(c => c.isArchived).map(conv => (
                          <div key={conv.partner.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer opacity-70 hover:bg-[#FAF6F1] transition-colors ${activeId === conv.partner.id ? 'bg-[#F2E8DF]' : ''}`} onClick={() => openConversation(conv)}>
                            <ProfileAvatar p={conv.partner} size={44} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-[#2C2C2C] truncate">{conv.partner.username}</p>
                              <p className="text-xs text-[#A09488] truncate">{conv.lastMessage ?? ''}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); unarchiveConversation(conv.partner.id) }}
                              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-[#C6684F] bg-[#F2E8DF] hover:bg-[#EBD9CC] transition-colors"
                            >
                              <ArchiveRestore size={12} /> Désarchiver
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className={`flex-col overflow-hidden bg-[#FAF6F1] ${activeId || showCommunaute || !showList ? 'flex flex-1' : 'hidden'} lg:flex lg:flex-1`}>

        {/* No selection (desktop) */}
        {!activeId && !showCommunaute ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#F2E8DF] flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-[#C6684F]" />
            </div>
            <p className="font-serif text-lg text-[#2C2C2C] font-semibold mb-1">Sélectionnez une conversation</p>
            <p className="text-sm text-[#A09488]">Choisissez une discussion dans la liste à gauche</p>
          </div>

        /* Community iframe */
        ) : showCommunaute && !activeId ? (
          <iframe src="/communaute" className="w-full h-0 flex-1 border-0" title="Communauté" />

        /* DM chat */
        ) : (
          <>
            {/* Backdrop for hover reaction picker */}
            {hoverReaction && (
              <div className="fixed inset-0 z-40" onClick={() => setHoverReaction(null)} />
            )}

            {/* Chat header */}
            <div className="flex-shrink-0 bg-white border-b border-[#DCCFBF]">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  className="lg:hidden mr-1 text-[#6B6359]"
                  onClick={() => { sessionStorage.removeItem('dm_active_conv'); setShowList(true); setActiveId(null); setMessages([]); setShowCommunaute(false) }}
                >
                  <ArrowLeft size={20} />
                </button>
                {activeProfile && <ProfileAvatar p={activeProfile} size={36} />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#2C2C2C]">{activePartnerName}</p>
                  {activeConvUnread > 0 && <p className="text-[10px] text-[#C6684F]">{activeConvUnread} non lu{activeConvUnread > 1 ? 's' : ''}</p>}
                </div>
              </div>
              {/* Archive banner */}
              {activeConvIsArchived && isAdmin && (
                <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#F2E8DF] border-t border-[#DCCFBF]">
                  <div className="flex items-center gap-2 text-xs text-[#6B6359]">
                    <Archive size={13} className="text-[#C6684F]" />
                    <span>Conversation archivée</span>
                  </div>
                  <button onClick={() => unarchiveConversation(activeId!)} className="text-xs font-medium text-[#C6684F] flex items-center gap-1">
                    <ArchiveRestore size={13} /> Désarchiver
                  </button>
                </div>
              )}
            </div>

            {/* Pinned messages — community-style cards */}
            {pinnedMessages.length > 0 && (
              <div className="flex-shrink-0 space-y-2 px-4 pt-2 pb-3 border-b border-[#DCCFBF] bg-gradient-to-b from-white/95 to-white/60 backdrop-blur-sm">
                {pinnedMessages.map(m => {
                  const isMeSender = m.sender_id === myId
                  const senderName = isMeSender ? (profile?.username ?? 'Toi') : activePartnerName
                  const senderAvatar = isMeSender ? profile?.avatar_url : activeProfile?.avatar_url
                  return (
                    <div key={m.id} className="relative rounded-2xl bg-gradient-to-br from-[#FDF0EB] to-[#FAF6F1] border-2 border-[#C6684F]/30 px-4 py-3 shadow-sm">
                      {/* Épinglé badge */}
                      <div className="absolute -top-2.5 left-3 flex items-center gap-1 bg-[#C6684F] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                        <Pin size={10} />
                        Épinglé
                      </div>
                      <div className="flex items-start gap-2.5 mt-1">
                        {/* Avatar */}
                        <div className="flex-shrink-0 mt-0.5">
                          {senderAvatar ? (
                            <Image src={senderAvatar} alt={senderName} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#E8D5C4] flex items-center justify-center text-[#C6684F] font-semibold text-xs">
                              {senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {/* Content */}
                        <button className="flex-1 min-w-0 text-left" onClick={() => scrollToMsg(m.id)}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-bold text-[#C6684F]">{senderName}</span>
                            <span className="text-[10px] text-[#DCCFBF]">{formatRelativeDate(m.created_at)}</span>
                          </div>
                          <p className="text-xs text-[#2C2C2C] leading-relaxed line-clamp-2 whitespace-pre-wrap">
                            {m.content || (m.image_url ? '📷 Photo' : m.file_name ? `📎 ${m.file_name}` : '')}
                          </p>
                        </button>
                        {/* PinOff button — admin only */}
                        {isAdmin && (
                          <button
                            onClick={() => togglePin(m.id, true)}
                            title="Désépingler"
                            className="flex-shrink-0 p-1.5 rounded-full text-[#C6684F]/40 hover:text-[#C6684F] hover:bg-[#C6684F]/10 transition-colors"
                          >
                            <PinOff size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Messages list */}
            <div ref={msgListRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-1" style={{ background: 'linear-gradient(to bottom, #FAF6F1, #F5EFE8)' }}>
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
                  const isMe        = msg.sender_id === myId
                  const prev        = messages[i - 1]
                  const showDate    = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
                  const authorName  = isMe ? (profile?.username ?? 'Toi') : activePartnerName
                  const totalRxn    = Object.values(msg.reaction_counts).reduce((a, b) => a + b, 0)
                  const isEditing   = editingId === msg.id
                  const isSwiping   = swipingMsg?.msgId === msg.id

                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} style={{ transition: 'background 0.4s', borderRadius: '12px', background: highlightMsg === msg.id ? 'rgba(198,104,79,0.15)' : 'transparent' }}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] text-[#A09488] bg-[#EDE5DA]/80 rounded-full px-3 py-1">
                            {new Date(msg.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'} mb-0.5 relative select-none group`}
                        onContextMenu={e => e.preventDefault()}
                        onDoubleClick={() => {
                          const alreadyLiked = msg.user_reactions.includes('coeur')
                          if (!alreadyLiked) toggleReaction(msg.id, 'coeur')
                          setDoubleTapHeart(msg.id)
                          setTimeout(() => setDoubleTapHeart(null), 700)
                        }}
                        onTouchStart={e => startGesture(msg.id, isMe, msg.content, msg.is_pinned ?? false, e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchMove={e => moveGesture(msg.id, e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchEnd={() => endGesture(msg.id, msg.content, isMe)}
                        onTouchCancel={() => { setSwipingMsg(null); touchStartRef.current = null; if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                        onMouseEnter={() => {}}
                        onMouseLeave={() => {}}
                        style={{
                          transform: isSwiping ? `translateX(${swipingMsg!.deltaX}px)` : undefined,
                          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                        }}
                      >
                        {/* Swipe-to-reply indicator */}
                        {isSwiping && swipingMsg!.deltaX > 10 && (
                          <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2`} style={{ opacity: Math.min(swipingMsg!.deltaX / 50, 1) }}>
                            <CornerUpLeft size={16} className="text-[#C6684F]" />
                          </div>
                        )}

                        {/* Desktop hover actions */}
                        <div className={`hidden md:flex flex-row items-center gap-0.5 self-end mb-1 transition-opacity duration-150 ${isMe ? 'order-first mr-1' : 'order-last ml-1'} opacity-0 group-hover:opacity-100`}>
                          {/* Reaction button */}
                          <div className="relative">
                            <button
                              onClick={() => setHoverReaction(hoverReaction === msg.id ? null : msg.id)}
                              className="w-7 h-7 rounded-full bg-white border border-[#EDE5DA] flex items-center justify-center hover:bg-[#F2E8DF] shadow-sm transition-colors"
                            >
                              <Smile size={13} className="text-[#6B6359]" />
                            </button>
                            {hoverReaction === msg.id && (
                              <div className={`absolute top-9 z-50 bg-white rounded-2xl shadow-xl border border-[#DCCFBF] px-2 py-2 flex gap-1 ${isMe ? 'right-0' : 'left-0'}`}>
                                {REACTIONS.map(r => (
                                  <button key={r.type}
                                    onClick={() => { toggleReaction(msg.id, r.type); setHoverReaction(null) }}
                                    className={`text-xl hover:scale-125 transition-transform p-0.5 rounded ${msg.user_reactions.includes(r.type) ? 'ring-2 ring-[#C6684F]/40' : ''}`}
                                    title={r.label}
                                  >
                                    {r.emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Reply */}
                          <button
                            onClick={() => setReplyingTo({ id: msg.id, preview: msg.content.substring(0, 80), author: authorName })}
                            className="w-7 h-7 rounded-full bg-white border border-[#EDE5DA] flex items-center justify-center hover:bg-[#F2E8DF] shadow-sm transition-colors"
                          >
                            <CornerUpLeft size={13} className="text-[#6B6359]" />
                          </button>
                          {/* Three-dot (own + admin) */}
                          {(isMe || isAdmin) && (
                            <div className="relative">
                              <button
                                onClick={() => setMsgMenu(msgMenu?.msgId === msg.id ? null : { msgId: msg.id, isOwn: isMe, content: msg.content, isPinned: msg.is_pinned ?? false })}
                                className="w-7 h-7 rounded-full bg-white border border-[#EDE5DA] flex items-center justify-center hover:bg-[#F2E8DF] shadow-sm transition-colors"
                              >
                                <MoreHorizontal size={13} className="text-[#6B6359]" />
                              </button>
                              <AnimatePresence>
                                {msgMenu?.msgId === msg.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    className={`absolute bottom-full mb-1 z-50 bg-white rounded-xl shadow-lg border border-[#EDE5DA] overflow-hidden min-w-[160px] ${isMe ? 'right-0' : 'left-0'}`}
                                  >
                                    {isMe && (
                                      <>
                                        <button onClick={() => { const m = messages.find(x => x.id === msg.id); if (m) { setEditingId(m.id); setEditText(m.content) } setMsgMenu(null) }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1]">
                                          <Pencil size={14} className="text-[#6B6359]" /> Modifier
                                        </button>
                                        <button onClick={() => { setDeletingMsgId(msg.id); setMsgMenu(null) }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#C94F4F] hover:bg-[#FAF6F1]">
                                          <Trash2 size={14} className="text-[#C94F4F]" /> Supprimer
                                        </button>
                                      </>
                                    )}
                                    {isAdmin && (
                                      <button onClick={() => togglePin(msg.id, msg.is_pinned ?? false)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1]">
                                        {msg.is_pinned ? <PinOff size={14} className="text-[#C6684F]" /> : <Pin size={14} className="text-[#C6684F]" />}
                                        {msg.is_pinned ? 'Désépingler' : 'Épingler'}
                                      </button>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>

                        {/* Bubble */}
                        <div className="max-w-[75%] relative">
                          {/* Double-tap heart animation */}
                          <AnimatePresence>
                            {doubleTapHeart === msg.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.4 }}
                                animate={{ opacity: 1, scale: 1.4 }}
                                exit={{ opacity: 0, scale: 1.8 }}
                                transition={{ duration: 0.25 }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                              >
                                <span className="text-5xl drop-shadow-xl">❤️</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {isEditing ? (
                            <div className="flex items-end gap-1">
                              <textarea
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } if (e.key === 'Escape') setEditingId(null) }}
                                className="rounded-2xl px-3.5 py-2.5 text-sm bg-white border border-[#C6684F] focus:outline-none resize-none min-w-[120px]"
                                rows={2} autoFocus
                              />
                              <button onClick={saveEdit} className="w-7 h-7 rounded-full bg-[#C6684F] flex items-center justify-center flex-shrink-0"><Check size={13} className="text-white" /></button>
                              <button onClick={() => setEditingId(null)} className="w-7 h-7 rounded-full bg-white border border-[#DCCFBF] flex items-center justify-center flex-shrink-0"><X size={13} className="text-[#6B6359]" /></button>
                            </div>
                          ) : (
                            <div className={`rounded-2xl shadow-sm overflow-hidden ${isMe ? 'bg-[#C6684F] text-white rounded-br-sm' : 'bg-white text-[#2C2C2C] rounded-bl-sm border border-[#EDE5DA]'}`}>
                              {/* Reply preview inside bubble */}
                              {msg.reply_to_preview && msg.reply_to_id && (
                                <button
                                  onClick={() => scrollToMsg(msg.reply_to_id!)}
                                  className={`w-full text-left px-3 pt-2.5 pb-2 border-b transition-colors ${isMe ? 'bg-black/20 border-white/15 hover:bg-black/25' : 'bg-[#FAF6F1] border-[#EDE5DA] hover:bg-[#F2E8DF]'}`}
                                >
                                  <div className={`border-l-[3px] pl-2.5 ${isMe ? 'border-white/70' : 'border-[#C6684F]'}`}>
                                    <p className={`text-[10px] font-semibold mb-0.5 ${isMe ? 'text-white/90' : 'text-[#C6684F]'}`}>{msg.reply_to_author}</p>
                                    <p className={`text-xs line-clamp-2 ${isMe ? 'text-white/70' : 'text-[#6B6359]'}`}>{msg.reply_to_preview}</p>
                                  </div>
                                </button>
                              )}
                              {/* Image */}
                              {msg.image_url && (
                                <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={msg.image_url} alt="Photo" className="w-full max-w-[280px] object-cover" style={{ maxHeight: 200, display: 'block' }} />
                                </a>
                              )}
                              {/* File */}
                              {msg.file_url && msg.file_name && (
                                <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3.5 py-2.5 ${msg.content ? 'border-b ' + (isMe ? 'border-white/20' : 'border-[#EDE5DA]') : ''}`}>
                                  <FileText size={18} className={isMe ? 'text-white/80' : 'text-[#C6684F]'} />
                                  <span className={`text-xs font-medium truncate max-w-[160px] ${isMe ? 'text-white/90' : 'text-[#2C2C2C]'}`}>{msg.file_name}</span>
                                </a>
                              )}
                              {/* Text */}
                              {msg.content && (
                                <div className="px-3.5 pt-2.5 pb-1">
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{parseTextWithLinks(msg.content).map((part, i) => part.type === 'url' ? (<button key={i} onClick={e => { e.stopPropagation(); window.open(safeUrl(part.value), '_blank', 'noopener,noreferrer') }} className={`underline underline-offset-2 break-all ${isMe ? 'text-white/90' : 'text-[#C6684F]'}`}>{part.value}</button>) : part.value)}</p>
                                </div>
                              )}
                              {/* Timestamp */}
                              <div className="px-3.5 pb-2 pt-0.5">
                                <p className={`text-[10px] text-right ${isMe ? 'text-white/60' : 'text-[#A09488]'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  {msg.edited_at && <span className="ml-1">· modifié</span>}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Reaction badges — community style */}
                          {totalRxn > 0 && (
                            <button
                              onClick={() => setHoverReaction(hoverReaction === msg.id ? null : msg.id)}
                              className={`flex items-center gap-0.5 mt-1 ${isMe ? 'self-end ml-auto' : 'self-start'}`}
                            >
                              {REACTIONS.filter(r => (msg.reaction_counts[r.type] ?? 0) > 0).slice(0, 3).map(r => (
                                <span key={r.type} className="text-xs leading-none">{r.emoji}</span>
                              ))}
                              <span className="text-[10px] text-[#6B6359] ml-0.5 font-medium">{totalRxn}</span>
                            </button>
                          )}
                        </div>

                        {/* Mobile 3-dot button */}
                        {(isMe || isAdmin) && (
                          <button
                            className={`md:hidden flex-shrink-0 self-end mb-1 w-6 h-6 flex items-center justify-center text-[#C8BFB6] ${isMe ? 'order-first mr-1' : 'order-last ml-1'}`}
                            onTouchStart={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setMsgMenu({ msgId: msg.id, isOwn: isMe, content: msg.content, isPinned: msg.is_pinned ?? false }) }}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Mobile context menu — community style */}
            <AnimatePresence>
              {msgMenu && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center px-6"
                  onClick={() => setMsgMenu(null)}
                >
                  {/* Emoji pill */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="bg-white rounded-full shadow-2xl px-4 py-2.5 flex gap-3 mb-3 w-full max-w-sm justify-around"
                    onClick={e => e.stopPropagation()}
                  >
                    {REACTIONS.map(r => {
                      const selected = messages.find(m => m.id === msgMenu.msgId)?.user_reactions.includes(r.type) ?? false
                      return (
                        <button key={r.type}
                          onClick={() => { toggleReaction(msgMenu.msgId, r.type); setMsgMenu(null) }}
                          className={`relative text-[26px] transition-transform active:scale-110 ${selected ? '-translate-y-1.5 drop-shadow-md' : ''}`}
                        >
                          {r.emoji}
                          {selected && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#C6684F] rounded-full" />}
                        </button>
                      )
                    })}
                  </motion.div>
                  {/* Actions card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.04 }}
                    className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setReplyingTo({ id: msgMenu.msgId, preview: msgMenu.content.substring(0, 80), author: msgMenu.isOwn ? (profile?.username ?? 'Toi') : activePartnerName }); setMsgMenu(null) }}
                      className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] border-b border-[#F5F0EB] active:bg-[#FAF6F1]"
                    >
                      <span>Répondre</span><CornerUpLeft size={16} className="text-[#6B6359]" />
                    </button>
                    {msgMenu.content && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(msgMenu.content).catch(() => {}); setMsgMenu(null) }}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] border-b border-[#F5F0EB] active:bg-[#FAF6F1]"
                      >
                        <span>Copier</span><Copy size={16} className="text-[#6B6359]" />
                      </button>
                    )}
                    {msgMenu.isOwn && (
                      <>
                        <button
                          onClick={() => { const m = messages.find(x => x.id === msgMenu.msgId); if (m) { setEditingId(m.id); setEditText(m.content) } setMsgMenu(null) }}
                          className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] border-b border-[#F5F0EB] active:bg-[#FAF6F1]"
                        >
                          <span>Modifier</span><Pencil size={16} className="text-[#6B6359]" />
                        </button>
                        <button
                          onClick={() => { setDeletingMsgId(msgMenu.msgId); setMsgMenu(null) }}
                          className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#C94F4F] active:bg-[#FAF6F1]"
                        >
                          <span>Supprimer</span><Trash2 size={16} className="text-[#C94F4F]" />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => togglePin(msgMenu.msgId, msgMenu.isPinned)}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#2C2C2C] active:bg-[#FAF6F1]"
                      >
                        <span>{msgMenu.isPinned ? 'Désépingler' : 'Épingler'}</span>
                        {msgMenu.isPinned ? <PinOff size={16} className="text-[#C6684F]" /> : <Pin size={16} className="text-[#C6684F]" />}
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Delete confirmation */}
            <AnimatePresence>
              {deletingMsgId && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6"
                  onClick={() => setDeletingMsgId(null)}
                >
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                    className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="font-semibold text-[#2C2C2C] mb-1">Supprimer ce message ?</p>
                    <p className="text-sm text-[#A09488] mb-4">Cette action est irréversible.</p>
                    <div className="flex gap-3">
                      <button onClick={() => setDeletingMsgId(null)} className="flex-1 py-2.5 rounded-xl border border-[#EDE5DA] text-sm text-[#6B6359]">Annuler</button>
                      <button onClick={() => deleteMessage(deletingMsgId)} className="flex-1 py-2.5 rounded-xl bg-[#C94F4F] text-sm text-white font-medium">Supprimer</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compose bar */}
            <div className="flex-shrink-0 bg-white border-t border-[#DCCFBF] px-4 py-3 safe-bottom">
              {/* Reply preview */}
              {replyingTo && (
                <div className="flex items-start gap-2 border-l-2 border-[#C6684F] pl-2 py-1 mb-2 bg-[#C6684F]/5 rounded-r-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-[#C6684F]">↩ {replyingTo.author}</p>
                    <p className="text-xs text-[#6B6359] line-clamp-1">{replyingTo.preview}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-[#A09488] hover:text-[#C6684F] flex-shrink-0 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}
              {/* File preview */}
              {pendingFile && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-[#FAF6F1] rounded-xl border border-[#EDE5DA]">
                  {pendingFile.isImage && pendingFile.preview
                    ? <img src={pendingFile.preview} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    : <FileText size={20} className="text-[#C6684F] flex-shrink-0" />}
                  <span className="text-xs text-[#6B6359] flex-1 truncate">{pendingFile.file.name}</span>
                  <button onClick={() => setPendingFile(null)}><X size={14} className="text-[#A09488]" /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*,application/pdf,.doc,.docx,.txt" />
                <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center text-[#A09488] hover:bg-[#F2E8DF] hover:text-[#C6684F] transition-colors flex-shrink-0">
                  <Paperclip size={18} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Écrire un message..."
                  rows={1}
                  className="flex-1 bg-[#FAF6F1] border border-[#EDE5DA] rounded-2xl px-4 py-2.5 text-sm text-[#2C2C2C] placeholder-[#A09488] focus:outline-none focus:border-[#C6684F] resize-none"
                  style={{ maxHeight: 120, overflowY: 'auto' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() && !pendingFile}
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${inputText.trim() || pendingFile ? 'bg-[#C6684F] text-white' : 'bg-[#EDE5DA] text-[#A09488]'}`}
                >
                  {isUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Conv ⋯ dropdown — portaled to body to escape all clipping ── */}
      {convMenuId && convMenuPos && typeof document !== 'undefined' && createPortal(
        (() => {
          const conv = convs.find(c => c.partner.id === convMenuId)
          if (!conv) return null
          const isUnread = conv.unreadCount > 0
          return (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => { setConvMenuId(null); setConvMenuPos(null) }}
              />
              <div
                style={{ position: 'fixed', top: convMenuPos.top, right: convMenuPos.right, minWidth: 220, zIndex: 9999 }}
                className="bg-white rounded-2xl shadow-xl border border-[#EDE5DA] overflow-hidden"
              >
                <button
                  onClick={() => { isUnread ? markConvAsRead(conv.partner.id) : markConvAsUnread(conv.partner.id) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUnread ? 'bg-[#5B8DEF]/10' : 'bg-[#F2E8DF]'}`}>
                    {isUnread ? <Eye size={15} className="text-[#5B8DEF]" /> : <EyeOff size={15} className="text-[#A09488]" />}
                  </div>
                  <span>{isUnread ? 'Marquer comme lu' : 'Marquer comme non lu'}</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => archiveConversation(conv.partner.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors border-t border-[#F0EAE2]"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#F2E8DF] flex items-center justify-center flex-shrink-0">
                      <Archive size={15} className="text-[#A09488]" />
                    </div>
                    <span>Archiver la discussion</span>
                  </button>
                )}
              </div>
            </>
          )
        })(),
        document.body
      )}
    </div>
  )
}
