import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Verify caller is admin
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: caller } = await serverSupabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Get admin profile (Marjorie)
  const { data: admin } = await supabaseAdmin
    .from('profiles').select('id').eq('is_admin', true).limit(1).single()
  if (!admin) return NextResponse.json({ error: 'Admin introuvable' }, { status: 500 })

  // Get all non-admin users
  const { data: allUsers } = await supabaseAdmin
    .from('profiles').select('id, first_name').eq('is_admin', false)
  if (!allUsers || allUsers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Get all users who already have a DM with admin
  const { data: existingDMs } = await supabaseAdmin
    .from('direct_messages')
    .select('receiver_id')
    .eq('sender_id', admin.id)

  const alreadyContacted = new Set((existingDMs ?? []).map(d => d.receiver_id))

  // Filter users without any message from admin
  const missing = allUsers.filter(u => !alreadyContacted.has(u.id))

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'Toutes les clientes ont déjà un message' })
  }

  // Send welcome message to each
  const messages = missing.map(u => ({
    sender_id: admin.id,
    receiver_id: u.id,
    content: `Bienvenue dans ton espace privé ! 🌿\n\nC'est ici que tu pourras discuter directement avec moi. N'hésite pas à me poser tes questions, me partager tes progrès ou simplement échanger.\n\nJe suis ravie de t'accompagner dans ton parcours Pilates ✨`,
  }))

  const { error } = await supabaseAdmin.from('direct_messages').insert(messages)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    sent: missing.length,
    users: missing.map(u => u.first_name),
  })
}
