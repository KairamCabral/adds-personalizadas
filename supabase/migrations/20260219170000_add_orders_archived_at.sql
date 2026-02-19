-- Add archived_at column for order archiving
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON orders (archived_at) WHERE archived_at IS NOT NULL;
