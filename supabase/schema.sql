-- Révèle Ton Pilates — Supabase Schema
-- Run this in the Supabase SQL editor

-- Profils utilisatrices
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  avatar_url TEXT,
  birth_date DATE,
  city TEXT,
  practice_level TEXT CHECK (practice_level IN ('debutante', 'intermediaire', 'avancee')),
  goals TEXT[] DEFAULT '{}',
  limitations TEXT,
  weekly_rhythm INTEGER DEFAULT 3,
  preferred_days TEXT[] DEFAULT '{}',
  preferred_time TEXT CHECK (preferred_time IN ('matin', 'midi', 'soir')),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  commitment_signed_at TIMESTAMPTZ,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_practice_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cours
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  uscreen_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_minutes INTEGER NOT NULL,
  level TEXT CHECK (level IN ('debutante', 'intermediaire', 'avancee', 'tous_niveaux')),
  focus TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  marjorie_notes TEXT,
  benefits TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(2,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programmes structurés
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  duration_weeks INTEGER NOT NULL,
  level TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions d'un programme
CREATE TABLE IF NOT EXISTS program_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  order_index INTEGER NOT NULL
);

-- Progression utilisatrices dans les programmes
CREATE TABLE IF NOT EXISTS user_program_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  current_week INTEGER DEFAULT 1,
  current_session INTEGER DEFAULT 1,
  UNIQUE(user_id, program_id)
);

-- Historique des cours suivis
CREATE TABLE IF NOT EXISTS course_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_watched_minutes INTEGER,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  program_session_id UUID REFERENCES program_sessions(id)
);

-- Sessions live
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_url TEXT,
  replay_url TEXT,
  max_participants INTEGER,
  is_cancelled BOOLEAN DEFAULT FALSE,
  registered_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inscriptions aux lives
CREATE TABLE IF NOT EXISTS live_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  attended BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, live_session_id)
);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  category TEXT,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL
);

-- Badges débloqués
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Objectifs et milestones
CREATE TABLE IF NOT EXISTS user_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Articles/Conseils
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('pratique', 'nutrition', 'bien_etre', 'recuperation')),
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  reading_time_minutes INTEGER,
  marjorie_note TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favoris articles
CREATE TABLE IF NOT EXISTS article_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- Posts communautaires
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_from_marjorie BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Réactions aux posts
CREATE TABLE IF NOT EXISTS post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  reaction_type TEXT CHECK (reaction_type IN ('coeur', 'applaudissement', 'muscle', 'etoile')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id, reaction_type)
);

-- Commentaires
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Défis communautaires
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  badge_id UUID REFERENCES badges(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participation aux défis
CREATE TABLE IF NOT EXISTS challenge_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, challenge_id)
);

-- Citations/Conseils du jour
CREATE TABLE IF NOT EXISTS daily_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT,
  tip TEXT,
  tip_category TEXT,
  display_date DATE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommandations personnalisées (de Marjorie vers cliente)
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY POLICIES
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Courses: everyone can read published courses
CREATE POLICY "Anyone can view published courses" ON courses FOR SELECT USING (is_published = true);

-- Programs: everyone can read published programs
CREATE POLICY "Anyone can view published programs" ON programs FOR SELECT USING (is_published = true);

-- Program sessions: everyone can read
CREATE POLICY "Anyone can view program sessions" ON program_sessions FOR SELECT USING (true);

-- Course completions: users manage their own
CREATE POLICY "Users can view own completions" ON course_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON course_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User program progress: users manage their own
CREATE POLICY "Users can view own progress" ON user_program_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON user_program_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON user_program_progress FOR UPDATE USING (auth.uid() = user_id);

-- Live sessions: everyone can read
CREATE POLICY "Anyone can view live sessions" ON live_sessions FOR SELECT USING (true);

-- Live registrations: users manage their own
CREATE POLICY "Users can view own registrations" ON live_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own registrations" ON live_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Badges: everyone can read
CREATE POLICY "Anyone can view badges" ON badges FOR SELECT USING (true);

-- User badges: users can view their own
CREATE POLICY "Users can view own badges" ON user_badges FOR SELECT USING (auth.uid() = user_id);

-- User milestones: users manage their own
CREATE POLICY "Users can view own milestones" ON user_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON user_milestones FOR UPDATE USING (auth.uid() = user_id);

-- Articles: everyone can read published
CREATE POLICY "Anyone can view published articles" ON articles FOR SELECT USING (is_published = true);

