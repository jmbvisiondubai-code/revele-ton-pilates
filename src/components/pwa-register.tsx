'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Enregistrer le service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW non supporté, pas critique
      })
    }

    // Écouter l'événement d'installation PWA
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)

      // Afficher le bandeau si pas déjà installé et pas déjà refusé
      const dismissed = sessionStorage.getItem('pwa-dismissed')
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
      setInstallPrompt(null)
    }
  }

  function handleDismiss() {
    setShowBanner(false)
    sessionStorage.setItem('pwa-dismissed', '1')
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80">
      <div className="bg-white rounded-2xl shadow-xl border border-border-light p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Download size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">Installer l&apos;application</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Accède à ton espace Pilates directement depuis ton écran d&apos;accueil
          </p>
          <button
            onClick={handleInstall}
            className="mt-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full"
          >
            Installer
          </button>
        </div>
        <button onClick={handleDismiss} className="text-text-muted hover:text-text shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
