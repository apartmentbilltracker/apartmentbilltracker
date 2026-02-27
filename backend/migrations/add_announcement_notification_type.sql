-- Add notification_type column to announcements table
-- Used to categorize auto-generated announcements (e.g. billing_cycle)
-- so old cycle banners can be unpinned when a new cycle is created.

ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT NULL;
