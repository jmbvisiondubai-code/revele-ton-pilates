import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { adminId } = await req.json()
  if (!adminId) return NextResponse.json({ error: 'adminId manquant' }, { status: 400 })

  const { data: dms } = await supabaseAdmin
    .from('direct_messages')
    .select('sender_id, receiver_id, content, image_url, file_name, created_at, read_at')
    .or(`sender_id.eq.${adminId},receiver_id.eq.${adminId}`)
    .order('created_at', { ascending: false })

  return NextResponse.json({ dms: dms ?? [] })
}
