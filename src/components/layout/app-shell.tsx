'use client'

import { BottomNav } from './bottom-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
