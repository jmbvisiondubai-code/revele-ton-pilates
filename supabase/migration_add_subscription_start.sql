-- Add subscription_start column to profiles
-- This stores the date when the client's 1-year coaching started
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_start DATE DEFAULT NULL;

-- Allow admins to update this field via the existing update-profile API
-- (no RLS changes needed since the API uses service role)
