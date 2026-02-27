-- Migration: Create announcement_reads table
-- Run this in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS announcement_reads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)   -- one record per user per announcement
);

-- Index for fast badge count queries (look up by user)
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user
  ON announcement_reads (user_id);

-- Index for fast lookup by announcement
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement
  ON announcement_reads (announcement_id);
