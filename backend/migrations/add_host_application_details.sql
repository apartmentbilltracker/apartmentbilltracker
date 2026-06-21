-- Stores structured room-host application data and private storage paths.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS host_application JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS host_reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS host_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_host_application_status
  ON users (host_request_status)
  WHERE host_request_status IS NOT NULL;
