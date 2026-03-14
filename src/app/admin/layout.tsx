'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  LayoutDashboard, Video, Calendar, CalendarClock, CalendarDays,
  BookOpen, ArrowLeft, Mail, Users, UserCog, Settings, Trash2,
  BarChart3, ClipboardCheck, MessageSquare, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeft, GripVertical,
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
    icon: <Video size={15} />,
    items: [
      { href: '/admin/cours', label: 'Cours VOD', icon: <Video size={15} /> },
      { href: '/admin/articles', label: 'Articles', icon: <BookOpen size={15} /> },
    ],
  },
  {
    label: 'Sessions Live',
    key: 'lives',
    icon: <Calendar size={15} />,
    items: [
      { href: '/admin/lives', label: 'Planification', icon: <Calendar size={15} /> },
      { href: '/admin/recap-lives', label: 'Récap & Stats', icon: <BarChart3 size={15} /> },
    ],
  },
  {
    label: 'Clientes',
    key: 'clientes',
    icon: <Users size={15} />,
    items: [
      { href: '/admin/clientes', label: 'Suivi', icon: <Users size={15} /> },
      { href: '/admin/messages', label: 'Messages', icon: <MessageSquare size={15} /> },
      { href: '/admin/bilans', label: 'Bilans', icon: <ClipboardCheck size={15} /> },
      { href: '/admin/invitations', label: 'Invitations', icon: <Mail size={15} /> },
    ],
  },
  {
    label: 'Organisation',
    key: 'orga',
    icon: <CalendarDays size={15} />,
    items: [
      { href: '/admin/rdv-prives', label: 'RDV Privés', icon: <CalendarClock size={15} /> },
      { href: '/admin/planning', label: 'Mon planning', icon: <CalendarDays size={15} /> },
    ],
  },
]

const STANDALONE_TOP = [
  { href: '/admin', label: 'Tableau de bord', icon: <LayoutDashboard size={16} /> },
]

const STANDALONE_BOTTOM = [
  { href: '/admin/membres', label: 'Membres', icon: <UserCog size={15} /> },
  { href: '/admin/parametres', label: 'Paramètres', icon: <Settings size={15} /> },
]

// Which group a path belongs to (auto-open on page load)
function groupForPath(path: string): string | null {
  for (const g of MENU_GROUPS) {
    if (g.items.some(i => path.startsWith(i.href))) return g.key
  }
  return null
}

const MIN_WIDTH = 52
const DEFAULT_WIDTH = 230
const MAX_WIDTH = 340

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  // Sidebar state
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const g = groupForPath(typeof window !== 'undefined' ? window.location.pathname : '')
    return g ? new Set([g]) : new Set<string>()
  })

  // Resize drag
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
      const newW = Math.max(MIN_WIDTH + 20, Math.min(MAX_WIDTH, startW.current + delta))
      setSidebarWidth(newW)
      if (newW <= MIN_WIDTH + 30) setCollapsed(true)
      else setCollapsed(false)
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

  // Toggle group
  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Auto-open group for current path
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
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C6684F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href))
  const effectiveWidth = collapsed ? MIN_WIDTH : sidebarWidth

  return (
    <div className="min-h-screen bg-[#FAF6F1]">
      {/* Header */}
      <div className="bg-white border-b border-[#DCCFBF] px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-[#C6684F] hover:text-[#6B6359] transition">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-serif text-xl text-[#2C2C2C]">Admin — MJ Pilates</h1>
        <div className="flex-1" />
        <button
          onClick={() => { setCollapsed(c => !c); if (collapsed) setSidebarWidth(DEFAULT_WIDTH) }}
          className="p-1.5 rounded-lg hover:bg-[#F2E8DF] text-[#A09488] hover:text-[#6B6359] transition"
          title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <nav
          className="min-h-[calc(100vh-53px)] bg-white border-r border-[#DCCFBF] flex flex-col transition-[width] duration-200 relative flex-shrink-0"
          style={{ width: effectiveWidth }}
        >
          <div className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">

            {/* Standalone top items */}
            {STANDALONE_TOP.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap overflow-hidden ${
                  isActive(item.href) ? 'bg-[#C6684F]/10 text-[#C6684F]' : 'text-[#6B6359] hover:bg-[#F2E8DF]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            ))}

            {!collapsed && <div className="h-px bg-[#DCCFBF] my-2 mx-2" />}
            {collapsed && <div className="h-px bg-[#DCCFBF] my-2" />}

            {/* Menu groups */}
            {MENU_GROUPS.map(group => {
              const isOpen = openGroups.has(group.key)
              const hasActive = group.items.some(i => isActive(i.href))

              return (
                <div key={group.key}>
                  {collapsed ? (
                    // Collapsed: show only icons of sub-items
                    <div className="space-y-0.5">
                      {group.items.map(item => (
                        <Link key={item.href} href={item.href}
                          className={`flex items-center justify-center p-2 rounded-lg transition ${
                            isActive(item.href) ? 'bg-[#C6684F]/10 text-[#C6684F]' : 'text-[#6B6359] hover:bg-[#F2E8DF]'
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                          hasActive ? 'text-[#C6684F]' : 'text-[#A09488] hover:text-[#6B6359]'
                        }`}
                      >
                        <span className="flex-shrink-0">
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </span>
                        <span className="truncate">{group.label}</span>
                      </button>

                      {/* Group items */}
                      {isOpen && (
                        <div className="ml-3 border-l-2 border-[#F2E8DF] space-y-0.5">
                          {group.items.map(item => (
                            <Link key={item.href} href={item.href}
                              className={`flex items-center gap-2.5 pl-4 pr-3 py-1.5 rounded-r-lg text-sm font-medium transition whitespace-nowrap overflow-hidden ${
                                isActive(item.href) ? 'bg-[#C6684F]/10 text-[#C6684F] border-l-2 border-[#C6684F] -ml-[2px]' : 'text-[#6B6359] hover:bg-[#F2E8DF]'
                              }`}
                            >
                              <span className="flex-shrink-0">{item.icon}</span>
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}

            {!collapsed && <div className="h-px bg-[#DCCFBF] my-2 mx-2" />}
            {collapsed && <div className="h-px bg-[#DCCFBF] my-2" />}

            {/* Standalone bottom items */}
            {STANDALONE_BOTTOM.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap overflow-hidden ${
                  isActive(item.href) ? 'bg-[#C6684F]/10 text-[#C6684F]' : 'text-[#6B6359] hover:bg-[#F2E8DF]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            ))}

            <div className="h-px bg-[#DCCFBF] my-2 mx-2" />
            <Link href="/admin/corbeille"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap overflow-hidden ${
                isActive('/admin/corbeille') ? 'bg-[#C6684F]/10 text-[#C6684F]' : 'text-[#A09488] hover:bg-[#F2E8DF]'
              }`}
              title={collapsed ? 'Corbeille' : undefined}
            >
              <span className="flex-shrink-0"><Trash2 size={15} /></span>
              {!collapsed && 'Corbeille'}
            </Link>
          </div>

          {/* Resize handle */}
          {!collapsed && (
            <div
              onMouseDown={onMouseDown}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#C6684F]/20 transition-colors group"
            >
              <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-4 h-8 rounded bg-[#DCCFBF] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <GripVertical size={10} className="text-[#A09488]" />
              </div>
            </div>
          )}
        </nav>

        {/* Content */}
        <main className="flex-1 p-6 min-w-0">{children}</main>
      </div>
    </div>
  )
}
