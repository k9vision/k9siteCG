-- Add upfront payment percentage to invoice items (0, 25, 50, 75, 100)
ALTER TABLE invoice_items ADD COLUMN upfront_pct INTEGER DEFAULT 0;
