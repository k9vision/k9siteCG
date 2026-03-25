ALTER TABLE invoices ADD COLUMN emailed_at DATETIME;
UPDATE invoices SET emailed_at = created_at;
