'use client'

import { useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Clock, MessageCircle } from 'lucide-react'

export default function ExpiredPage() {
  const handleLogout = async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-[#F2E8DF] rounded-full flex items-center justify-center mx-auto">
          <Clock size={32} className="text-[#C6684F]" />
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-2xl text-[#2C2C2C]">Abonnement expiré</h1>
          <p className="text-[#6B6359] text-sm leading-relaxed">
            Ton abonnement d'un an est arrivé à son terme. Pour continuer à accéder à tes cours, tes suivis et la communauté, il te suffit de renouveler.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#DCCFBF] space-y-3">
          <div className="flex items-center gap-3 justify-center">
            <MessageCircle size={18} className="text-[#C6684F]" />
            <span className="font-medium text-[#2C2C2C] text-sm">Contacte Marjorie</span>
          </div>
          <p className="text-[#A09488] text-xs leading-relaxed">
            Envoie un message à Marjorie pour renouveler ton abonnement et retrouver l'accès à tout ton contenu.
          </p>
          <a
            href="https://wa.me/971585023577"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 bg-[#C6684F] text-white rounded-xl text-sm font-semibold hover:bg-[#b55a43] transition-colors"
          >
            Écrire à Marjorie sur WhatsApp
          </a>
        </div>

        <button
          onClick={handleLogout}
          className="text-[#A09488] text-xs hover:text-[#6B6359] transition-colors underline"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
