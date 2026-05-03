-- Fix payments_bill_type_check constraint to include 'custom_charges'
-- This constraint was missing 'custom_charges' which is now used for additional charges

-- Drop the existing constraint (if it exists with old values)
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_bill_type_check;

-- Add the updated constraint with all valid bill types
ALTER TABLE payments
ADD CONSTRAINT payments_bill_type_check
CHECK (bill_type IN ('rent', 'electricity', 'water', 'internet', 'custom_charges', 'total'));
