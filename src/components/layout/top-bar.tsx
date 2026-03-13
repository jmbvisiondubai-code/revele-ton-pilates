'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, MessageCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

export function TopBar() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const isProfileActive = pathname === '/profil' || pathname.startsWith('/profil/')
  const isMessagesActive = pathname.startsWith('/messages')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured()) return
    const supabase = createClient()

    async function fetchUnread() {
      const { count } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', profile!.id)
        .is('read_at', null)
      setUnreadCount(count ?? 0)
    }

    fetchUnread()

    const channel = supabase.channel(`topbar-dm-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${profile.id}` },
        () => {
          if (!window.location.pathname.startsWith('/messages')) {
            setUnreadCount(prev => prev + 1)
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${profile.id}` },
        () => { fetchUnread() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isMessagesActive) setUnreadCount(0)
  }, [isMessagesActive])

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#EDD5C5]/50 shadow-[0_1px_8px_rgba(198,104,79,0.06)]">
      <div className="flex items-center justify-between px-5 py-2.5">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 shadow-sm shadow-[#C6684F]/10 ring-1 ring-[#EDD5C5]/40">
            <Image src="/icon-192.png" alt="RTP" width={36} height={36} className="w-full h-full object-cover" />
          </div>
          <p className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-wide">
            <span className="text-[#2C2C2C]">Révèle ton </span>
            <span className="text-[#C6684F]">Pilates</span>
          </p>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Messages */}
          <Link
            href="/messages"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
              isMessagesActive ? 'bg-[#C6684F]/10 text-[#C6684F]' : 'text-[#A09488] hover:text-[#C6684F] hover:bg-[#F2E8DF]'
            }`}
          >
            <MessageCircle size={21} strokeWidth={isMessagesActive ? 2.2 : 1.8} />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#C6684F] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm shadow-[#C6684F]/30"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </Link>

          {/* Avatar → Profile */}
          <Link
            href="/profil"
            className="relative flex-shrink-0"
          >
            <motion.div
              className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all duration-300 ${
                isProfileActive
                  ? 'border-[#C6684F] shadow-lg shadow-[#C6684F]/25'
                  : 'border-[#EDD5C5] hover:border-[#C6684F]/50 shadow-sm shadow-[#C6684F]/10'
              }`}
              whileTap={{ scale: 0.92 }}
            >
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.username || 'Profil'}
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#F2E8DF] to-[#E8D5C4] flex items-center justify-center">
                  <User size={18} strokeWidth={1.8} className="text-[#A09488]" />
                </div>
              )}
            </motion.div>
            {/* Subtle ring animation when active */}
            {isProfileActive && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[#C6684F]/30"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
