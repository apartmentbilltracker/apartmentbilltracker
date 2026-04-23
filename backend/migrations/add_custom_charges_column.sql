-- Add custom_charges column to billing_cycles table
-- This column stores custom charges as a JSONB array of {name, amount, description} objects

ALTER TABLE billing_cycles
ADD COLUMN IF NOT EXISTS custom_charges jsonb DEFAULT NULL;

-- Create index for faster queries on custom_charges
CREATE INDEX IF NOT EXISTS idx_billing_cycles_custom_charges
ON billing_cycles USING gin(custom_charges);

-- Update total_billed_amount for existing cycles that may have custom_charges data
-- (This handles the case where custom_charges might have been stored elsewhere)
-- Note: Most cycles without custom_charges will remain unchanged
