-- Fix Marjorie's profile: clean badges and set level
-- Run this in the Supabase SQL editor

-- ── 1. Find Marjorie's user ID (first admin) ───────────────────────────────
-- Preview first to make sure it's the right user:
SELECT id, first_name, last_name, username, practice_level, is_admin, is_teacher
FROM public.profiles
WHERE is_admin = TRUE;

-- ── 2. Remove all earned badges from Marjorie ──────────────────────────────
-- (badges are for clients, not the coach)
DELETE FROM public.user_badges
WHERE user_id = (
  SELECT id FROM public.profiles WHERE is_admin = TRUE ORDER BY created_at ASC LIMIT 1
);

-- ── 3. Set Marjorie's practice_level if null ────────────────────────────────
UPDATE public.profiles
SET practice_level = 'avancee'
WHERE is_admin = TRUE AND (practice_level IS NULL OR practice_level = '');

-- ── 4. Verify the fix ──────────────────────────────────────────────────────
SELECT p.id, p.first_name, p.practice_level, p.is_admin,
  (SELECT COUNT(*) FROM public.user_badges ub WHERE ub.user_id = p.id) AS badge_count
FROM public.profiles p
WHERE p.is_admin = TRUE;
