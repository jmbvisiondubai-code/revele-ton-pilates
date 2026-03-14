import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_TABLES = ['articles', 'live_sessions', 'invitations', 'vod_categories', 'private_appointments', 'recommendations']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET — list all trashed items
export async function GET() {
  const supabase = getSupabase()
  const results: Record<string, unknown[]> = {}

  for (const table of ALLOWED_TABLES) {
    const select = table === 'articles'
      ? 'id, title, category, deleted_at'
      : table === 'live_sessions'
      ? 'id, title, scheduled_at, deleted_at'
      : table === 'invitations'
      ? 'id, email, token, deleted_at'
      : table === 'vod_categories'
      ? 'id, label, emoji, deleted_at'
      : table === 'private_appointments'
      ? 'id, title, scheduled_at, deleted_at'
      : table === 'recommendations'
      ? 'id, title, category, deleted_at'
      : 'id, deleted_at'

    const { data } = await supabase
      .from(table)
      .select(select)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

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
  const { error } = await supabase
    .from(table)
    .delete()
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
