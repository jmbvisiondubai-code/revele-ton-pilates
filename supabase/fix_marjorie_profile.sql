-- Fix Marjorie's profile: set as Coach
-- Run this in the Supabase SQL editor

-- ── 1. Preview Marjorie's profile ───────────────────────────────────────────
SELECT id, first_name, last_name, username, practice_level, is_admin, is_teacher
FROM public.profiles
WHERE is_admin = TRUE;

-- ── 2. Set Marjorie as teacher + coach level ────────────────────────────────
-- The app displays "Coach" for admin users automatically.
-- We also set is_teacher = true so she gets the Professeur badge display.
UPDATE public.profiles
SET is_teacher = TRUE,
    practice_level = 'avancee'
WHERE is_admin = TRUE;

-- ── 3. Verify ───────────────────────────────────────────────────────────────
SELECT p.id, p.first_name, p.practice_level, p.is_admin, p.is_teacher,
  (SELECT COUNT(*) FROM public.user_badges ub WHERE ub.user_id = p.id) AS badge_count
FROM public.profiles p
WHERE p.is_admin = TRUE;
