-- Migration: Add session_type column to live_sessions
-- Run this in Supabase SQL Editor

-- Add session_type column with default 'collectif' for existing rows
ALTER TABLE live_sessions
ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'collectif';

-- Update existing collective sessions
UPDATE live_sessions SET session_type = 'collectif' WHERE is_collective = true AND session_type = 'collectif';
