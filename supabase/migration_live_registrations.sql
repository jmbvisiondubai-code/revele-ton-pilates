-- Migration: Auto-update registered_count on live_sessions when registrations change
-- Run this in Supabase SQL Editor

-- Function to update registered_count
CREATE OR REPLACE FUNCTION update_live_registered_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE live_sessions SET registered_count = (
      SELECT COUNT(*) FROM live_registrations WHERE live_session_id = NEW.live_session_id
    ) WHERE id = NEW.live_session_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE live_sessions SET registered_count = (
      SELECT COUNT(*) FROM live_registrations WHERE live_session_id = OLD.live_session_id
    ) WHERE id = OLD.live_session_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on insert
DROP TRIGGER IF EXISTS trg_live_reg_insert ON live_registrations;
CREATE TRIGGER trg_live_reg_insert
  AFTER INSERT ON live_registrations
  FOR EACH ROW EXECUTE FUNCTION update_live_registered_count();

-- Trigger on delete
DROP TRIGGER IF EXISTS trg_live_reg_delete ON live_registrations;
CREATE TRIGGER trg_live_reg_delete
  AFTER DELETE ON live_registrations
  FOR EACH ROW EXECUTE FUNCTION update_live_registered_count();

-- Ensure RLS policies exist for live_registrations
-- Users can insert their own registrations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'live_registrations' AND policyname = 'Users can register themselves'
  ) THEN
    CREATE POLICY "Users can register themselves" ON live_registrations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Users can delete their own registrations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'live_registrations' AND policyname = 'Users can cancel their registration'
  ) THEN
    CREATE POLICY "Users can cancel their registration" ON live_registrations
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can view their own registrations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'live_registrations' AND policyname = 'Users can view their registrations'
  ) THEN
    CREATE POLICY "Users can view their registrations" ON live_registrations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Enable RLS on live_registrations if not already
ALTER TABLE live_registrations ENABLE ROW LEVEL SECURITY;
