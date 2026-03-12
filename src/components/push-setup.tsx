'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

async function subscribeAndSave(userId: string): Promise<boolean> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return false

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const json = sub.toJSON()
  const keys = json.keys as { p256dh: string; auth: string }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }),
  })
  return res.ok
}

export function PushSetup() {
  const { profile } = useAuthStore()
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [denied, setDenied]     = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!profile?.id) return

    // Check support
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setSupported(false)
      return
    }

    const dismissed = localStorage.getItem('push-dismissed')
    if (dismissed) return

    // Already granted → subscribe silently
    if (Notification.permission === 'granted') {
      subscribeAndSave(profile.id).catch(() => {})
      return
    }

    // Denied → don't bother
    if (Notification.permission === 'denied') {
      setDenied(true)
      return
    }

    // Default → show banner after 4s
    const t = setTimeout(() => setShow(true), 4000)
    return () => clearTimeout(t)
  }, [profile?.id])

  async function handleEnable() {
    if (!profile?.id) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        await subscribeAndSave(profile.id)
        setShow(false)
      } else {
        setDenied(true)
        setShow(false)
      }
    } catch {
      setShow(false)
    }
    setLoading(false)
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('push-dismissed', '1')
  }

  if (!supported || !show) return null

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-4 right-4 z-50 lg:left-auto lg:right-6 lg:w-84">
      <div className="bg-white rounded-2xl shadow-xl border border-[#DCCFBF] p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#C6684F]/10 flex items-center justify-center shrink-0">
          {denied ? <BellOff size={18} className="text-[#C6684F]" /> : <Bell size={18} className="text-[#C6684F]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#2C2C2C]">Activer les notifications</p>
          <p className="text-xs text-[#6B6359] mt-0.5 leading-relaxed">
            Reçois une notification quand tu as un nouveau message ou une mention
          </p>
          {!denied && (
            <button
              onClick={handleEnable}
              disabled={loading}
              className="mt-2.5 text-xs font-semibold text-white bg-[#C6684F] px-4 py-1.5 rounded-full disabled:opacity-60 flex items-center gap-1.5"
            >
              {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Activation…' : 'Activer'}
            </button>
          )}
        </div>
        <button onClick={handleDismiss} className="text-[#A09488] hover:text-[#2C2C2C] shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
