-- Migration: Auto celebration posts in community
-- Run this in the Supabase SQL editor

-- ── 1. Add is_automated column to community_posts ──────────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_automated BOOLEAN DEFAULT FALSE;

-- ── 2. Add "Bienvenue" badge ────────────────────────────────────────────────
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value)
VALUES ('Bienvenue', 'Tu as rejoint la communauté Révèle Ton Pilates !', '🌸', 'milestone', 'welcome', 0)
ON CONFLICT DO NOTHING;

-- ── 3. Allow authenticated users to read all automated posts ────────────────
-- (existing SELECT policies should cover this — automated posts have a real user_id)

-- ── 4. Trigger: welcome post + badge when onboarding is completed ───────────
CREATE OR REPLACE FUNCTION public.handle_onboarding_completed()
RETURNS trigger AS $$
DECLARE
  v_welcome_badge_id UUID;
BEGIN
  -- Only fire when onboarding_completed changes false → true
  IF NEW.onboarding_completed = TRUE AND
    (OLD.onboarding_completed = FALSE OR OLD.onboarding_completed IS NULL) THEN

    -- Award welcome badge (will trigger handle_badge_earned, but that skips 'welcome')
    SELECT id INTO v_welcome_badge_id
    FROM public.badges WHERE condition_type = 'welcome' LIMIT 1;

    IF v_welcome_badge_id IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (NEW.id, v_welcome_badge_id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;

    -- Create welcome community post
    INSERT INTO public.community_posts (user_id, content, is_from_marjorie, is_automated,
      image_url, is_pinned, link_url, link_label, reply_to_id, reply_to_preview, reply_to_author, edited_at)
    VALUES (
      NEW.id,
      '🌸 @' || COALESCE(NEW.username, 'nouvelle membre') || ' vient de rejoindre la communauté ! Souhaitons-lui la bienvenue ! 👋',
      false, true,
      null, false, null, null, null, null, null, null
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_onboarding_completed
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_onboarding_completed();

-- ── 5. Trigger: celebration post when any badge (except welcome) is earned ──
CREATE OR REPLACE FUNCTION public.handle_badge_earned()
RETURNS trigger AS $$
DECLARE
  v_badge_name TEXT;
  v_badge_icon TEXT;
  v_badge_condition TEXT;
  v_username TEXT;
BEGIN
  -- Get badge info + username
  SELECT b.name, b.icon, b.condition_type, p.username
  INTO v_badge_name, v_badge_icon, v_badge_condition, v_username
  FROM public.badges b
  JOIN public.profiles p ON p.id = NEW.user_id
  WHERE b.id = NEW.badge_id;

  -- Skip welcome badge (already handled by onboarding trigger)
  IF v_badge_condition = 'welcome' THEN
    RETURN NEW;
  END IF;

  -- Create celebration post
  INSERT INTO public.community_posts (user_id, content, is_from_marjorie, is_automated,
    image_url, is_pinned, link_url, link_label, reply_to_id, reply_to_preview, reply_to_author, edited_at)
  VALUES (
    NEW.user_id,
    v_badge_icon || ' @' || COALESCE(v_username, 'une membre') || ' vient de débloquer le badge "' || v_badge_name || '" ! Félicitons-la ! 🎉',
    false, true,
    null, false, null, null, null, null, null, null
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_badge_earned
  AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.handle_badge_earned();
