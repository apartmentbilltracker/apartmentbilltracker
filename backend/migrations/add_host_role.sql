-- Add host_request_status column to users table
-- Tracks host role requests: null (no request), 'pending', 'approved', 'rejected'
ALTER TABLE users ADD COLUMN IF NOT EXISTS host_request_status TEXT DEFAULT NULL;

-- Add requested_at timestamp for when host request was made
ALTER TABLE users ADD COLUMN IF NOT EXISTS host_requested_at TIMESTAMPTZ DEFAULT NULL;
