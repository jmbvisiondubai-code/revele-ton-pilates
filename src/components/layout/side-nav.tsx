'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Play, Users, Heart, BookOpen, User } from 'lucide-react'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'

const navItems = [
  { href: '/dashboard',  label: 'Accueil',     icon: Home },
  { href: '/cours',      label: 'Cours',        icon: Play },
  { href: '/communaute', label: 'Communauté',   icon: Users },
  { href: '/suivi',      label: 'Mon suivi',    icon: Heart },
  { href: '/conseils',   label: 'Conseils',     icon: BookOpen },
  { href: '/profil',     label: 'Mon profil',   icon: User },
]

export function SideNav() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const [unreadDms, setUnreadDms] = useState(0)
  const [unreadCommunity, setUnreadCommunity] = useState(0)

  // ── DM unread count ──────────────────────────────────────────────────────
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

    const channel = supabase.channel(`sidenav-dm-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${profile.id}` },
        () => { const p = window.location.pathname; if (!p.startsWith('/messages') && !p.startsWith('/suivi')) setUnreadDms(prev => prev + 1) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${profile.id}` },
        () => { const p = window.location.pathname; if (!p.startsWith('/messages') && !p.startsWith('/suivi')) fetchUnreadDms() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Community unread count ───────────────────────────────────────────────
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

    const channel = supabase.channel('sidenav-community')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => {
        if (!window.location.pathname.startsWith('/communaute')) setUnreadCommunity(prev => prev + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset badges on navigation ───────────────────────────────────────────
  useEffect(() => {
    if (pathname.startsWith('/messages') || pathname.startsWith('/suivi'))   setUnreadDms(0)
    if (pathname.startsWith('/communaute')) setUnreadCommunity(0)
  }, [pathname])

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-60 bg-white border-r border-[#DCCFBF] z-40">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[#DCCFBF]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            <Image src="/icon-192.png" alt="RTP" width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="font-serif text-sm font-semibold text-[#2C2C2C] leading-tight">Révèle ton</p>
            <p className="font-serif text-sm font-semibold text-[#C6684F] leading-tight">Pilates</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const badge = item.href === '/suivi' ? unreadDms : item.href === '/communaute' ? unreadCommunity : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#F2E8DF] text-[#C6684F]'
                  : 'text-[#6B6359] hover:bg-[#FAF6F1] hover:text-[#2C2C2C]'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              {item.label}
              {badge > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1 bg-[#C6684F] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {badge === 0 && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C6684F]" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#DCCFBF]">
        <p className="text-xs text-[#A09488]">MJ Pilates © 2025</p>
      </div>
    </aside>
  )
}
