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

export async function logPractice(input: PracticeLogInput): Promise<PracticeLogResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connectée')

  // Insert completion
  const { error: insertError } = await supabase
    .from('course_completions')
    .insert({
      user_id: user.id,
      course_id: input.courseId || null,
      duration_watched_minutes: input.durationMinutes,
      rating: input.rating || null,
      feedback: input.feedback || null,
      session_type: input.sessionType,
      libre_label: input.libreLabel || null,
      program_session_id: input.programSessionId || null,
    })

  if (insertError) throw new Error(insertError.message)

  // Recalculate stats + auto-award badges
  const { data: result, error: rpcError } = await supabase
    .rpc('recalculate_user_stats', { p_user_id: user.id })

  if (rpcError) throw new Error(rpcError.message)

  const stats = result as PracticeLogResult['stats'] & { new_badges: PracticeLogResult['newBadges'] }

  // Update local auth store
  useAuthStore.getState().updateProfile({
    total_sessions: stats.total_sessions,
    total_practice_minutes: stats.total_practice_minutes,
    current_streak: stats.current_streak,
    longest_streak: stats.longest_streak,
  })

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
