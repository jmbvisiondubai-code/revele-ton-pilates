-- Migration: Add 'initiee' level to practice_level and course level
-- Run this in the Supabase SQL editor

-- ── 1. Update CHECK constraint on profiles.practice_level ───────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_practice_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_practice_level_check
  CHECK (practice_level IN ('debutante', 'initiee', 'intermediaire', 'avancee'));

-- ── 2. Update CHECK constraint on courses.level ─────────────────────────────
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_level_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_level_check
  CHECK (level IN ('debutante', 'initiee', 'intermediaire', 'avancee', 'tous_niveaux'));
