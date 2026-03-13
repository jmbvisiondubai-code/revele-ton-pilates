-- ============================================================
-- Migration: Practice Log System
-- Extends course_completions for declarative practice tracking
-- ============================================================

-- 1. Add session_type discriminator (vod, live, libre)
ALTER TABLE course_completions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'vod';

-- 2. Add free-text label for libre (free practice) sessions
ALTER TABLE course_completions
  ADD COLUMN IF NOT EXISTS libre_label TEXT;

-- 3. Index for efficient streak calculation
CREATE INDEX IF NOT EXISTS idx_completions_user_date
  ON course_completions (user_id, completed_at DESC);

-- ============================================================
-- RPC: Recalculate user stats after each practice log
-- Returns updated stats + any newly awarded badges
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_sessions INTEGER;
  v_total_minutes INTEGER;
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER;
  v_prev_date DATE;
  rec RECORD;
BEGIN
  -- Total sessions & minutes
  SELECT COUNT(*), COALESCE(SUM(duration_watched_minutes), 0)
  INTO v_total_sessions, v_total_minutes
  FROM course_completions WHERE user_id = p_user_id;

  -- Streak: count consecutive days with at least one completion
  FOR rec IN
    SELECT DISTINCT (completed_at AT TIME ZONE 'Europe/Paris')::DATE AS d
    FROM course_completions
    WHERE user_id = p_user_id
    ORDER BY d DESC
  LOOP
    IF v_prev_date IS NULL THEN
      -- First row: must be today or yesterday to count
      IF rec.d >= (NOW() AT TIME ZONE 'Europe/Paris')::DATE - INTERVAL '1 day' THEN
        v_current_streak := 1;
        v_prev_date := rec.d;
      ELSE
        EXIT;
      END IF;
    ELSIF v_prev_date - rec.d = 1 THEN
      v_current_streak := v_current_streak + 1;
      v_prev_date := rec.d;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Update longest_streak if new record
  SELECT longest_streak INTO v_longest_streak
  FROM profiles WHERE id = p_user_id;

  IF v_current_streak > COALESCE(v_longest_streak, 0) THEN
    v_longest_streak := v_current_streak;
  END IF;

  -- Update profile aggregates
  UPDATE profiles SET
    total_sessions = v_total_sessions,
    total_practice_minutes = v_total_minutes,
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Auto-award badges for total_sessions, total_minutes, streak
  INSERT INTO user_badges (user_id, badge_id)
  SELECT p_user_id, b.id
  FROM badges b
  WHERE (
    (b.condition_type = 'total_sessions' AND b.condition_value <= v_total_sessions)
    OR (b.condition_type = 'total_minutes' AND b.condition_value <= v_total_minutes)
    OR (b.condition_type = 'streak' AND b.condition_value <= v_current_streak)
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_badges ub WHERE ub.user_id = p_user_id AND ub.badge_id = b.id
  );

  -- Return stats + badges awarded in last 10 seconds (newly earned)
  RETURN json_build_object(
    'total_sessions', v_total_sessions,
    'total_practice_minutes', v_total_minutes,
    'current_streak', v_current_streak,
    'longest_streak', v_longest_streak,
    'new_badges', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', b.id,
        'name', b.name,
        'description', b.description,
        'icon', b.icon,
        'category', b.category
      )), '[]'::json)
      FROM badges b
      JOIN user_badges ub ON ub.badge_id = b.id
      WHERE ub.user_id = p_user_id
        AND ub.earned_at >= NOW() - INTERVAL '10 seconds'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
