import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_TABLES = ['articles', 'live_sessions', 'invitations', 'vod_categories', 'private_appointments', 'recommendations', 'profiles']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const SELECT_MAP: Record<string, string> = {
  articles: 'id, title, category, deleted_at',
  live_sessions: 'id, title, scheduled_at, deleted_at',
  invitations: 'id, email, token, deleted_at',
  vod_categories: 'id, label, emoji, deleted_at',
  private_appointments: 'id, title, scheduled_at, deleted_at',
  recommendations: 'id, title, category, deleted_at',
  profiles: 'id, first_name, last_name, username, email, avatar_url, deleted_at',
}

// GET — list all trashed items
export async function GET() {
  const supabase = getSupabase()
  const results: Record<string, unknown[]> = {}

  for (const table of ALLOWED_TABLES) {
    const select = SELECT_MAP[table] || 'id, deleted_at'
    let query = supabase.from(table).select(select).not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    // For profiles, exclude admins from trash
    if (table === 'profiles') query = query.eq('is_admin', false)
    const { data } = await query
    if (data && data.length > 0) results[table] = data
  }

  return NextResponse.json(results)
}

// POST — soft delete (move to trash)
export async function POST(req: NextRequest) {
  const { table, ids } = await req.json()

  if (!ALLOWED_TABLES.includes(table) || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const supabase = getSupabase()

  // For profiles, also ban the user in auth
  if (table === 'profiles') {
    for (const id of ids) {
      await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' })
    }
  }

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — restore from trash
export async function PATCH(req: NextRequest) {
  const { table, ids } = await req.json()

  if (!ALLOWED_TABLES.includes(table) || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const supabase = getSupabase()

  // For profiles, also unban the user in auth
  if (table === 'profiles') {
    for (const id of ids) {
      await supabase.auth.admin.updateUserById(id, { ban_duration: 'none' })
    }
  }

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — permanent delete
export async function DELETE(req: NextRequest) {
  const { table, ids } = await req.json()

  if (!ALLOWED_TABLES.includes(table) || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const supabase = getSupabase()

  // For profiles, cascade delete all user data + auth
  if (table === 'profiles') {
    for (const userId of ids) {
      await supabase.from('course_completions').delete().eq('user_id', userId)
      await supabase.from('user_badges').delete().eq('user_id', userId)
      await supabase.from('recommendations').delete().eq('user_id', userId)
      await supabase.from('live_registrations').delete().eq('user_id', userId)
      await supabase.from('direct_messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      await supabase.from('community_post_reactions').delete().eq('user_id', userId)
      await supabase.from('community_comments').delete().eq('user_id', userId)
      await supabase.from('community_posts').delete().eq('user_id', userId)
      await supabase.from('private_appointments').delete().eq('client_id', userId)
      await supabase.from('push_subscriptions').delete().eq('user_id', userId)
      await supabase.from('profiles').delete().eq('id', userId)
      await supabase.auth.admin.deleteUser(userId)
    }
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
