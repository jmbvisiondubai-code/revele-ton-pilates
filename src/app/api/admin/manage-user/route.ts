import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // 1. Verify caller is authenticated admin
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: callerProfile } = await serverSupabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!callerProfile?.is_admin) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // 2. Parse request
  const { userId, action } = await req.json()
  if (!userId || !action) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // 3. Prevent self-action
  if (userId === user.id) {
    return NextResponse.json({ error: 'Impossible de modifier votre propre compte' }, { status: 400 })
  }

  // 4. Verify target is not admin
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (targetProfile?.is_admin) {
    return NextResponse.json({ error: 'Impossible de modifier un compte administrateur' }, { status: 400 })
  }

  // 5. Execute action
  if (action === 'disable') {
    // Ban user in Supabase Auth (prevents login)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }) // ~100 years
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'enable') {
    // Unban user
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    // Soft delete: ban user + mark profile as deleted (recoverable via trash)
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'permanent_delete') {
    // Hard delete: remove all data permanently
    await supabaseAdmin.from('course_completions').delete().eq('user_id', userId)
    await supabaseAdmin.from('user_badges').delete().eq('user_id', userId)
    await supabaseAdmin.from('recommendations').delete().eq('user_id', userId)
    await supabaseAdmin.from('live_registrations').delete().eq('user_id', userId)
    await supabaseAdmin.from('direct_messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    await supabaseAdmin.from('community_post_reactions').delete().eq('user_id', userId)
    await supabaseAdmin.from('community_comments').delete().eq('user_id', userId)
    await supabaseAdmin.from('community_posts').delete().eq('user_id', userId)
    await supabaseAdmin.from('private_appointments').delete().eq('client_id', userId)
    await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'restore') {
    // Restore: unban + clear deleted_at
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
}
