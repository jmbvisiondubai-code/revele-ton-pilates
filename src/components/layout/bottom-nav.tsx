'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Play, MessageSquare, BookOpen, User } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'

const navItems = [
  { href: '/dashboard', label: 'Accueil', icon: Home },
  { href: '/cours', label: 'Cours', icon: Play },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/conseils', label: 'Conseils', icon: BookOpen },
  { href: '/profil', label: 'Profil', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const [unreadDms, setUnreadDms] = useState(0)

  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured()) return
    const supabase = createClient()

    async function fetchUnread() {
      const { count } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', profile!.id)
        .is('read_at', null)
      setUnreadDms(count ?? 0)
    }

    fetchUnread()

    const channel = supabase.channel(`nav-dm-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${profile.id}`,
      }, () => {
        setUnreadDms(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${profile.id}`,
      }, () => {
        // Re-fetch when messages are marked as read
        fetchUnread()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset badge when user is on the messages page
  useEffect(() => {
    if (pathname.startsWith('/messages')) {
      setUnreadDms(0)
    }
  }, [pathname])

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-card/90 backdrop-blur-lg border-t border-border-light safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const isMessages = item.href === '/messages'

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-0.5 py-1 px-3 min-w-[56px]"
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-text-muted'
                  }`}
                />
                {isMessages && unreadDms > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-[#C6684F] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadDms > 99 ? '99+' : unreadDms}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-text-muted'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