-- Article favorites: users manage their own
CREATE POLICY "Users can view own favorites" ON article_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON article_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON article_favorites FOR DELETE USING (auth.uid() = user_id);

-- Community posts: everyone can read, users can create their own
CREATE POLICY "Anyone can view posts" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Users can create own posts" ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON community_posts FOR DELETE USING (auth.uid() = user_id);

-- Post reactions: everyone can read, users manage their own
CREATE POLICY "Anyone can view reactions" ON post_reactions FOR SELECT USING (true);
CREATE POLICY "Users can create own reactions" ON post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON post_reactions FOR DELETE USING (auth.uid() = user_id);

-- Comments: everyone can read, users manage their own
CREATE POLICY "Anyone can view comments" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Users can create own comments" ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON post_comments FOR DELETE USING (auth.uid() = user_id);

-- Challenges: everyone can read
CREATE POLICY "Anyone can view challenges" ON challenges FOR SELECT USING (true);

-- Challenge participations: users manage their own
CREATE POLICY "Users can view own participations" ON challenge_participations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can join challenges" ON challenge_participations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily inspirations: everyone can read
CREATE POLICY "Anyone can view inspirations" ON daily_inspirations FOR SELECT USING (true);

-- Notifications: users can view/update their own
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Recommendations
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recommendations" ON recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can mark recommendations as read" ON recommendations FOR UPDATE USING (auth.uid() = user_id);

-- Admin helper function (SECURITY DEFINER bypasses RLS for the check)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true);
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admins can manage recommendations" ON recommendations FOR ALL USING (public.is_admin());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Admins can view all course completions
CREATE POLICY "Admins can view all completions" ON course_completions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Admins can view all live registrations
CREATE POLICY "Admins can view all registrations" ON live_registrations FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- ==========================================
-- HELPER FUNCTION: Auto-create profile on signup
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'first_name', 'Nouvelle membre'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- SEED DATA: Sample badges
-- ==========================================
INSERT INTO badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Première session', 'Tu as complété ta toute première session !', '🌱', 'milestone', 'total_sessions', 1),
  ('Série de 7 jours', 'Une semaine complète de pratique', '🔥', 'regularity', 'streak', 7),
  ('1 mois de régularité', '30 jours de pratique régulière', '🌟', 'regularity', 'streak', 30),
  ('50 sessions', 'Tu as atteint 50 sessions complètes', '💎', 'milestone', 'total_sessions', 50),
  ('100 sessions', 'Un cap magnifique — 100 sessions', '👑', 'milestone', 'total_sessions', 100),
  ('Exploratrice', 'Tu as essayé 5 types de cours différents', '🧭', 'exploration', 'variety', 5),
  ('Fidèle du live', 'Tu as participé à 10 sessions live', '📺', 'community', 'live_attendance', 10),
  ('10 heures', '10 heures de pratique cumulées', '⏰', 'milestone', 'total_minutes', 600),
  ('Série de 3 jours', 'Tes 3 premiers jours consécutifs', '✨', 'regularity', 'streak', 3),
  ('Série de 14 jours', '2 semaines de pratique !', '💪', 'regularity', 'streak', 14)
ON CONFLICT DO NOTHING;

-- ==========================================
-- SEED DATA: Sample daily inspirations
-- ==========================================
INSERT INTO daily_inspirations (quote, tip, tip_category, display_date) VALUES
  ('"Chaque mouvement conscient est une déclaration d''amour envers toi-même."', 'Commence ta journée par 3 respirations profondes, ventre détendu.', 'respiration', CURRENT_DATE),
  ('"Ton corps est ton allié le plus fidèle. Écoute-le."', 'Pense à détendre tes épaules plusieurs fois dans la journée.', 'posture', CURRENT_DATE + INTERVAL '1 day'),
  ('"La régularité est plus puissante que l''intensité."', 'Même 15 minutes de pratique comptent. L''important, c''est d''être là.', 'pratique', CURRENT_DATE + INTERVAL '2 days'),
  ('"Prendre soin de toi n''est pas égoïste, c''est essentiel."', 'Hydrate-toi bien avant et après ta session.', 'nutrition', CURRENT_DATE + INTERVAL '3 days'),
  ('"Dans le silence du mouvement, tu te retrouves."', 'Ce soir, offre-toi 5 minutes d''étirement avant de dormir.', 'recuperation', CURRENT_DATE + INTERVAL '4 days')
ON CONFLICT (display_date) DO NOTHING;
