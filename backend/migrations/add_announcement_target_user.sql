-- Migration: Add target_user_id to announcements table
-- Run this in your Supabase SQL editor before deploying the updated backend.

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN announcements.target_user_id IS
  'When set, this banner/announcement is only visible to this specific user. NULL = visible to all room members.';
