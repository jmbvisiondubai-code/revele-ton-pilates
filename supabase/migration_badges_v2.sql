-- Migration: Expanded badge system + level progression
-- Run this in the Supabase SQL editor

-- ── 1. Add is_teacher and start_level columns to profiles ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_teacher BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS start_level TEXT DEFAULT NULL;

-- Set start_level for existing users (snapshot their current level)
UPDATE public.profiles
SET start_level = practice_level
WHERE start_level IS NULL AND practice_level IS NOT NULL;

-- ── 2. Delete existing seed badges and re-insert all ~100 badges ──────────────
-- First, delete user_badges that reference old badges (to avoid FK issues)
-- WARNING: This will reset all earned badges! Only run on fresh setup or if OK to reset.
-- If you want to KEEP existing earned badges, skip this DELETE and only INSERT new ones.

-- Option A: Full reset (uncomment these 2 lines if you want a clean slate)
-- DELETE FROM public.user_badges;
-- DELETE FROM public.badges;

-- Option B: Only add new badges (keeps existing ones)
-- We use ON CONFLICT DO NOTHING assuming name is unique-ish

-- ── 3. Insert all badges ──────────────────────────────────────────────────────

-- RÉGULARITÉ
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Série de 3 jours', 'Tes 3 premiers jours consécutifs', '✨', 'regularity', 'streak', 3),
  ('Série de 7 jours', 'Une semaine complète de pratique', '🔥', 'regularity', 'streak', 7),
  ('Série de 14 jours', '2 semaines de pratique !', '💪', 'regularity', 'streak', 14),
  ('Série de 21 jours', '3 semaines, une habitude se forme !', '🌿', 'regularity', 'streak', 21),
  ('1 mois de régularité', '30 jours de pratique régulière', '🌟', 'regularity', 'streak', 30),
  ('Série de 45 jours', '45 jours sans interruption', '🔮', 'regularity', 'streak', 45),
  ('2 mois consécutifs', '60 jours de pratique ininterrompue', '💫', 'regularity', 'streak', 60),
  ('3 mois consécutifs', '90 jours — un trimestre de discipline', '🏅', 'regularity', 'streak', 90),
  ('Série de 120 jours', '4 mois de pratique quotidienne !', '🌈', 'regularity', 'streak', 120),
  ('6 mois consécutifs', '180 jours — un engagement extraordinaire', '👸', 'regularity', 'streak', 180),
  ('1 an consécutif', '365 jours — une année entière de pratique !', '🎆', 'regularity', 'streak', 365),
  ('1 semaine complète', 'Au moins 1 séance pendant 7 jours', '📅', 'regularity', 'consecutive_weeks', 1),
  ('4 semaines régulières', '1 mois de semaines actives', '🗓️', 'regularity', 'consecutive_weeks', 4),
  ('8 semaines régulières', '2 mois de semaines actives', '📆', 'regularity', 'consecutive_weeks', 8),
  ('12 semaines régulières', '3 mois de semaines actives', '🎯', 'regularity', 'consecutive_weeks', 12),
  ('Matinale', '10 séances pratiquées le matin', '🌅', 'regularity', 'daily_practice', 10),
  ('Couche-tard active', '10 séances pratiquées le soir', '🌙', 'regularity', 'daily_practice', 20),
  ('Régulière du weekend', '10 séances le weekend', '☀️', 'regularity', 'daily_practice', 30),
  ('5 séances en une semaine', '5 séances sur une même semaine', '⭐', 'regularity', 'monthly_sessions', 5),
  ('20 séances en un mois', '20 séances sur un même mois', '🌙', 'regularity', 'monthly_sessions', 20)
ON CONFLICT DO NOTHING;

