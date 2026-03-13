import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWebPush } from '@/lib/webpush'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId, broadcast, title, body, url, tag } = await req.json()
  if ((!userId && !broadcast) || !title) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // broadcast: true → send to ALL subscribed users
  const query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (!broadcast) query.eq('user_id', userId)
  const { data: subs } = await query

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const vapidPublicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!
  const vapidSubject    = `mailto:${process.env.VAPID_EMAIL}`
  const payload         = JSON.stringify({ title, body: body ?? '', url: url ?? '/dashboard', tag: tag ?? 'rtp' })

  const results = await Promise.allSettled(
    subs.map((s) => sendWebPush(s, payload, vapidPublicKey, vapidPrivateKey, vapidSubject))
  )

  // Clean up expired subscriptions (410 Gone)
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value.status === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subs[i].endpoint)
    }
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.status === 'fulfilled' && r.value.ok).length,
  })
}
