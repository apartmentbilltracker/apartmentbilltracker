-- Fix payments_status_check constraint to include 'submitted' and 'rejected' statuses
-- These statuses are used in the payment verification flow:
--   pending -> submitted (after user confirms GCash/bank transfer)
--   submitted -> completed (host approves)
--   submitted -> rejected (host rejects)

-- Drop the existing constraint
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_status_check;

-- Add the updated constraint with all valid statuses
ALTER TABLE payments
ADD CONSTRAINT payments_status_check
CHECK (status IN ('pending', 'submitted', 'completed', 'rejected', 'failed', 'verified'));
