'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Play, MessageSquare, BookOpen, User } from 'lucide-react'
import Image from 'next/image'

const navItems = [
  { href: '/dashboard', label: 'Accueil', icon: Home },
  { href: '/cours', label: 'Cours', icon: Play },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/conseils', label: 'Conseils', icon: BookOpen },
  { href: '/profil', label: 'Mon profil', icon: User },
]

export function SideNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-60 bg-white border-r border-[#DCCFBF] z-40">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[#DCCFBF]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            <Image src="/icon-192.png" alt="RTP" width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="font-serif text-sm font-semibold text-[#2C2C2C] leading-tight">Révèle Ton</p>
            <p className="font-serif text-sm font-semibold text-[#C6684F] leading-tight">Pilates</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
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
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C6684F]" />}
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
