import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { token, userId } = await req.json()

  if (!token || !userId) {
    return NextResponse.json({ error: 'Missing token or userId' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabase
    .from('invitations')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('token', token)

  if (error) {
    console.error('[mark-invitation-used] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
