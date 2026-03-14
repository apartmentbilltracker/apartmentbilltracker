-- Add room_id column to app_settings for per-room payment settings
-- This enables each room to have independent payment method configuration

-- Add the room_id column (nullable — NULL means host-level settings)
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;

-- Create index for fast lookups by room_id
CREATE INDEX IF NOT EXISTS idx_app_settings_room_id ON app_settings(room_id);

-- Create unique constraint: one settings row per room
-- (allows multiple NULL room_id rows for host-level settings)
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_unique_room
ON app_settings(room_id) WHERE room_id IS NOT NULL;
