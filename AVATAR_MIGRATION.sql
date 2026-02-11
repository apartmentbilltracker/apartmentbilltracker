-- Add avatar column to users table
ALTER TABLE users ADD COLUMN avatar JSONB DEFAULT NULL;

-- Explanation:
-- avatar field will store: { public_id: "user_avatar", url: "data:image/jpeg;base64,..." }
-- JSONB allows flexible storage of nested objects
