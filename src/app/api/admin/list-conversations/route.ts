import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Try to get adminId from body, or auto-detect from session
  let adminId: string | null = null

  try {
    const body = await req.json()
    adminId = body.adminId || null
  } catch {
    // empty body is fine
  }

  // If no adminId provided, detect from session cookies
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

  if (!adminId) return NextResponse.json({ error: 'adminId manquant' }, { status: 400 })

  // Verify this user is actually admin
  const { data: adminProfile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', adminId)
    .single()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Get all non-admin profiles
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, username, avatar_url')
    .eq('is_admin', false)
    .order('first_name')

  // Get all DMs involving admin
  const { data: dms } = await supabaseAdmin
    .from('direct_messages')
    .select('sender_id, receiver_id, content, image_url, file_name, created_at, read_at')
    .or(`sender_id.eq.${adminId},receiver_id.eq.${adminId}`)
    .order('created_at', { ascending: false })

  return NextResponse.json({ adminId, profiles: profiles ?? [], dms: dms ?? [] })
}
