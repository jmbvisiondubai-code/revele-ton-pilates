import type { Profile } from '@/types/database'

export const DEMO_PROFILE: Profile = {
  id: 'demo',
  first_name: 'Marie',
  avatar_url: null,
  birth_date: '1992-05-15',
  city: 'Saint-Tropez',
  practice_level: 'intermediaire',
  goals: ['posture', 'souplesse', 'gestion_stress'],
  limitations: null,
  weekly_rhythm: 3,
  preferred_days: ['lundi', 'mercredi', 'vendredi'],
  preferred_time: 'matin',
  onboarding_completed: true,
  commitment_signed_at: new Date().toISOString(),
  current_streak: 12,
  longest_streak: 28,
  total_sessions: 47,
  total_practice_minutes: 1410,
  is_admin: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
