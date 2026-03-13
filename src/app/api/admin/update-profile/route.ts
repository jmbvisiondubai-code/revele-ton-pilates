import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Service-role client bypasses RLS
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
  const { userId, updates } = await req.json()
  if (!userId || !updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // 3. Whitelist allowed fields
  const allowedFields = ['practice_level', 'is_teacher']
  const safeUpdates: Record<string, unknown> = {}
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      safeUpdates[key] = updates[key]
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: 'Aucun champ autorisé' }, { status: 400 })
  }

  // 4. Update via service role (bypasses RLS)
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
