'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
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
    <header className="lg:hidden sticky top-0 z-40 bg-bg-card/90 backdrop-blur-lg border-b border-border-light">
      <div className="flex items-center justify-between px-5 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <Image src="/icon-192.png" alt="RTP" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div className="leading-none">
            <p className="font-serif text-[13px] font-semibold text-[#2C2C2C]">Révèle ton</p>
            <p className="font-serif text-[13px] font-semibold text-[#C6684F]">Pilates</p>
          </div>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Messages */}
          <Link
            href="/messages"
            className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isMessagesActive ? 'bg-[#C6684F]/10 text-[#C6684F]' : 'text-[#A09488] hover:text-[#C6684F] hover:bg-[#F2E8DF]'
            }`}
          >
            <MessageCircle size={20} strokeWidth={isMessagesActive ? 2.2 : 1.8} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#C6684F] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Avatar → Profile */}
          <Link
            href="/profil"
            className={`relative flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 transition-all duration-200 ${
              isProfileActive
                ? 'border-[#C6684F] shadow-md shadow-[#C6684F]/20'
                : 'border-[#DCCFBF] hover:border-[#C6684F]/50'
            }`}
          >
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username || 'Profil'}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#F2E8DF] flex items-center justify-center">
                <User size={16} strokeWidth={1.8} className="text-[#A09488]" />
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
