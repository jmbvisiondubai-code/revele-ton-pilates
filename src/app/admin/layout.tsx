'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import Link from 'next/link'
import { LayoutDashboard, Video, Calendar, BookOpen, ArrowLeft } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

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
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#93877e] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e0d8] px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-[#93877e] hover:text-[#6b5f57]">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-serif text-xl text-[#2c2825]">Admin — MJ Pilates</h1>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-56 min-h-[calc(100vh-57px)] bg-white border-r border-[#e8e0d8] p-4 space-y-1">
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#6b5f57] hover:bg-[#f5f0eb] text-sm font-medium">
            <LayoutDashboard size={16} /> Tableau de bord
          </Link>
          <Link href="/admin/cours" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#6b5f57] hover:bg-[#f5f0eb] text-sm font-medium">
            <Video size={16} /> Cours VOD
          </Link>
          <Link href="/admin/lives" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#6b5f57] hover:bg-[#f5f0eb] text-sm font-medium">
            <Calendar size={16} /> Sessions Live
          </Link>
          <Link href="/admin/articles" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#6b5f57] hover:bg-[#f5f0eb] text-sm font-medium">
            <BookOpen size={16} /> Articles
          </Link>
        </nav>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
