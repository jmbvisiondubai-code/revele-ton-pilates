import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { clientId } = await req.json()
  if (!clientId) {
    return NextResponse.json({ error: 'clientId manquant' }, { status: 400 })
  }

  // Find admin
  const { data: admin } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .limit(1)
    .single()

  if (!admin) {
    return NextResponse.json({ error: 'Admin introuvable' }, { status: 500 })
  }

  // Check if any DM exists between admin and client
  const { data } = await supabaseAdmin
    .from('direct_messages')
    .select('id')
    .or(
      `and(sender_id.eq.${admin.id},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${admin.id})`
    )
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ exists: !!data })
}
