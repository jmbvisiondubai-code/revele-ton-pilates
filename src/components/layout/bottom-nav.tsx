'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Play, Users, Heart, BookOpen, User } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'

const navItems = [
  { href: '/dashboard',   label: 'Accueil',     icon: Home },
  { href: '/cours',       label: 'Cours',        icon: Play },
  { href: '/communaute',  label: 'Communauté',   icon: Users },
  { href: '/suivi',       label: 'Mon suivi',    icon: Heart },
  { href: '/conseils',    label: 'Conseils',     icon: BookOpen },
  { href: '/profil',      label: 'Profil',       icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const [unreadDms, setUnreadDms] = useState(0)
  const [unreadCommunity, setUnreadCommunity] = useState(0)

  // ── DM unread count ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured()) return
    const supabase = createClient()

    async function fetchUnreadDms() {
      const { count } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', profile!.id)
        .is('read_at', null)
      setUnreadDms(count ?? 0)
    }

    fetchUnreadDms()

    const channel = supabase.channel(`nav-dm-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${profile.id}` },
        () => {
          const p = window.location.pathname
          if (!p.startsWith('/messages') && !p.startsWith('/suivi')) {
            setUnreadDms(prev => prev + 1)
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${profile.id}` },
        () => {
          const p = window.location.pathname
          if (!p.startsWith('/messages') && !p.startsWith('/suivi')) {
            fetchUnreadDms()
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Community unread count ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()

    async function fetchUnreadCommunity() {
      const lastVisit = localStorage.getItem('communaute_last_visit')
      if (!lastVisit) return
      const { count } = await supabase
        .from('community_posts')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastVisit)
        .eq('is_pinned', false)
      setUnreadCommunity(count ?? 0)
    }

    fetchUnreadCommunity()

    const channel = supabase.channel('nav-community')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => {
        if (!window.location.pathname.startsWith('/communaute')) {
          setUnreadCommunity(prev => prev + 1)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset badges on page navigation ──────────────────────────────────────
  useEffect(() => {
    if (pathname.startsWith('/messages') || pathname.startsWith('/suivi'))   setUnreadDms(0)
    if (pathname.startsWith('/communaute')) setUnreadCommunity(0)
  }, [pathname])

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-card/90 backdrop-blur-lg border-t border-border-light safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-1 pt-2.5 pb-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const isMessages   = item.href === '/suivi'
          const isCommunaute = item.href === '/communaute'
          const badge = isMessages ? unreadDms : isCommunaute ? unreadCommunity : 0

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-0.5 py-1 px-2 min-w-[48px]"
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-colors duration-200 ${isActive ? 'text-primary' : 'text-text-muted'}`}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-[#C6684F] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </div>
              <span className={`text-[9px] font-medium transition-colors duration-200 ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
