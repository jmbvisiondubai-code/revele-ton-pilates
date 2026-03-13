-- Migration: Create private_appointments table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS private_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meeting_url TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'zoom' CHECK (meeting_type IN ('zoom', 'meet', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE private_appointments ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "admin_all" ON private_appointments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Client can read their own appointments
CREATE POLICY "client_read_own" ON private_appointments
  FOR SELECT USING (client_id = auth.uid());
