-- Add a room-level monthly rent/price used for room browse and details screens.
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS rent NUMERIC DEFAULT 0;

-- Keep host-entered occupancy from the room create/edit modal.
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER;
