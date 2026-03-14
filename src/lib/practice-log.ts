import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import type { SessionType, Badge } from '@/types/database'

export interface PracticeLogInput {
  sessionType: SessionType
  courseId?: string
  durationMinutes: number
  rating?: number
  feedback?: string
  libreLabel?: string
  programSessionId?: string
  completedAt?: string // YYYY-MM-DD — defaults to today
}

export interface PracticeLogResult {
  success: boolean
  stats: {
    total_sessions: number
    total_practice_minutes: number
    current_streak: number
    longest_streak: number
  }
  newBadges: Pick<Badge, 'id' | 'name' | 'description' | 'icon' | 'category'>[]
}

export interface PracticeUpdateInput {
  id: string
  durationMinutes?: number
  rating?: number | null
  libreLabel?: string | null
  sessionType?: SessionType
  courseId?: string | null
}

async function recalcAndSync(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: result, error: rpcError } = await supabase
    .rpc('recalculate_user_stats', { p_user_id: userId })
  if (rpcError) throw new Error(rpcError.message)
  const stats = result as PracticeLogResult['stats'] & { new_badges: PracticeLogResult['newBadges'] }
  useAuthStore.getState().updateProfile({
    total_sessions: stats.total_sessions,
    total_practice_minutes: stats.total_practice_minutes,
    current_streak: stats.current_streak,
    longest_streak: stats.longest_streak,
  })
  return stats
}

export async function updatePractice(input: PracticeUpdateInput): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connectée')

  const updateData: Record<string, unknown> = {}
  if (input.durationMinutes !== undefined) updateData.duration_watched_minutes = input.durationMinutes
  if (input.rating !== undefined) updateData.rating = input.rating
  if (input.libreLabel !== undefined) updateData.libre_label = input.libreLabel
  if (input.sessionType !== undefined) updateData.session_type = input.sessionType
  if (input.courseId !== undefined) updateData.course_id = input.courseId

  const { error } = await supabase
    .from('course_completions')
    .update(updateData)
    .eq('id', input.id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  await recalcAndSync(supabase, user.id)
}

export async function deletePractice(completionId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connectée')

  const { error } = await supabase
    .from('course_completions')
    .delete()
    .eq('id', completionId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  await recalcAndSync(supabase, user.id)
}

export async function logPractice(input: PracticeLogInput): Promise<PracticeLogResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connectée')

  // Insert completion
  const insertData: Record<string, unknown> = {
    user_id: user.id,
    course_id: input.courseId || null,
    duration_watched_minutes: input.durationMinutes,
    rating: input.rating || null,
    feedback: input.feedback || null,
    session_type: input.sessionType,
    libre_label: input.libreLabel || null,
    program_session_id: input.programSessionId || null,
  }
  if (input.completedAt) {
    insertData.completed_at = `${input.completedAt}T12:00:00`
  }
  const { error: insertError } = await supabase
    .from('course_completions')
    .insert(insertData)

  if (insertError) throw new Error(insertError.message)

  const stats = await recalcAndSync(supabase, user.id)

  return {
    success: true,
    stats: {
      total_sessions: stats.total_sessions,
      total_practice_minutes: stats.total_practice_minutes,
      current_streak: stats.current_streak,
      longest_streak: stats.longest_streak,
    },
    newBadges: stats.new_badges ?? [],
  }
}
