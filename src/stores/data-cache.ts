import { create } from 'zustand'
import type { LiveSession, DailyInspiration, PrivateAppointment } from '@/types/database'

interface FeaturedCard {
  title: string
  description: string
  url: string
  image: string | null
}

interface UnreadMsg {
  count: number
  lastContent: string | null
  senderName: string | null
}

interface DataCacheState {
  // Dashboard data
  inspiration: DailyInspiration | null
  nextLive: LiveSession | null
  featured: FeaturedCard | null
  replayUrl: string | null
  replayCode: string | null
  replayImage: string | null
  privateAppt: PrivateAppointment | null
  unreadMsg: UnreadMsg
  dashboardLoadedAt: number | null

  // Cours data
  coursNextLive: LiveSession | null
  coursVodCategories: unknown[]
  coursVimeoUrl: string | null
  coursVimeoCode: string | null
  coursZoomUrl: string | null
  coursPrivateAppts: PrivateAppointment[]
  coursLoadedAt: number | null

  // Setters
  setDashboardData: (data: Partial<DataCacheState>) => void
  setCoursData: (data: Partial<DataCacheState>) => void
  invalidate: (key: 'dashboard' | 'cours' | 'all') => void
}

const CACHE_TTL = 60_000 // 1 minute

export const useDataCache = create<DataCacheState>((set) => ({
  inspiration: null,
  nextLive: null,
  featured: null,
  replayUrl: null,
  replayCode: null,
  replayImage: null,
  privateAppt: null,
  unreadMsg: { count: 0, lastContent: null, senderName: null },
  dashboardLoadedAt: null,

  coursNextLive: null,
  coursVodCategories: [],
  coursVimeoUrl: null,
  coursVimeoCode: null,
  coursZoomUrl: null,
  coursPrivateAppts: [],
  coursLoadedAt: null,

  setDashboardData: (data) => set((state) => ({ ...state, ...data, dashboardLoadedAt: Date.now() })),
  setCoursData: (data) => set((state) => ({ ...state, ...data, coursLoadedAt: Date.now() })),
  invalidate: (key) => set((state) => {
    if (key === 'dashboard' || key === 'all') return { ...state, dashboardLoadedAt: null, ...(key === 'all' ? { coursLoadedAt: null } : {}) }
    if (key === 'cours') return { ...state, coursLoadedAt: null }
    return state
  }),
}))

export function isCacheValid(loadedAt: number | null): boolean {
  if (!loadedAt) return false
  return Date.now() - loadedAt < CACHE_TTL
}
