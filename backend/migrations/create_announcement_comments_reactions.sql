-- Migration: Create announcement_comments and announcement_reactions tables
-- Run this in your Supabase SQL editor.

-- Comments table
CREATE TABLE IF NOT EXISTS announcement_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ann_comments_announcement ON announcement_comments(announcement_id);

-- Reactions table (one reaction type per user per announcement)
CREATE TABLE IF NOT EXISTS announcement_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ann_reactions_announcement ON announcement_reactions(announcement_id);

-- Share count column on announcements (simple counter)
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;
