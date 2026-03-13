'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

export function TopBar() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const isProfileActive = pathname === '/profil' || pathname.startsWith('/profil/')

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
    </header>
  )
}
