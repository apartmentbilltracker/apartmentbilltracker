ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Also ensure bug_reports has the column (should already exist)
ALTER TABLE bug_reports
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
