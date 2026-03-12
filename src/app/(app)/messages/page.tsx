'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, ArrowLeft, MessageSquare, Smile, Pencil, Trash2,
  Pin, PinOff, CornerUpLeft, X, Paperclip, FileText, Check, MoreHorizontal,
  Archive, ArchiveRestore, Eye, EyeOff, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { formatRelativeDate } from '@/lib/utils'
import type { DirectMessage, ReactionType } from '@/types/database'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// ── Constants ────────────────────────────────────────────────────────────────
const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: 'pouce',           emoji: '👍🏻' },
  { type: 'coeur',           emoji: '❤️'  },
  { type: 'applaudissement', emoji: '👏🏻' },
  { type: 'priere',          emoji: '🙏🏻' },
  { type: 'muscle',          emoji: '💪🏻' },
  { type: 'fete',            emoji: '🎉'  },
  { type: 'feu',             emoji: '🔥'  },
]
const EMPTY_REACTIONS: Record<ReactionType, number> = {
  pouce: 0, coeur: 0, applaudissement: 0, priere: 0, muscle: 0, fete: 0, feu: 0,
}

// ── Types ────────────────────────────────────────────────────────────────────
type ConvProfile = { id: string; first_name: string; avatar_url: string | null }
type ConversationPreview = { partner: ConvProfile; lastMessage: string | null; lastAt: string | null; unreadCount: number; isArchived: boolean }
type MessageWithMeta = DirectMessage & { reaction_counts: Record<ReactionType, number>; user_reactions: ReactionType[] }
type ReplyTarget = { id: string; preview: string; author: string }
type MsgMenu = { msgId: string; isOwn: boolean; content: string; isPinned: boolean; x: number; y: number }
type PendingFile = { file: File; preview: string | null; isImage: boolean }

