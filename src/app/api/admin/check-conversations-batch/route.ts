import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
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

  // Get all distinct client IDs that have a conversation with admin
  const { data: sent } = await supabaseAdmin
    .from('direct_messages')
    .select('receiver_id')
    .eq('sender_id', admin.id)

  const { data: received } = await supabaseAdmin
    .from('direct_messages')
    .select('sender_id')
    .eq('receiver_id', admin.id)

  const clientIds = new Set<string>()
  sent?.forEach(m => clientIds.add(m.receiver_id))
  received?.forEach(m => clientIds.add(m.sender_id))

  return NextResponse.json({ clientIds: Array.from(clientIds) })
}
