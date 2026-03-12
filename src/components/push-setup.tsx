'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export function PushSetup() {
  const { profile } = useAuthStore()

  useEffect(() => {
    if (!profile?.id) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    async function setup() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        let sub = await reg.pushManager.getSubscription()

        if (!sub) {
          const perm = await Notification.requestPermission()
          if (perm !== 'granted') return
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey!),
          })
        }

        const json = sub.toJSON()
        const keys = json.keys as { p256dh: string; auth: string }

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile!.id,
            endpoint: json.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          }),
        })
      } catch {
        // Silent fail — push is a nice-to-have
      }
    }

    setup()
  }, [profile?.id])

  return null
}
