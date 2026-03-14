import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId manquant' }, { status: 400 })
  }

  // Find Marjorie (admin)
  const { data: admin } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name')
    .eq('is_admin', true)
    .limit(1)
    .single()

  if (!admin) {
    return NextResponse.json({ error: 'Admin introuvable' }, { status: 500 })
  }

  // Don't send to self if user is admin
  if (admin.id === userId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Check if a welcome message already exists
  const { data: existing } = await supabaseAdmin
    .from('direct_messages')
    .select('id')
    .eq('sender_id', admin.id)
    .eq('receiver_id', userId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Send welcome message from Marjorie
  const { error } = await supabaseAdmin.from('direct_messages').insert({
    sender_id: admin.id,
    receiver_id: userId,
    content: `Bienvenue dans ton espace privé ! 🌿\n\nC'est ici que tu pourras discuter directement avec moi. N'hésite pas à me poser tes questions, me partager tes progrès ou simplement échanger.\n\nJe suis ravie de t'accompagner dans ton parcours Pilates ✨`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
