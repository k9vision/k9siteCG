-- Add per-item payment status to invoice line items
ALTER TABLE invoice_items ADD COLUMN status TEXT DEFAULT 'pending';
