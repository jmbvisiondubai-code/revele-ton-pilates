export type PracticeLevel = 'debutante' | 'intermediaire' | 'avancee'
export type PreferredTime = 'matin' | 'midi' | 'soir'
export type CourseLevel = 'debutante' | 'intermediaire' | 'avancee' | 'tous_niveaux'
export type CourseFocus = 'programme' | 'full_body' | 'reformer' | 'perfect_time' | 'quick' | 'session_longue' | 'souplesse' | 'accessoires'
export type Equipment = 'tapis' | 'swiss_ball' | 'elastique' | 'foam_roller'
export type ArticleCategory = 'pratique' | 'nutrition' | 'bien_etre' | 'recuperation'
export type ReactionType = 'coeur' | 'applaudissement' | 'muscle' | 'etoile'
export type BadgeCategory = 'regularity' | 'milestone' | 'exploration' | 'community'
export type NotificationType = 'reminder' | 'badge' | 'live' | 'streak' | 'weekly_recap'

export type Goal =
  | 'posture'
  | 'souplesse'
  | 'renforcement'
  | 'gestion_stress'
  | 'post_partum'
  | 'soulagement_douleurs'
  | 'tonicite'
  | 'energie'
  | 'connexion_corps_esprit'

export interface Profile {
  id: string
  first_name: string
  avatar_url: string | null
  birth_date: string | null
  city: string | null
  practice_level: PracticeLevel | null
  goals: Goal[]
  limitations: string | null
  weekly_rhythm: number
  preferred_days: string[]
  preferred_time: PreferredTime | null
  onboarding_completed: boolean
  commitment_signed_at: string | null
  current_streak: number
  longest_streak: number
  total_sessions: number
  total_practice_minutes: number
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  uscreen_url: string
  thumbnail_url: string | null
  duration_minutes: number
  level: CourseLevel
  focus: CourseFocus[]
  equipment: Equipment[]
  marjorie_notes: string | null
  benefits: string[]
  is_published: boolean
  views_count: number
  avg_rating: number
  created_at: string
}

export interface Program {
  id: string
  title: string
  description: string | null
  duration_weeks: number
  level: string | null
  thumbnail_url: string | null
  is_published: boolean
  created_at: string
}

export interface LiveSession {
  id: string
  title: string
  description: string | null
  scheduled_at: string
  duration_minutes: number
  meeting_url: string | null
  replay_url: string | null
  max_participants: number | null
  is_cancelled: boolean
  is_collective: boolean
  equipment: string | null
  registered_count: number
  created_at: string
}

export interface AppSettings {
  id: string
  key: string
  value: string | null
  updated_at: string
}

export interface Badge {
  id: string
  name: string
  description: string | null
  icon: string
  category: BadgeCategory | null
  condition_type: string
  condition_value: number
}

export interface Article {
  id: string
  title: string
  content: string
  category: ArticleCategory
  tags: string[]
  thumbnail_url: string | null
  reading_time_minutes: number | null
  marjorie_note: string | null
  is_published: boolean
  created_at: string
}

export interface CommunityPost {
  id: string
  user_id: string
  content: string
  image_url: string | null
  is_pinned: boolean
  is_from_marjorie: boolean
  created_at: string
  profiles?: Pick<Profile, 'first_name' | 'avatar_url'>
}

export interface DailyInspiration {
  id: string
  quote: string | null
  tip: string | null
  tip_category: string | null
  display_date: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  action_url: string | null
  created_at: string
}

export interface CourseCompletion {
  id: string
  user_id: string
  course_id: string
  completed_at: string
  duration_watched_minutes: number | null
  rating: number | null
  feedback: string | null
  program_session_id: string | null
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  badge?: Badge
}

export interface UserMilestone {
  id: string
  user_id: string
  goal_type: string
  milestone_name: string
  target_value: number
  current_value: number
  completed_at: string | null
  created_at: string
}

export interface Recommendation {
  id: string
  user_id: string
  created_by: string | null
  title: string
  message: string | null
  link_url: string | null
  link_label: string | null
  link_thumbnail_url: string | null
  is_read: boolean
  created_at: string
}

export interface VodCategory {
  id: string
  label: string
  emoji: string
  url: string
  order_index: number
  is_active: boolean
  created_at: string
}
