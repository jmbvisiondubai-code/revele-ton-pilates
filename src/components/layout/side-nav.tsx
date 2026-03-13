'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Play, Users, TrendingUp, BookOpen, User, LogOut, Settings } from 'lucide-react'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'

const navItems = [
  { href: '/dashboard',  label: 'Accueil',     icon: Home,       emoji: '🏠' },
  { href: '/cours',      label: 'Cours',        icon: Play,       emoji: '▶️' },
  { href: '/suivi',      label: 'Mon suivi',    icon: TrendingUp, emoji: '📈' },
  { href: '/communaute', label: 'Communauté',   icon: Users,      emoji: '💬' },
  { href: '/conseils',   label: 'Articles',     icon: BookOpen,   emoji: '📖' },
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

  const isProfileActive = pathname === '/profil' || pathname.startsWith('/profil/')

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-[272px] z-40 bg-gradient-to-b from-[#FFFAF7] to-[#FFF5EF] border-r border-[#EDD5C5]/60">

      {/* ── Logo header ── */}
      <div className="px-6 pt-7 pb-5">
        <Link href="/dashboard" className="flex items-center gap-3.5 group">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 shadow-md shadow-[#C6684F]/10 ring-1 ring-[#EDD5C5]/50 transition-transform duration-300 group-hover:scale-105">
              <Image src="/icon-192.png" alt="RTP" width={44} height={44} className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-[#C6684F] to-[#E8926F] rounded-full border-2 border-[#FFFAF7] flex items-center justify-center">
              <span className="text-[6px] text-white">✦</span>
            </div>
          </div>
          <div>
            <p className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[#2C2C2C] leading-tight tracking-wide">Révèle ton</p>
            <p className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[#C6684F] leading-tight tracking-wide">Pilates</p>
          </div>
        </Link>
      </div>

      {/* ── Decorative divider ── */}
      <div className="mx-5 mb-2">
        <div className="h-px bg-gradient-to-r from-transparent via-[#EDD5C5] to-transparent" />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-4 py-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const badge = item.href === '/suivi' ? unreadDms : item.href === '/communaute' ? unreadCommunity : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative block"
            >
              <div className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-medium transition-all duration-300 ${
                isActive
                  ? 'text-[#C6684F]'
                  : 'text-[#6B6359] hover:text-[#2C2C2C]'
              }`}>
                {/* Active background pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidenav-active"
                    className="absolute inset-0 bg-gradient-to-r from-[#C6684F]/10 to-[#E8926F]/5 rounded-2xl border border-[#C6684F]/15 shadow-sm"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}

                {/* Icon container */}
                <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-br from-[#C6684F] to-[#E8926F] shadow-md shadow-[#C6684F]/25'
                    : 'bg-[#F2E8DF]/70 group-hover:bg-[#F2E8DF]'
                }`}>
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} className={isActive ? 'text-white' : ''} />
                </div>

                {/* Label */}
                <span className={`relative z-10 flex-1 transition-all duration-200 ${isActive ? 'font-semibold tracking-wide' : ''}`}>
                  {item.label}
                </span>

                {/* Badge */}
                {badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="relative z-10 min-w-[22px] h-[22px] px-1.5 bg-gradient-to-br from-[#C6684F] to-[#D4785F] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm shadow-[#C6684F]/30"
                  >
                    {badge > 99 ? '99+' : badge}
                  </motion.span>
                )}

                {/* Active accent bar */}
                {isActive && (
                  <motion.div
                    layoutId="sidenav-accent"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-[#C6684F] to-[#E8926F] rounded-r-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* ── Decorative divider ── */}
      <div className="mx-5 mb-1">
        <div className="h-px bg-gradient-to-r from-transparent via-[#EDD5C5] to-transparent" />
      </div>

      {/* ── Profile card ── */}
      <div className="px-4 py-4">
        <Link
          href="/profil"
          className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
            isProfileActive
              ? 'bg-gradient-to-r from-[#C6684F]/10 to-[#E8926F]/5 border border-[#C6684F]/15'
              : 'hover:bg-[#F2E8DF]/50'
          }`}
        >
          {/* Avatar */}
          <div className={`relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 transition-all duration-300 ${
            isProfileActive
              ? 'ring-[#C6684F] shadow-md shadow-[#C6684F]/20'
              : 'ring-[#EDD5C5] hover:ring-[#C6684F]/40'
          }`}>
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.username || 'Profil'} width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#F2E8DF] to-[#E8D5C4] flex items-center justify-center">
                <User size={18} strokeWidth={1.8} className="text-[#A09488]" />
              </div>
            )}
            {/* Online indicator */}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#FFFAF7]" />
          </div>

          {/* Name & role */}
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-semibold truncate ${isProfileActive ? 'text-[#C6684F]' : 'text-[#2C2C2C]'}`}>
              {profile?.username || 'Mon profil'}
            </p>
            <p className="text-[10px] text-[#A09488] truncate">
              {profile?.is_admin ? 'Coach' : 'Membre'}
            </p>
          </div>

          {/* Settings icon */}
          <Settings size={14} className="text-[#DCCFBF] flex-shrink-0" />
        </Link>

        {/* Copyright */}
        <p className="text-[9px] text-[#DCCFBF] text-center mt-3 tracking-wider uppercase">MJ Pilates © 2025</p>
      </div>
    </aside>
  )
}
