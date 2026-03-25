ALTER TABLE invoices ADD COLUMN discount_type TEXT;
ALTER TABLE invoices ADD COLUMN discount_value REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN discount_amount REAL DEFAULT 0;
