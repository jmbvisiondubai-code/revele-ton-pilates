-- Migration v2: Celebration posts from Marjorie + level change announcements
-- Run this in the Supabase SQL editor
-- This replaces the previous celebration triggers with improved versions

-- ── 1. Ensure is_automated column exists ────────────────────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_automated BOOLEAN DEFAULT FALSE;

-- ── 2. Helper: get Marjorie's user ID (first admin) ────────────────────────
-- Used by triggers to post as Marjorie
CREATE OR REPLACE FUNCTION public.get_marjorie_id()
RETURNS UUID AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE is_admin = TRUE
  ORDER BY created_at ASC
  LIMIT 1;
  RETURN v_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Trigger: welcome post + badge when onboarding is completed ───────────
CREATE OR REPLACE FUNCTION public.handle_onboarding_completed()
RETURNS trigger AS $$
DECLARE
  v_welcome_badge_id UUID;
  v_marjorie_id UUID;
BEGIN
  IF NEW.onboarding_completed = TRUE AND
    (OLD.onboarding_completed = FALSE OR OLD.onboarding_completed IS NULL) THEN

    -- Award welcome badge
    SELECT id INTO v_welcome_badge_id
    FROM public.badges WHERE condition_type = 'welcome' LIMIT 1;

    IF v_welcome_badge_id IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (NEW.id, v_welcome_badge_id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;

    -- Post as Marjorie
    v_marjorie_id := public.get_marjorie_id();

    INSERT INTO public.community_posts (user_id, content, is_from_marjorie, is_automated,
      image_url, is_pinned, link_url, link_label, reply_to_id, reply_to_preview, reply_to_author, edited_at)
    VALUES (
      COALESCE(v_marjorie_id, NEW.id),
      '🌸 @' || COALESCE(NEW.username, 'nouvelle membre') || ' vient de rejoindre la communauté ! Souhaitons-lui la bienvenue ! 👋',
      true, true,
      null, false, null, null, null, null, null, null
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_onboarding_completed ON public.profiles;
CREATE TRIGGER on_onboarding_completed
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_onboarding_completed();

-- ── 4. Trigger: celebration post when any badge (except welcome) is earned ──
CREATE OR REPLACE FUNCTION public.handle_badge_earned()
RETURNS trigger AS $$
DECLARE
  v_badge_name TEXT;
  v_badge_icon TEXT;
  v_badge_condition TEXT;
  v_username TEXT;
  v_marjorie_id UUID;
BEGIN
  SELECT b.name, b.icon, b.condition_type, p.username
  INTO v_badge_name, v_badge_icon, v_badge_condition, v_username
  FROM public.badges b
  JOIN public.profiles p ON p.id = NEW.user_id
  WHERE b.id = NEW.badge_id;

  -- Skip welcome badge (handled by onboarding trigger)
  IF v_badge_condition = 'welcome' THEN
    RETURN NEW;
  END IF;

  -- Skip admin users (Marjorie doesn't need celebration posts)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND is_admin = TRUE) THEN
    RETURN NEW;
  END IF;

  v_marjorie_id := public.get_marjorie_id();

  INSERT INTO public.community_posts (user_id, content, is_from_marjorie, is_automated,
    image_url, is_pinned, link_url, link_label, reply_to_id, reply_to_preview, reply_to_author, edited_at)
  VALUES (
    COALESCE(v_marjorie_id, NEW.user_id),
    v_badge_icon || ' Bravo @' || COALESCE(v_username, 'une membre') || ' ! Elle vient de débloquer le badge "' || v_badge_name || '" 🎉 Félicitons-la !',
    true, true,
    null, false, null, null, null, null, null, null
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_badge_earned ON public.user_badges;
CREATE TRIGGER on_badge_earned
  AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.handle_badge_earned();

-- ── 5. Trigger: celebration post when practice_level changes ────────────────
CREATE OR REPLACE FUNCTION public.handle_level_change()
RETURNS trigger AS $$
DECLARE
  v_marjorie_id UUID;
  v_level_label TEXT;
  v_level_emoji TEXT;
BEGIN
  -- Only fire when practice_level actually changes
  IF NEW.practice_level IS DISTINCT FROM OLD.practice_level AND NEW.practice_level IS NOT NULL THEN

    -- Map level to French label + emoji
    CASE NEW.practice_level
      WHEN 'debutante' THEN v_level_label := 'Débutante'; v_level_emoji := '🌱';
      WHEN 'initiee' THEN v_level_label := 'Initiée'; v_level_emoji := '🌿';
      WHEN 'intermediaire' THEN v_level_label := 'Intermédiaire'; v_level_emoji := '💎';
      WHEN 'avancee' THEN v_level_label := 'Avancée'; v_level_emoji := '👑';
      ELSE v_level_label := NEW.practice_level; v_level_emoji := '⭐';
    END CASE;

    v_marjorie_id := public.get_marjorie_id();

    INSERT INTO public.community_posts (user_id, content, is_from_marjorie, is_automated,
      image_url, is_pinned, link_url, link_label, reply_to_id, reply_to_preview, reply_to_author, edited_at)
    VALUES (
      COALESCE(v_marjorie_id, NEW.id),
      v_level_emoji || ' @' || COALESCE(NEW.username, 'une membre') || ' passe au niveau ' || v_level_label || ' ! 🚀 Quelle belle progression, bravo !',
      true, true,
      null, false, null, null, null, null, null, null
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_level_change ON public.profiles;
CREATE TRIGGER on_level_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_level_change();