-- JALONS / MILESTONES
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('5 sessions', 'Tu prends le rythme — 5 sessions !', '🌿', 'milestone', 'total_sessions', 5),
  ('10 sessions', 'Tu as atteint 10 sessions !', '🎋', 'milestone', 'total_sessions', 10),
  ('25 sessions', '25 sessions — tu es engagée', '🌳', 'milestone', 'total_sessions', 25),
  ('75 sessions', '75 sessions — presque à 100 !', '🔷', 'milestone', 'total_sessions', 75),
  ('150 sessions', '150 sessions — une vraie passionnée', '💜', 'milestone', 'total_sessions', 150),
  ('200 sessions', '200 sessions — exemplaire', '🏆', 'milestone', 'total_sessions', 200),
  ('300 sessions', '300 sessions — une pilateuse confirmée', '🌠', 'milestone', 'total_sessions', 300),
  ('500 sessions', '500 sessions — légende du Pilates', '🎇', 'milestone', 'total_sessions', 500),
  ('1 heure de pratique', '60 minutes de pratique cumulées', '⏱️', 'milestone', 'total_minutes', 60),
  ('5 heures de pratique', '5 heures de pratique cumulées', '🕐', 'milestone', 'total_minutes', 300),
  ('25 heures', '25 heures — un jour entier de Pilates !', '🕰️', 'milestone', 'total_minutes', 1500),
  ('50 heures', '50 heures de pratique cumulées', '⌛', 'milestone', 'total_minutes', 3000),
  ('100 heures', '100 heures — maîtrise absolue', '🏛️', 'milestone', 'total_minutes', 6000),
  ('200 heures', '200 heures de pratique au compteur', '🌍', 'milestone', 'total_minutes', 12000),
  ('500 heures', '500 heures — dévouement incroyable', '🌌', 'milestone', 'total_minutes', 30000)
ON CONFLICT DO NOTHING;

-- EXPLORATION
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Curieuse', 'Tu as essayé 2 types de cours différents', '🔍', 'exploration', 'variety', 2),
  ('Aventurière', 'Tu as essayé 8 types de cours', '🗺️', 'exploration', 'variety', 8),
  ('Full Body addict', '10 séances Full Body complétées', '💃', 'exploration', 'focus_type', 10),
  ('Reine du Reformer', '10 séances Reformer', '🎪', 'exploration', 'focus_type', 11),
  ('Quick Pilates fan', '10 séances Quick Pilates', '⚡', 'exploration', 'focus_type', 12),
  ('Souplesse mastery', '10 séances Souplesse', '🦋', 'exploration', 'focus_type', 13),
  ('Accessoiriste', '10 séances avec accessoires', '🎾', 'exploration', 'equipment', 10),
  ('Swiss Ball pro', '10 séances avec Swiss Ball', '🔴', 'exploration', 'equipment', 11),
  ('Élastique master', '10 séances avec élastique', '🟡', 'exploration', 'equipment', 12),
  ('Foam Roller addict', '10 séances Foam Roller', '🟢', 'exploration', 'equipment', 13),
  ('Session longue', '5 sessions de plus de 35 minutes', '🎬', 'exploration', 'focus_type', 14),
  ('Perfect Time fan', '10 séances Perfect Time', '⏳', 'exploration', 'focus_type', 15),
  ('Touche-à-tout', 'Tous les types de focus essayés', '🌈', 'exploration', 'variety', 10),
  ('Programme complété', 'Tu as terminé un programme complet', '📜', 'exploration', 'variety', 15)
ON CONFLICT DO NOTHING;

-- COMMUNAUTÉ
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Premier post', 'Tu as publié ton premier post communautaire', '💬', 'community', 'community_posts', 1),
  ('Bavarde', '10 posts dans la communauté', '🗣️', 'community', 'community_posts', 10),
  ('Pilier de la communauté', '50 posts communautaires', '🏛️', 'community', 'community_posts', 50),
  ('Fan des lives', '25 participations live', '🎥', 'community', 'live_attendance', 25),
  ('Live addict', '50 participations live', '📡', 'community', 'live_attendance', 50),
  ('Premier commentaire', 'Tu as commenté un article', '✏️', 'community', 'articles_read', 1),
  ('Lectrice assidue', '10 articles lus et commentés', '📖', 'community', 'articles_read', 10),
  ('Bibliophile', '25 articles consultés', '📚', 'community', 'articles_read', 25),
  ('Première évaluation', 'Tu as noté un cours', '⭐', 'community', 'course_rating', 1),
  ('Critique avisée', '10 cours évalués', '🌟', 'community', 'course_rating', 10),
  ('Guide des débutantes', '25 cours évalués', '💫', 'community', 'course_rating', 25),
  ('Ambassadrice', '100 posts et interactions', '🎀', 'community', 'community_posts', 100),
  ('Première réaction', 'Tu as réagi à un post', '❤️', 'community', 'community_posts', 2),
  ('Encourageante', '50 réactions données', '💝', 'community', 'community_posts', 51)
ON CONFLICT DO NOTHING;

