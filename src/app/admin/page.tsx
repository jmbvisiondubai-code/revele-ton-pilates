'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Video, Calendar, BookOpen, Users } from 'lucide-react'

export default function AdminPage() {
  const [stats, setStats] = useState({ courses: 0, lives: 0, articles: 0, members: 0 })

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient()
      const [courses, lives, articles, members] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('live_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('articles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        courses: courses.count ?? 0,
        lives: lives.count ?? 0,
        articles: articles.count ?? 0,
        members: members.count ?? 0,
      })
    }
    loadStats()
  }, [])

  const cards = [
    { label: 'Cours VOD', value: stats.courses, icon: Video, href: '/admin/cours', color: '#C6684F' },
    { label: 'Sessions Live', value: stats.lives, icon: Calendar, href: '/admin/lives', color: '#7a9e7e' },
    { label: 'Articles', value: stats.articles, icon: BookOpen, href: '/admin/articles', color: '#9e8a7a' },
    { label: 'Membres', value: stats.members, icon: Users, href: '#', color: '#7a8a9e' },
  ]

  return (
    <div>
      <h2 className="font-serif text-2xl text-[#2C2C2C] mb-6">Tableau de bord</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href} className="bg-white rounded-xl p-5 border border-[#DCCFBF] hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#2C2C2C]">{value}</div>
            <div className="text-sm text-[#C6684F] mt-1">{label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
