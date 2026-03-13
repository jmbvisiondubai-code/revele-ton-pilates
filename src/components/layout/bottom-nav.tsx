'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Play, Users, TrendingUp, BookOpen, CheckCircle, BarChart3 } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { PracticeLogModal } from '@/components/practice-log-modal'
import { PracticeCelebration } from '@/components/practice-celebration'
import type { PracticeLogResult } from '@/lib/practice-log'

const leftItems = [
  { href: '/dashboard',   label: 'Accueil',     icon: Home },
  { href: '/cours',       label: 'Cours',        icon: Play },
]

const centerItem = { href: '/suivi', label: 'Mon suivi', icon: TrendingUp }

const rightItems = [
  { href: '/communaute',  label: 'Communauté',   icon: Users },
  { href: '/conseils',    label: 'Articles',     icon: BookOpen },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useAuthStore()
  const [unreadDms, setUnreadDms] = useState(0)
  const [unreadCommunity, setUnreadCommunity] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [celebrationResult, setCelebrationResult] = useState<PracticeLogResult | null>(null)

  const handleLogSuccess = useCallback((result: PracticeLogResult) => {
    setCelebrationResult(result)
  }, [])

  const handleDismissCelebration = useCallback(() => {
    setCelebrationResult(null)
  }, [])

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

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false) }, [pathname])

  function getBadge(href: string) {
    if (href === '/suivi') return unreadDms
    if (href === '/communaute') return unreadCommunity
    return 0
  }

  function renderItem(item: typeof centerItem, isCenter = false) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
    const Icon = item.icon
    const badge = getBadge(item.href)

    if (isCenter) {
      return (
        <div key={item.href} className="relative flex flex-col items-center -mt-6 mx-1">
          {/* Deployed menu items */}
          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Left: Log practice */}
                <motion.button
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.05 }}
                  onClick={() => { setMenuOpen(false); setShowLogModal(true) }}
                  className="absolute -top-[4.5rem] -left-10 flex flex-col items-center gap-1"
                >
                  <div className="w-12 h-12 rounded-full bg-[#C6684F] shadow-lg shadow-[#C6684F]/25 flex items-center justify-center">
                    <CheckCircle size={22} className="text-white" />
                  </div>
                  <span className="text-[9px] font-semibold text-[#C6684F] whitespace-nowrap">Session</span>
                </motion.button>

                {/* Right: Mon suivi */}
                <motion.button
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
                  onClick={() => { setMenuOpen(false); router.push('/suivi') }}
                  className="absolute -top-[4.5rem] -right-10 flex flex-col items-center gap-1"
                >
                  <div className="w-12 h-12 rounded-full bg-[#E8D5C4] shadow-lg shadow-[#DCCFBF]/40 flex items-center justify-center">
                    <BarChart3 size={22} className="text-[#A8543D]" />
                  </div>
                  <span className="text-[9px] font-semibold text-[#6B6359] whitespace-nowrap">Mon suivi</span>
                </motion.button>
              </>
            )}
          </AnimatePresence>

          {/* Center button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative"
          >
            <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
              menuOpen
                ? 'bg-[#C6684F] shadow-lg shadow-[#C6684F]/30 rotate-45'
                : isActive
                  ? 'bg-[#C6684F] shadow-lg shadow-[#C6684F]/30 scale-105'
                  : 'bg-[#E8D5C4] shadow-md shadow-[#DCCFBF]/40'
            }`}>
              {/* Subtle pulse ring */}
              {!menuOpen && !isActive && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#C6684F]/20"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {menuOpen ? (
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 0 }}
                  className="text-white text-2xl font-light leading-none"
                >
                  +
                </motion.div>
              ) : (
                <Icon
                  size={26}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'text-white' : 'text-[#A8543D]'}
                />
              )}
              {!menuOpen && badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-white text-[#C6684F] text-[10px] font-bold rounded-full flex items-center justify-center leading-none border-2 border-[#C6684F]">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
          </button>
          <span className={`text-[9px] font-semibold mt-0.5 transition-colors duration-200 ${
            isActive || menuOpen ? 'text-primary' : 'text-text-muted'
          }`}>
            {item.label}
          </span>
        </div>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className="relative flex flex-col items-center gap-0.5 py-1 px-2 min-w-[48px]"
        onClick={() => setMenuOpen(false)}
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
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-card/90 backdrop-blur-lg border-t border-border-light safe-bottom">
        <div className="max-w-md mx-auto flex items-end justify-evenly px-2 pt-3 pb-1.5">
          {leftItems.map((item) => renderItem(item))}
          {renderItem(centerItem, true)}
          {rightItems.map((item) => renderItem(item))}
        </div>
      </nav>

      {/* Practice log modal */}
      <PracticeLogModal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSuccess={handleLogSuccess}
      />

      {/* Celebration overlay */}
      <PracticeCelebration
        result={celebrationResult}
        onDismiss={handleDismissCelebration}
      />
    </>
  )
}
