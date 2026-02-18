-- Add optional columns to bug_reports table
-- Run this in your Supabase SQL Editor

ALTER TABLE bug_reports
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

ALTER TABLE bug_reports
ADD COLUMN IF NOT EXISTS device TEXT DEFAULT 'unknown';
