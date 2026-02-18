-- Add optional columns to support_tickets table
-- Run this in your Supabase SQL Editor

-- 'description' column (the table may use 'message' instead — this adds 'description' as an alias-friendly column)
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
