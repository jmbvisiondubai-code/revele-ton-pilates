'use client'

import { BottomNav } from './bottom-nav'
import { SideNav } from './side-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <SideNav />
      <div className="lg:ml-60 pb-20 lg:pb-8">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
