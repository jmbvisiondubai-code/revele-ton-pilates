import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  let { action, adminId, clientId, content, messageIds } = body

  // Auto-detect adminId from session if not provided
  if (!adminId) {
    const supabaseSSR = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabaseSSR.auth.getUser()
    adminId = user?.id || null
  }

  if (action === 'list') {
    // List messages between admin and client
    const { data: msgs } = await supabaseAdmin
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${adminId},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${adminId})`
      )
      .order('created_at', { ascending: true })

    return NextResponse.json({ messages: msgs ?? [] })
  }

  if (action === 'send') {
    // Send a message from admin to client
    const { data, error } = await supabaseAdmin
      .from('direct_messages')
      .insert({ sender_id: adminId, receiver_id: clientId, content })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: data })
  }

  if (action === 'mark_read') {
    // Mark messages as read
    if (messageIds?.length) {
      await supabaseAdmin
        .from('direct_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', messageIds)
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
