'use client'

import { useState, useEffect } from 'react'
import { BottomNav } from './bottom-nav'
import { SideNav } from './side-nav'
import { PushSetup } from '@/components/push-setup'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isEmbedded, setIsEmbedded] = useState(false)

  useEffect(() => {
    try { setIsEmbedded(window.self !== window.top) } catch { setIsEmbedded(true) }
  }, [])

  if (isEmbedded) {
    return <div className="min-h-dvh bg-bg">{children}</div>
  }

  return (
    <div className="min-h-dvh bg-bg">
      <PushSetup />
      <SideNav />
      <div className="lg:ml-60 pb-20 lg:pb-8">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
