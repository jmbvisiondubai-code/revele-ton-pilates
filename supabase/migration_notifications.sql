-- Migration: Notifications for DMs + backfill Bienvenue badge
-- Run this in the Supabase SQL editor

-- ── 1. Backfill "Bienvenue" badge to all existing users ──────────────────────
-- Awards the badge to everyone who already completed onboarding
INSERT INTO public.user_badges (user_id, badge_id, earned_at)
SELECT
  p.id,
  b.id,
  COALESCE(p.commitment_signed_at, p.created_at)
FROM public.profiles p
CROSS JOIN (SELECT id FROM public.badges WHERE condition_type = 'welcome' LIMIT 1) b
WHERE p.onboarding_completed = TRUE
ON CONFLICT (user_id, badge_id) DO NOTHING;

-- ── 2. Allow 'message' type in notifications ─────────────────────────────────
-- Drop any existing type constraint so we can add 'message'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('reminder', 'badge', 'live', 'streak', 'weekly_recap', 'message'));

-- ── 3. Trigger: notification when a direct message is received ────────────────
CREATE OR REPLACE FUNCTION public.handle_new_direct_message()
RETURNS trigger AS $$
DECLARE
  v_sender_username TEXT;
BEGIN
  -- Don't notify if sender and receiver are the same (self-message edge case)
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_sender_username
  FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    NEW.receiver_id,
    'message',
    'Nouveau message 💬',
    COALESCE(v_sender_username, 'quelqu''un') || ' t''a envoyé un message',
    '/messages'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_direct_message_received ON public.direct_messages;
CREATE TRIGGER on_direct_message_received
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_direct_message();
