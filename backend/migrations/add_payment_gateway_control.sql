-- Add host-controlled payment gateway state to billing cycles.
-- New active cycles default to closed so hosts can finalize presence-based
-- water charges before payors start payments.

ALTER TABLE billing_cycles
ADD COLUMN IF NOT EXISTS payment_gateway_open BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_gateway_opened_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_gateway_opened_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_gateway_closed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_gateway_closed_by UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_cycles_payment_gateway_open
ON billing_cycles (payment_gateway_open);
