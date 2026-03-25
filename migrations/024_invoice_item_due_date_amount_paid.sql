-- Add due_date and amount_paid columns to invoice_items
ALTER TABLE invoice_items ADD COLUMN due_date DATE;
ALTER TABLE invoice_items ADD COLUMN amount_paid REAL DEFAULT 0;
