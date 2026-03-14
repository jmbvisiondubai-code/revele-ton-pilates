'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  LayoutDashboard, Video, Calendar, CalendarClock, CalendarDays,
  BookOpen, ArrowLeft, Mail, Users, UserCog, Settings, Trash2,
  BarChart3, ClipboardCheck, MessageSquare, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeft, GripVertical, Sparkles,
} from 'lucide-react'

type MenuGroup = {
  label: string
  key: string
  icon: React.ReactNode
  items: { href: string; label: string; icon: React.ReactNode }[]
}

const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Contenu',
    key: 'contenu',
    icon: <Video size={16} />,
    items: [
      { href: '/admin/cours', label: 'Cours VOD', icon: <Video size={16} /> },
      { href: '/admin/articles', label: 'Articles', icon: <BookOpen size={16} /> },
    ],
  },
  {
    label: 'Sessions Live',
    key: 'lives',
    icon: <Calendar size={16} />,
    items: [
      { href: '/admin/lives', label: 'Planification', icon: <Calendar size={16} /> },
      { href: '/admin/recap-lives', label: 'Récap & Stats', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    label: 'Clientes',
    key: 'clientes',
    icon: <Users size={16} />,
    items: [
      { href: '/admin/clientes', label: 'Suivi', icon: <Users size={16} /> },
      { href: '/admin/messages', label: 'Messages', icon: <MessageSquare size={16} /> },
      { href: '/admin/bilans', label: 'Bilans', icon: <ClipboardCheck size={16} /> },
      { href: '/admin/invitations', label: 'Invitations', icon: <Mail size={16} /> },
    ],
  },
  {
    label: 'Organisation',
    key: 'orga',
    icon: <CalendarDays size={16} />,
    items: [
      { href: '/admin/rdv-prives', label: 'RDV Privés', icon: <CalendarClock size={16} /> },
      { href: '/admin/planning', label: 'Mon planning', icon: <CalendarDays size={16} /> },
    ],
  },
]

const STANDALONE_TOP = [
  { href: '/admin', label: 'Tableau de bord', icon: <LayoutDashboard size={18} /> },
]

const STANDALONE_BOTTOM = [
  { href: '/admin/membres', label: 'Membres', icon: <UserCog size={16} /> },
  { href: '/admin/parametres', label: 'Paramètres', icon: <Settings size={16} /> },
]

function groupForPath(path: string): string | null {
  for (const g of MENU_GROUPS) {
    if (g.items.some(i => path.startsWith(i.href))) return g.key
  }
  return null
}

const COLLAPSED_WIDTH = 56
const MIN_RESIZE = 200
const DEFAULT_WIDTH = 260
const MAX_WIDTH = 340

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  const [collapsed, setCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const g = groupForPath(typeof window !== 'undefined' ? window.location.pathname : '')
    return g ? new Set([g]) : new Set<string>()
  })

  const isResizing = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    startW.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(ev: MouseEvent) {
      if (!isResizing.current) return
      const delta = ev.clientX - startX.current
      const newW = Math.max(MIN_RESIZE, Math.min(MAX_WIDTH, startW.current + delta))
      setSidebarWidth(newW)
    }
    function onMouseUp() {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const g = groupForPath(pathname)
    if (g) setOpenGroups(prev => new Set(prev).add(g))
  }, [pathname])

  useEffect(() => {
    async function checkAdmin() {
      if (!isSupabaseConfigured()) { setChecking(false); return }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) { router.replace('/dashboard'); return }
      setChecking(false)
    }
    checkAdmin()
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href))
  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth

  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      {/* ── Top bar — frosted glass ── */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-black/[0.06] px-5 py-2.5 flex items-center gap-4">
        <Link href="/dashboard" className="p-1.5 rounded-xl hover:bg-black/[0.04] text-[#8a8a8e] hover:text-[#3c3c43] transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C6684F] to-[#e8926f] flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight">MJ Pilates</span>
          <span className="text-[11px] font-medium text-[#86868b] bg-black/[0.04] px-2 py-0.5 rounded-md">Admin</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => { setCollapsed(c => !c); if (collapsed) setSidebarWidth(DEFAULT_WIDTH) }}
          className="p-1.5 rounded-xl hover:bg-black/[0.04] text-[#8a8a8e] hover:text-[#3c3c43] transition-all"
          title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        >
          {collapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <div className="flex">
        {/* ── Sidebar — frosted glass ── */}
        <nav
          className="sticky top-[49px] h-[calc(100vh-49px)] backdrop-blur-xl bg-white/60 border-r border-black/[0.06] flex flex-col transition-[width] duration-300 ease-out relative flex-shrink-0"
          style={{ width: effectiveWidth }}
        >
          <div className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin">

            {/* Dashboard link */}
            {STANDALONE_TOP.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap overflow-hidden ${
                  isActive(item.href)
                    ? 'bg-[#C6684F]/[0.08] text-[#C6684F] shadow-sm shadow-[#C6684F]/5'
                    : 'text-[#3c3c43] hover:bg-black/[0.03]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            ))}

            <div className="h-px bg-black/[0.05] my-3 mx-1" />

            {/* Menu groups */}
            {MENU_GROUPS.map(group => {
              const isOpen = openGroups.has(group.key)
              const hasActive = group.items.some(i => isActive(i.href))

              return (
                <div key={group.key} className="mb-1">
                  {collapsed ? (
                    <div className="space-y-0.5">
                      {group.items.map(item => (
                        <Link key={item.href} href={item.href}
                          className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                            isActive(item.href)
                              ? 'bg-[#C6684F]/[0.08] text-[#C6684F]'
                              : 'text-[#8a8a8e] hover:text-[#3c3c43] hover:bg-black/[0.03]'
                          }`}
                          title={item.label}
                        >
                          {item.icon}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Group header */}
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-[0.06em] transition-all ${
                          hasActive ? 'text-[#C6684F]' : 'text-[#86868b] hover:text-[#3c3c43]'
                        }`}
                      >
                        <span className="flex-shrink-0 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                          <ChevronDown size={12} />
                        </span>
                        <span className="truncate">{group.label}</span>
                      </button>

                      {/* Group items — animated */}
                      <div
                        className="overflow-hidden transition-all duration-200 ease-out"
                        style={{
                          maxHeight: isOpen ? `${group.items.length * 44}px` : '0px',
                          opacity: isOpen ? 1 : 0,
                        }}
                      >
                        <div className="ml-2 pl-3 border-l border-black/[0.06] space-y-0.5">
                          {group.items.map(item => (
                            <Link key={item.href} href={item.href}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap overflow-hidden ${
                                isActive(item.href)
                                  ? 'bg-[#C6684F]/[0.08] text-[#C6684F] shadow-sm shadow-[#C6684F]/5'
                                  : 'text-[#6e6e73] hover:text-[#3c3c43] hover:bg-black/[0.03]'
                              }`}
                            >
                              <span className={`flex-shrink-0 transition-colors ${isActive(item.href) ? 'text-[#C6684F]' : ''}`}>{item.icon}</span>
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* Spacer */}
            <div className="flex-1" />
          </div>

          {/* Bottom items */}
          <div className="px-2.5 pb-3 pt-1 border-t border-black/[0.04] space-y-0.5">
            {STANDALONE_BOTTOM.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap overflow-hidden ${
                  isActive(item.href)
                    ? 'bg-[#C6684F]/[0.08] text-[#C6684F]'
                    : 'text-[#86868b] hover:text-[#3c3c43] hover:bg-black/[0.03]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            ))}
            <Link href="/admin/corbeille"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap overflow-hidden ${
                isActive('/admin/corbeille')
                  ? 'bg-[#C6684F]/[0.08] text-[#C6684F]'
                  : 'text-[#aeaeb2] hover:text-[#86868b] hover:bg-black/[0.03]'
              }`}
              title={collapsed ? 'Corbeille' : undefined}
            >
              <span className="flex-shrink-0"><Trash2 size={16} /></span>
              {!collapsed && 'Corbeille'}
            </Link>
          </div>

          {/* Resize handle — only when expanded */}
          {!collapsed && (
            <div
              onMouseDown={onMouseDown}
              className="absolute top-0 right-0 w-[3px] h-full cursor-col-resize hover:bg-[#C6684F]/20 transition-colors duration-150 group"
            >
              <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-4 h-8 rounded-full bg-black/[0.06] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <GripVertical size={9} className="text-[#8a8a8e]" />
              </div>
            </div>
          )}
        </nav>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8 min-w-0">{children}</main>
      </div>
    </div>
  )
}