-- BIEN-ÊTRE
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Zen attitude', '5 séances souplesse/relaxation', '🧘', 'wellness', 'focus_type', 20),
  ('Respiration profonde', '10 séances centrées respiration', '🌬️', 'wellness', 'focus_type', 21),
  ('Écoute de soi', 'Noté des limitations dans ton profil', '🫶', 'wellness', 'daily_practice', 40),
  ('Posture queen', '15 séances travail de posture', '👸', 'wellness', 'focus_type', 22),
  ('Anti-stress', '10 séances axées gestion du stress', '🍃', 'wellness', 'focus_type', 23),
  ('Récupération active', '10 séances récupération', '🛁', 'wellness', 'focus_type', 24),
  ('Énergie boostée', '10 séances boost énergie', '⚡', 'wellness', 'focus_type', 25),
  ('Équilibre trouvé', '3 objectifs cochés simultanément', '⚖️', 'wellness', 'daily_practice', 41),
  ('Corps et esprit', '20 séances bien-être complétées', '🌺', 'wellness', 'focus_type', 26),
  ('Harmonie totale', '50 séances bien-être', '🪷', 'wellness', 'focus_type', 27)
ON CONFLICT DO NOTHING;

-- DÉFIS
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Défi 7 jours', 'Tu as relevé le défi 7 jours', '🎯', 'challenge', 'streak', 7),
  ('Défi 30 jours', 'Tu as relevé le défi 30 jours', '🏋️', 'challenge', 'streak', 30),
  ('Double séance', '2 séances le même jour', '✌️', 'challenge', 'daily_practice', 50),
  ('3 séances en un jour', '3 séances le même jour !', '🤯', 'challenge', 'daily_practice', 51),
  ('1h de pratique en un jour', '60+ minutes en une journée', '💪', 'challenge', 'daily_practice', 52),
  ('Semaine parfaite', '7 jours / 7 séances', '🌟', 'challenge', 'monthly_sessions', 7),
  ('Mois parfait', 'Une séance chaque jour du mois', '📅', 'challenge', 'monthly_sessions', 30),
  ('Top 5% régularité', 'Parmi les 5% les plus régulières', '🥇', 'challenge', 'streak', 60),
  ('Jamais 2 sans 3', '3 séances en 3 jours', '🎲', 'challenge', 'daily_practice', 53),
  ('Sans limites', '10 séances de niveaux différents', '🚀', 'challenge', 'variety', 20)
ON CONFLICT DO NOTHING;

-- SOCIAL
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Première conversation', 'Tu as envoyé ton premier message privé', '💌', 'social', 'community_posts', 3),
  ('Connectée', '10 conversations privées', '🔗', 'social', 'community_posts', 11),
  ('Bienveillante', '20 réactions positives données', '🥰', 'social', 'community_posts', 21),
  ('Mentor', 'A aidé 5 membres dans la communauté', '🧑‍🏫', 'social', 'community_posts', 30),
  ('Inspiration', '10 de tes posts ont reçu des réactions', '✨', 'social', 'community_posts', 40),
  ('Soutien actif', '50 messages d''encouragement', '💪', 'social', 'community_posts', 52),
  ('Super membre', 'Présente depuis plus de 6 mois', '🌟', 'social', 'consecutive_weeks', 26),
  ('Pionnière', 'Parmi les premières membres', '🚩', 'social', 'consecutive_weeks', 52)
ON CONFLICT DO NOTHING;

-- PROFESSEUR
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value) VALUES
  ('Professeur certifié', 'Professeur de Pilates certifié', '🎓', 'teacher', 'teacher', 1),
  ('Professeur expert', 'Professeur avec 100+ heures sur la plateforme', '🏫', 'teacher', 'teacher', 2)
ON CONFLICT DO NOTHING;

-- ── 4. RLS policy for the new columns ─────────────────────────────────────────
-- Allow users to read is_teacher from any profile (for display purposes)
-- The existing SELECT policy on profiles should already cover this.

-- ── 5. Automatically award "Professeur certifié" badge when is_teacher is set ─
CREATE OR REPLACE FUNCTION public.handle_teacher_badge()
RETURNS trigger AS $$
DECLARE
  v_teacher_badge_id UUID;
BEGIN
  IF NEW.is_teacher = TRUE AND (OLD.is_teacher = FALSE OR OLD.is_teacher IS NULL) THEN
    SELECT id INTO v_teacher_badge_id
    FROM public.badges WHERE condition_type = 'teacher' AND condition_value = 1 LIMIT 1;

    IF v_teacher_badge_id IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (NEW.id, v_teacher_badge_id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_teacher_set ON public.profiles;
CREATE TRIGGER on_teacher_set
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_teacher_badge();