// ── Reaction picker ───────────────────────────────────────────────────────────
function ReactionPicker({ onReact }: { onReact: (type: ReactionType) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-[#EDE5DA] px-2 py-1 z-50"
    >
      {REACTIONS.map(r => (
        <button
          key={r.type}
          onClick={() => onReact(r.type)}
          className="text-xl w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F2E8DF] transition-colors active:scale-110"
        >
          {r.emoji}
        </button>
      ))}
    </motion.div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const { profile, setProfile } = useAuthStore()
  const myId = profile?.id
  const isAdmin = profile?.is_admin ?? false
  const router = useRouter()

  // Conversation list state
  const [convs, setConvs] = useState<ConversationPreview[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState<ConvProfile | null>(null)
  const [showCommunaute, setShowCommunaute] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [showList, setShowList] = useState(true)

  // Messages state
  const [messages, setMessages] = useState<MessageWithMeta[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  // Compose state
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Interaction state
  const [msgMenu, setMsgMenu] = useState<MsgMenu | null>(null)
  const [showReactionFor, setShowReactionFor] = useState<string | null>(null)
  const [hoverMsg, setHoverMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [swipingMsg, setSwipingMsg] = useState<{ msgId: string; deltaX: number } | null>(null)
  const [showDotMenu, setShowDotMenu] = useState<string | null>(null)
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null)
  const [convMenuId, setConvMenuId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [convSwipeId, setConvSwipeId] = useState<string | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const convTouchRef = useRef<{ startX: number; startY: number } | null>(null)

  // ── Load conversations ───────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()

    // If profile not yet in store, fetch it first
    let resolvedId = myId
    let resolvedIsAdmin = isAdmin
    if (!resolvedId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingConvs(false); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { setLoadingConvs(false); return }
      setProfile(p)
      resolvedId = p.id
      resolvedIsAdmin = p.is_admin ?? false
    }
    if (!resolvedId) { setLoadingConvs(false); return }
    const { data: dms } = await supabase
      .from('direct_messages')
      .select('sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${resolvedId},receiver_id.eq.${resolvedId}`)
      .order('created_at', { ascending: false })

    const partnerMap = new Map<string, { lastMessage: string; lastAt: string; unreadCount: number }>()
    for (const dm of (dms ?? [])) {
      const partnerId = dm.sender_id === resolvedId ? dm.receiver_id : dm.sender_id
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { lastMessage: dm.content, lastAt: dm.created_at, unreadCount: 0 })
      }
      if (dm.receiver_id === resolvedId && !dm.read_at) partnerMap.get(partnerId)!.unreadCount++
    }

    let profiles: ConvProfile[] = []
    if (resolvedIsAdmin) {
      const { data } = await supabase.from('profiles').select('id, first_name, avatar_url').eq('is_admin', false).order('first_name')
      profiles = data ?? []
    } else {
      const { data } = await supabase.from('profiles').select('id, first_name, avatar_url').eq('is_admin', true).limit(1)
      profiles = data ?? []
    }

    // Fetch archived conversations (admin only)
    const archivedSet = new Set<string>()
    if (resolvedIsAdmin) {
      const { data: archived } = await supabase
        .from('dm_archived_conversations')
        .select('client_id')
        .eq('admin_id', resolvedId)
      ;(archived ?? []).forEach(a => archivedSet.add(a.client_id))
    }

    const result: ConversationPreview[] = profiles.map(p => ({
      partner: p,
      lastMessage: partnerMap.get(p.id)?.lastMessage ?? null,
      lastAt: partnerMap.get(p.id)?.lastAt ?? null,
      unreadCount: partnerMap.get(p.id)?.unreadCount ?? 0,
      isArchived: archivedSet.has(p.id),
    }))
    result.sort((a, b) => {
      if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1
      if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt)
      if (a.lastAt) return -1
      if (b.lastAt) return 1
      return a.partner.first_name.localeCompare(b.partner.first_name)
    })
    setConvs(result)
    setLoadingConvs(false)
  }, [myId, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Session restore ───────────────────────────────────────────────────────
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
  const loadMessages = useCallback(async (partnerId: string) => {
    if (!myId || !isSupabaseConfigured()) return
    setLoadingMsgs(true)
    const supabase = createClient()

    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true })

    if (!msgs) { setLoadingMsgs(false); return }

    const msgIds = msgs.map(m => m.id)
    const { data: rxns } = msgIds.length > 0
      ? await supabase.from('direct_message_reactions').select('message_id, user_id, reaction_type').in('message_id', msgIds)
      : { data: [] as { message_id: string; user_id: string; reaction_type: string }[] }

    const messagesWithMeta: MessageWithMeta[] = msgs.map(msg => {
      const msgRxns = (rxns ?? []).filter(r => r.message_id === msg.id)
      const reaction_counts = { ...EMPTY_REACTIONS }
      msgRxns.forEach(r => { if (r.reaction_type in reaction_counts) reaction_counts[r.reaction_type as ReactionType]++ })
      const user_reactions = msgRxns.filter(r => r.user_id === myId).map(r => r.reaction_type as ReactionType)
      return { ...msg, reaction_counts, user_reactions }
    })

    setMessages(messagesWithMeta)
    setLoadingMsgs(false)
    supabase.from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', myId).eq('sender_id', partnerId).is('read_at', null)
      .then(() => loadConversations())
  }, [myId, loadConversations])

  useEffect(() => { if (activeId) loadMessages(activeId) }, [activeId, loadMessages])

  // ── Real-time subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()
    const channel = supabase.channel(`dm-inbox-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${myId}` }, (payload) => {
        const msg = payload.new as DirectMessage
        if (msg.sender_id === activeId) {
          setMessages(prev => [...prev, { ...msg, reaction_counts: { ...EMPTY_REACTIONS }, user_reactions: [] }])
          supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).then(() => {})
        }
        loadConversations()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_message_reactions' }, () => {
        if (activeId) loadMessages(activeId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [myId, activeId, loadConversations, loadMessages])

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Gesture handlers ─────────────────────────────────────────────────────
  function startGesture(msgId: string, isOwn: boolean, content: string, isPinned: boolean, x: number, y: number) {
    touchStartRef.current = { x, y }
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      setMsgMenu({ msgId, isOwn, content, isPinned, x: Math.min(x, window.innerWidth - 220), y: Math.min(y, window.innerHeight - 300) })
    }, 500)
  }
  function moveGesture(msgId: string, x: number, y: number) {
    if (!touchStartRef.current) return
    const dx = x - touchStartRef.current.x
    const dy = Math.abs(y - touchStartRef.current.y)
    if (dy > 12 && longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (dx > 8 && dy < 30) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
      setSwipingMsg({ msgId, deltaX: Math.min(dx, 80) })
    }
  }
  function endGesture(msgId: string, content: string, isOwn: boolean) {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (swipingMsg?.msgId === msgId && swipingMsg.deltaX >= 60) {
      const author = isOwn ? (profile?.first_name ?? 'Toi') : (activeProfile?.first_name ?? '')
      setReplyingTo({ id: msgId, preview: content.substring(0, 80), author })
    }
    setSwipingMsg(null)
    touchStartRef.current = null
  }

  // ── Toggle reaction ──────────────────────────────────────────────────────
  async function toggleReaction(messageId: string, type: ReactionType) {
    if (!myId || !isSupabaseConfigured()) return
    const msg = messages.find(m => m.id === messageId)
    const hasIt = msg?.user_reactions.includes(type) ?? false
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m
      return {
        ...m,
        reaction_counts: { ...m.reaction_counts, [type]: Math.max(0, m.reaction_counts[type] + (hasIt ? -1 : 1)) },
        user_reactions: hasIt ? m.user_reactions.filter(r => r !== type) : [...m.user_reactions, type],
      }
    }))
    setShowReactionFor(null)
    setMsgMenu(null)
    const supabase = createClient()
    if (hasIt) {
      await supabase.from('direct_message_reactions').delete().eq('message_id', messageId).eq('user_id', myId).eq('reaction_type', type)
    } else {
      await supabase.from('direct_message_reactions').insert({ message_id: messageId, user_id: myId, reaction_type: type })
    }
  }

  // ── Edit message ─────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editingId || !editText.trim() || !myId) return
    const supabase = createClient()
    const { data } = await supabase.from('direct_messages')
      .update({ content: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', editingId).eq('sender_id', myId).select().single()
    if (data) setMessages(prev => prev.map(m => m.id === editingId ? { ...m, ...data } : m))
    setEditingId(null)
    setEditText('')
  }

  // ── Delete message ────────────────────────────────────────────────────────
  async function deleteMessage(msgId: string) {
    if (!myId) return
    const supabase = createClient()
    await supabase.from('direct_messages').delete().eq('id', msgId).eq('sender_id', myId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setMsgMenu(null)
    loadConversations()
  }

  // ── Pin message ───────────────────────────────────────────────────────────
  async function togglePin(msgId: string, isPinned: boolean) {
    const supabase = createClient()
    await supabase.from('direct_messages').update({ is_pinned: !isPinned }).eq('id', msgId)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: !isPinned } : m))
    setMsgMenu(null)
  }

  // ── Archive conversation ─────────────────────────────────────────────────
  async function archiveConversation(partnerId: string) {
    if (!myId || !isAdmin || !isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.from('dm_archived_conversations').upsert({ admin_id: myId, client_id: partnerId })
    setConvMenuId(null)
    if (activeId === partnerId) { setActiveId(null); setActiveProfile(null); setMessages([]); setShowList(true) }
    loadConversations()
  }

  async function unarchiveConversation(partnerId: string) {
    if (!myId || !isAdmin || !isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.from('dm_archived_conversations').delete().eq('admin_id', myId).eq('client_id', partnerId)
    setConvMenuId(null)
    loadConversations()
  }

  async function markConvAsUnread(partnerId: string) {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()
    const { data: lastMsg } = await supabase
      .from('direct_messages').select('id')
      .eq('receiver_id', myId).eq('sender_id', partnerId)
      .order('created_at', { ascending: false }).limit(1).single()
    if (lastMsg) {
      await supabase.from('direct_messages').update({ read_at: null }).eq('id', lastMsg.id)
      loadConversations()
    }
    setConvMenuId(null)
  }

  async function markConvAsRead(partnerId: string) {
    if (!myId || !isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', myId)
      .eq('sender_id', partnerId)
      .is('read_at', null)
    loadConversations()
    setConvMenuId(null)
  }

  // ── File upload ───────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    let preview: string | null = null
    if (isImage) {
      preview = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target?.result as string)
        reader.readAsDataURL(file)
      })
    }
    setPendingFile({ file, preview, isImage })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function doUpload(file: File): Promise<string> {
    const supabase = createClient()
    const path = `${[myId, activeId].sort().join('-')}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('dm-attachments').upload(path, file, { upsert: false })
    if (error) throw error
    return supabase.storage.from('dm-attachments').getPublicUrl(path).data.publicUrl
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!myId || !activeId || (!inputText.trim() && !pendingFile) || !isSupabaseConfigured()) return

    let image_url: string | null = null
    let file_url: string | null = null
    let file_name: string | null = null

    if (pendingFile) {
      setIsUploading(true)
      try {
        const url = await doUpload(pendingFile.file)
        if (pendingFile.isImage) image_url = url
        else { file_url = url; file_name = pendingFile.file.name }
      } catch { setIsUploading(false); return }
      setIsUploading(false)
    }

    const text = inputText.trim()
    const reply = replyingTo
    setInputText('')
    setPendingFile(null)
    setReplyingTo(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const optimistic: MessageWithMeta = {
      id: `opt-${Date.now()}`,
      sender_id: myId, receiver_id: activeId, content: text,
      created_at: new Date().toISOString(), read_at: null, edited_at: null, is_pinned: false,
      reply_to_id: reply?.id ?? null, reply_to_preview: reply?.preview ?? null, reply_to_author: reply?.author ?? null,
      image_url, file_url, file_name,
      reaction_counts: { ...EMPTY_REACTIONS }, user_reactions: [],
    }
    setMessages(prev => [...prev, optimistic])

    const supabase = createClient()

    // Auto-unarchive if conversation was archived
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
      loadConversations()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function openConversation(conv: ConversationPreview) {
    if (typeof window !== 'undefined') sessionStorage.setItem('dm_active_conv', conv.partner.id)
    setActiveId(conv.partner.id)
    setActiveProfile(conv.partner)
    setShowCommunaute(false)
    setShowList(false)
    setConvSwipeId(null)
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  function ProfileAvatar({ p, size = 48 }: { p: ConvProfile; size?: number }) {
    if (p.avatar_url) return <Image src={p.avatar_url} alt={p.first_name} width={size} height={size} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    return (
      <div className="rounded-full bg-[#E8D5C4] flex items-center justify-center text-[#C6684F] font-semibold flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.35 }}>
        {p.first_name.charAt(0).toUpperCase()}
      </div>
    )
  }

  const pinnedMessages = messages.filter(m => m.is_pinned)
  const activePartnerName = activeProfile?.first_name ?? ''
  const activeConvIsArchived = activeId ? (convs.find(c => c.partner.id === activeId)?.isArchived ?? false) : false

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

  return (
    <div className="flex h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-2rem)] overflow-hidden">

      {/* ── Conversation list ──────────────────────────────────────────── */}
      <div className={`flex-col w-full lg:w-80 lg:flex-shrink-0 border-r border-[#DCCFBF] bg-white overflow-hidden ${showList ? 'flex' : 'hidden lg:flex'}`}>
        <div className="px-4 py-4 border-b border-[#DCCFBF] flex-shrink-0">
          <h1 className="font-serif text-xl text-[#2C2C2C] font-semibold">Messages</h1>
        </div>

        {/* Communauté */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) router.push('/communaute')
            else { setShowCommunaute(true); setActiveId(null); setActiveProfile(null); setShowList(false) }
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
        <div className="flex-1 overflow-y-auto" onClick={() => { setConvMenuId(null); setConvSwipeId(null) }}>
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : convs.length === 0 ? (
            <p className="text-center text-sm text-[#A09488] py-10 px-4">{isAdmin ? "Aucun membre pour l'instant." : 'Aucune conversation.'}</p>
          ) : (
            <>
              {/* Active conversations */}
              {convs.filter(c => !c.isArchived).map(conv => (
                <div key={conv.partner.id} className="relative overflow-hidden">
                  {/* Swipe-left action buttons */}
                  <div className="absolute right-0 top-0 h-full flex">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (conv.unreadCount > 0) markConvAsRead(conv.partner.id)
                        else markConvAsUnread(conv.partner.id)
                        setConvSwipeId(null)
                      }}
                      className="w-20 h-full bg-[#5B8DEF] flex flex-col items-center justify-center gap-1"
                    >
                      {conv.unreadCount > 0
                        ? <><Eye size={15} className="text-white" /><span className="text-[10px] text-white font-medium leading-none">Lu</span></>
                        : <><EyeOff size={15} className="text-white" /><span className="text-[10px] text-white font-medium leading-none">Non lu</span></>
                      }
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); archiveConversation(conv.partner.id); setConvSwipeId(null) }}
                        className="w-20 h-full bg-[#A09488] flex flex-col items-center justify-center gap-1"
                      >
                        <Archive size={15} className="text-white" />
                        <span className="text-[10px] text-white font-medium leading-none">Archiver</span>
                      </button>
                    )}
                  </div>
                  {/* Row content */}
                  <div
                    className={`relative flex items-center gap-3 px-4 py-3 bg-white cursor-pointer ${activeId === conv.partner.id && !showCommunaute ? '!bg-[#F2E8DF]' : 'hover:bg-[#FAF6F1]'}`}
                    style={{ transform: convSwipeId === conv.partner.id ? `translateX(-${isAdmin ? 160 : 80}px)` : 'translateX(0)', transition: 'transform 0.25s ease' }}
                    onClick={() => { if (convSwipeId === conv.partner.id) { setConvSwipeId(null); return } openConversation(conv) }}
                    onTouchStart={(e) => {
                      if (convSwipeId && convSwipeId !== conv.partner.id) setConvSwipeId(null)
                      convTouchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }
                    }}
                    onTouchEnd={(e) => {
                      if (!convTouchRef.current) return
                      const dx = e.changedTouches[0].clientX - convTouchRef.current.startX
                      const dy = Math.abs(e.changedTouches[0].clientY - convTouchRef.current.startY)
                      convTouchRef.current = null
                      if (dy > 20) return
                      if (dx < -50) setConvSwipeId(conv.partner.id)
                      else if (dx > 20) setConvSwipeId(null)
                    }}
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
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-[#2C2C2C]' : 'font-medium text-[#2C2C2C]'}`}>{conv.partner.first_name}</p>
                        {conv.lastAt && <span className="text-[10px] text-[#A09488] flex-shrink-0">{formatRelativeDate(conv.lastAt)}</span>}
                      </div>
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-medium text-[#2C2C2C]' : 'text-[#A09488]'}`}>
                        {conv.lastMessage ?? 'Aucun message'}
                      </p>
                    </div>
                    {/* Conv ⋯ menu (admin, desktop only) */}
                    {isAdmin && (
                      <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setConvMenuId(convMenuId === conv.partner.id ? null : conv.partner.id)}
                          className="hidden md:flex w-7 h-7 rounded-full items-center justify-center text-[#A09488] hover:bg-[#EDE5DA] hover:text-[#6B6359] transition-colors"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        <AnimatePresence>
                          {convMenuId === conv.partner.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 4 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                              className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-[#EDE5DA] overflow-hidden min-w-[175px]"
                            >
                              <button
                                onClick={() => conv.unreadCount > 0 ? markConvAsRead(conv.partner.id) : markConvAsUnread(conv.partner.id)}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                              >
                                {conv.unreadCount > 0
                                  ? <><Eye size={14} className="text-[#6B6359]" /> Marquer lu</>
                                  : <><EyeOff size={14} className="text-[#6B6359]" /> Marquer non lu</>
                                }
                              </button>
                              <button
                                onClick={() => archiveConversation(conv.partner.id)}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors border-t border-[#EDE5DA]"
                              >
                                <Archive size={14} className="text-[#6B6359]" /> Archiver
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Archived conversations section (admin only) */}
              {isAdmin && convs.some(c => c.isArchived) && (
                <>
                  <button
                    onClick={() => setShowArchived(v => !v)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#A09488] hover:text-[#6B6359] hover:bg-[#FAF6F1] transition-colors border-t border-[#EDE5DA]"
                  >
                    <Archive size={13} />
                    <span>Archivées ({convs.filter(c => c.isArchived).length})</span>
                    <ChevronDown size={13} className={`ml-auto transition-transform ${showArchived ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showArchived && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        {convs.filter(c => c.isArchived).map(conv => (
                          <div
                            key={conv.partner.id}
                            className={`relative flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F1] transition-colors cursor-pointer opacity-70 ${activeId === conv.partner.id && !showCommunaute ? 'bg-[#F2E8DF]' : ''}`}
                            onClick={() => openConversation(conv)}
                          >
                            <ProfileAvatar p={conv.partner} size={44} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#2C2C2C] truncate">{conv.partner.first_name}</p>
                              <p className="text-xs text-[#A09488] truncate">{conv.lastMessage ?? 'Aucun message'}</p>
                            </div>
                            <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setConvMenuId(convMenuId === conv.partner.id ? null : conv.partner.id)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[#A09488] hover:bg-[#EDE5DA] hover:text-[#6B6359] transition-colors"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                              <AnimatePresence>
                                {convMenuId === conv.partner.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-[#EDE5DA] overflow-hidden min-w-[175px]"
                                  >
                                    <button
                                      onClick={() => unarchiveConversation(conv.partner.id)}
                                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                                    >
                                      <ArchiveRestore size={14} className="text-[#6B6359]" /> Désarchiver
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
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

      {/* ── Chat area ─────────────────────────────────────────────────── */}
      <div className={`flex-col overflow-hidden ${activeId || showCommunaute || !showList ? 'flex flex-1' : 'hidden'} lg:flex lg:flex-1`}>

        {!activeId && !showCommunaute ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-[#FAF6F1]">
            <div className="w-16 h-16 rounded-2xl bg-[#F2E8DF] flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-[#C6684F]" />
            </div>
            <p className="font-serif text-lg text-[#2C2C2C] font-semibold mb-1">Sélectionnez une conversation</p>
            <p className="text-sm text-[#A09488]">Choisissez une discussion dans la liste à gauche</p>
          </div>

        ) : showCommunaute && !activeId ? (
          <iframe src="/communaute" className="w-full min-h-0 border-0" style={{ flex: 1 }} title="Communauté" />

        ) : (
          <>
            {/* Context menu / reaction backdrop */}
            {(msgMenu || showReactionFor || showDotMenu) && (
              <div className="fixed inset-0 z-40" onClick={() => { setMsgMenu(null); setShowReactionFor(null); setShowDotMenu(null) }} />
            )}

            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#DCCFBF] flex-shrink-0">
              <button
                onClick={() => { sessionStorage.removeItem('dm_active_conv'); setShowList(true); setActiveId(null); setMessages([]); setShowCommunaute(false) }}
                className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-[#FAF6F1] transition-colors"
              >
                <ArrowLeft size={20} className="text-[#6B6359]" />
              </button>
              {activeProfile && <ProfileAvatar p={activeProfile} size={36} />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#2C2C2C] text-sm">{activeProfile?.first_name}</p>
              </div>
            </div>

            {/* Archived banner */}
            {activeConvIsArchived && isAdmin && (
              <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-[#F2E8DF] border-b border-[#DCCFBF]">
                <div className="flex items-center gap-2 text-xs text-[#6B6359]">
                  <Archive size={13} className="text-[#C6684F]" />
                  <span>Conversation archivée</span>
                </div>
                <button
                  onClick={() => unarchiveConversation(activeId!)}
                  className="text-xs font-medium text-[#C6684F] hover:text-[#A8543D] transition-colors flex items-center gap-1"
                >
                  <ArchiveRestore size={13} /> Désarchiver
                </button>
              </div>
            )}

            {/* Pinned messages */}
            {pinnedMessages.length > 0 && (
              <div className="flex-shrink-0 bg-gradient-to-b from-[#FDF0EB] to-transparent border-b border-[#C6684F]/20 px-4 py-2 space-y-1.5">
                {pinnedMessages.map(pm => (
                  <div key={pm.id} className="flex items-center gap-2">
                    <Pin size={12} className="text-[#C6684F] flex-shrink-0" />
                    <p className="text-xs text-[#2C2C2C] line-clamp-1 flex-1">{pm.content || (pm.image_url ? '📷 Photo' : pm.file_name ?? 'Fichier')}</p>
                    {isAdmin && (
                      <button onClick={() => togglePin(pm.id, true)} className="text-[#A09488] hover:text-[#C6684F] flex-shrink-0 transition-colors">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ background: 'linear-gradient(to bottom, #FAF6F1, #F5EFE8)' }}>
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
                  const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
                  const authorName = isMe ? (profile?.first_name ?? 'Toi') : activePartnerName
                  const totalReactions = Object.values(msg.reaction_counts).reduce((a, b) => a + b, 0)
                  const isEditing = editingId === msg.id
                  const isSwiping = swipingMsg?.msgId === msg.id

                  return (
                    <div key={msg.id}>
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
                        onTouchStart={e => startGesture(msg.id, isMe, msg.content, msg.is_pinned ?? false, e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchMove={e => moveGesture(msg.id, e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchEnd={() => endGesture(msg.id, msg.content, isMe)}
                        onMouseEnter={() => setHoverMsg(msg.id)}
                        onMouseLeave={() => { setHoverMsg(null); if (showReactionFor === msg.id) setShowReactionFor(null) }}
                        style={{
                          transform: isSwiping ? `translateX(${swipingMsg.deltaX}px)` : undefined,
                          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                        }}
                      >
                        {/* Swipe indicator */}
                        {isSwiping && swipingMsg.deltaX > 10 && (
                          <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2`} style={{ opacity: Math.min(swipingMsg.deltaX / 50, 1) }}>
                            <CornerUpLeft size={16} className="text-[#C6684F]" />
                          </div>
                        )}

                        {/* Desktop hover actions */}
                        <div className={`hidden md:flex flex-row items-center gap-0.5 self-end mb-1 transition-opacity duration-150 ${isMe ? 'order-first mr-1' : 'order-last ml-1'} ${hoverMsg === msg.id || showReactionFor === msg.id || showDotMenu === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {/* Reaction */}
                          <div className="relative">
                            <button
                              onClick={() => setShowReactionFor(showReactionFor === msg.id ? null : msg.id)}
                              className="w-7 h-7 rounded-full bg-white border border-[#EDE5DA] flex items-center justify-center hover:bg-[#F2E8DF] shadow-sm transition-colors"
                            >
                              <Smile size={13} className="text-[#6B6359]" />
                            </button>
                            <AnimatePresence>
                              {showReactionFor === msg.id && <ReactionPicker onReact={(t) => toggleReaction(msg.id, t)} />}
                            </AnimatePresence>
                          </div>
                          {/* Reply */}
                          <button
                            onClick={() => setReplyingTo({ id: msg.id, preview: msg.content.substring(0, 80), author: authorName })}
                            className="w-7 h-7 rounded-full bg-white border border-[#EDE5DA] flex items-center justify-center hover:bg-[#F2E8DF] shadow-sm transition-colors"
                          >
                            <CornerUpLeft size={13} className="text-[#6B6359]" />
                          </button>
                          {/* Three-dot menu (own or admin) */}
                          {(isMe || isAdmin) && (
                            <div className="relative">
                              <button
                                onClick={() => setShowDotMenu(showDotMenu === msg.id ? null : msg.id)}
                                className="w-7 h-7 rounded-full bg-white border border-[#EDE5DA] flex items-center justify-center hover:bg-[#F2E8DF] shadow-sm transition-colors"
                              >
                                <MoreHorizontal size={13} className="text-[#6B6359]" />
                              </button>
                              <AnimatePresence>
                                {showDotMenu === msg.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    className={`absolute bottom-full mb-1 z-50 bg-white rounded-xl shadow-lg border border-[#EDE5DA] overflow-hidden min-w-[150px] ${isMe ? 'right-0' : 'left-0'}`}
                                  >
                                    {isMe && (
                                      <button
                                        onClick={() => { setEditingId(msg.id); setEditText(msg.content); setShowDotMenu(null) }}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                                      >
                                        <Pencil size={13} className="text-[#6B6359]" /> Modifier
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => { togglePin(msg.id, msg.is_pinned ?? false); setShowDotMenu(null) }}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                                      >
                                        {msg.is_pinned ? <PinOff size={13} className="text-[#C6684F]" /> : <Pin size={13} className="text-[#6B6359]" />}
                                        {msg.is_pinned ? 'Désépingler' : 'Épingler'}
                                      </button>
                                    )}
                                    {isMe && (
                                      <button
                                        onClick={() => { setDeletingMsgId(msg.id); setShowDotMenu(null) }}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#C94F4F] hover:bg-[#FAF6F1] transition-colors border-t border-[#EDE5DA]"
                                      >
                                        <Trash2 size={13} className="text-[#C94F4F]" /> Supprimer
                                      </button>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>

                        {/* Bubble */}
                        <div className="max-w-[75%]">
                          {/* Reply preview */}
                          {msg.reply_to_preview && (
                            <div className="mb-1 px-2.5 py-1.5 rounded-xl text-xs border-l-2 border-[#C6684F] bg-white/60 backdrop-blur-sm">
                              <p className="font-semibold text-[#C6684F] text-[10px]">{msg.reply_to_author}</p>
                              <p className="text-[#6B6359] line-clamp-1">{msg.reply_to_preview}</p>
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex items-end gap-1">
                              <textarea
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } if (e.key === 'Escape') { setEditingId(null) } }}
                                className="rounded-2xl px-3.5 py-2.5 text-sm bg-white border border-[#C6684F] focus:outline-none resize-none min-w-[120px]"
                                rows={2}
                                autoFocus
                              />
                              <button onClick={saveEdit} className="w-7 h-7 rounded-full bg-[#C6684F] flex items-center justify-center flex-shrink-0">
                                <Check size={13} className="text-white" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="w-7 h-7 rounded-full bg-white border border-[#DCCFBF] flex items-center justify-center flex-shrink-0">
                                <X size={13} className="text-[#6B6359]" />
                              </button>
                            </div>
                          ) : (
                            <div className={`rounded-2xl shadow-sm overflow-hidden ${isMe ? 'bg-[#C6684F] text-white rounded-br-sm' : 'bg-white text-[#2C2C2C] rounded-bl-sm border border-[#EDE5DA]'}`}>
                              {/* Image */}
                              {msg.image_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
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
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
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

                          {/* Reaction counts */}
                          {totalReactions > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              {REACTIONS.filter(r => (msg.reaction_counts[r.type] ?? 0) > 0).map(r => (
                                <button
                                  key={r.type}
                                  onClick={() => toggleReaction(msg.id, r.type)}
                                  className={`flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${
                                    msg.user_reactions.includes(r.type)
                                      ? 'bg-[#C6684F]/10 border-[#C6684F]/30 text-[#C6684F]'
                                      : 'bg-white border-[#EDE5DA] text-[#6B6359] hover:bg-[#F2E8DF]'
                                  }`}
                                >
                                  <span>{r.emoji}</span>
                                  <span className="font-medium">{msg.reaction_counts[r.type]}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Mobile 3-dot button — visible on mobile only, to the side of the bubble */}
                        {(isMe || isAdmin) && (
                          <button
                            className={`md:hidden flex-shrink-0 self-end mb-1 w-6 h-6 flex items-center justify-center text-[#C8BFB6] ${isMe ? 'order-first mr-1' : 'order-last ml-1'}`}
                            onTouchStart={e => e.stopPropagation()}
                            onTouchEnd={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              setMsgMenu({
                                msgId: msg.id, isOwn: isMe, content: msg.content, isPinned: msg.is_pinned ?? false,
                                x: Math.min(Math.max(rect.left, 8), window.innerWidth - 220),
                                y: Math.max(rect.top - 290, 20),
                              })
                            }}
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

            {/* Context menu (mobile long press) */}
            <AnimatePresence>
              {msgMenu && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMsgMenu(null)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    style={{ top: msgMenu.y, left: msgMenu.x }}
                    className="fixed z-50 bg-white rounded-2xl shadow-xl border border-[#EDE5DA] overflow-hidden min-w-[200px]"
                  >
                    {/* Reaction strip */}
                    <div className="flex items-center gap-0.5 px-2 py-2 border-b border-[#EDE5DA]">
                      {REACTIONS.map(r => (
                        <button key={r.type} onClick={() => toggleReaction(msgMenu.msgId, r.type)}
                          className="text-xl w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F2E8DF] active:scale-110 transition-all">
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                    {/* Actions */}
                    <div className="py-1">
                      <button
                        onClick={() => { setReplyingTo({ id: msgMenu.msgId, preview: msgMenu.content.substring(0, 80), author: msgMenu.isOwn ? (profile?.first_name ?? 'Toi') : activePartnerName }); setMsgMenu(null) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                      >
                        <CornerUpLeft size={15} className="text-[#6B6359]" /> Répondre
                      </button>
                      {msgMenu.isOwn && (
                        <>
                          <button
                            onClick={() => { const m = messages.find(x => x.id === msgMenu.msgId); if (m) { setEditingId(m.id); setEditText(m.content) } setMsgMenu(null) }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                          >
                            <Pencil size={15} className="text-[#6B6359]" /> Modifier
                          </button>
                          <button
                            onClick={() => { setDeletingMsgId(msgMenu.msgId); setMsgMenu(null) }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#C94F4F] hover:bg-[#FAF6F1] transition-colors"
                          >
                            <Trash2 size={15} className="text-[#C94F4F]" /> Supprimer
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => togglePin(msgMenu.msgId, msgMenu.isPinned)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2C2C2C] hover:bg-[#FAF6F1] transition-colors"
                        >
                          {msgMenu.isPinned ? <PinOff size={15} className="text-[#C6684F]" /> : <Pin size={15} className="text-[#C6684F]" />}
                          {msgMenu.isPinned ? 'Désépingler' : 'Épingler'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Delete confirmation */}
            <AnimatePresence>
              {deletingMsgId && (
                <>
                  <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setDeletingMsgId(null)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 16 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="fixed inset-x-4 bottom-8 z-[61] bg-white rounded-2xl shadow-xl border border-[#EDE5DA] overflow-hidden max-w-sm mx-auto"
                  >
                    <div className="px-5 py-5 text-center">
                      <div className="w-11 h-11 rounded-full bg-[#F9E0E0] flex items-center justify-center mx-auto mb-3">
                        <Trash2 size={18} className="text-[#C94F4F]" />
                      </div>
                      <p className="font-medium text-[#2C2C2C] mb-1">Supprimer ce message ?</p>
                      <p className="text-sm text-[#A09488] mb-4">Cette action est irréversible.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingMsgId(null)}
                          className="flex-1 py-2.5 rounded-xl border border-[#DCCFBF] text-sm text-[#6B6359] hover:bg-[#FAF6F1] transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => { deleteMessage(deletingMsgId); setDeletingMsgId(null) }}
                          className="flex-1 py-2.5 rounded-xl bg-[#C94F4F] text-sm text-white hover:bg-[#A83E3E] transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
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
                <div className="flex items-center gap-2 mb-2 p-2 bg-[#F2E8DF] rounded-xl">
                  {pendingFile.isImage && pendingFile.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pendingFile.preview} alt="preview" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="text-[#C6684F]" />
                    </div>
                  )}
                  <p className="text-xs text-[#2C2C2C] truncate flex-1">{pendingFile.file.name}</p>
                  <button onClick={() => setPendingFile(null)} className="text-[#A09488] hover:text-[#C6684F] flex-shrink-0 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.mp4,.mov" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 flex-shrink-0 rounded-full border border-[#DCCFBF] flex items-center justify-center hover:bg-[#F2E8DF] transition-colors"
                >
                  <Paperclip size={16} className="text-[#6B6359]" />
                </button>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleInput}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Écrire un message..."
                  rows={1}
                  className="flex-1 resize-none rounded-2xl border border-[#DCCFBF] bg-[#FAF6F1] px-4 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#A09488] focus:outline-none focus:border-[#C6684F] transition-colors leading-relaxed"
                />
                <button
                  onClick={sendMessage}
                  disabled={(!inputText.trim() && !pendingFile) || isUploading}
                  className="w-10 h-10 flex-shrink-0 rounded-full bg-[#C6684F] flex items-center justify-center disabled:opacity-40 transition-all hover:bg-[#A8543D] active:scale-95"
                >
                  {isUploading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={16} className="text-white translate-x-px" />
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
