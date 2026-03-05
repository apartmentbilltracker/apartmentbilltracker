-- Add water_fixed_type column to rooms table
-- "by_room"    = one fixed total for the whole room, split equally among paying members
-- "per_person" = a fixed rate charged per paying member (total scales with member count)

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS water_fixed_type TEXT NOT NULL DEFAULT 'by_room';
