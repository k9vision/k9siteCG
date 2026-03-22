-- Allow invoices to be sent to non-clients via email
ALTER TABLE invoices ADD COLUMN recipient_email TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN recipient_name TEXT DEFAULT NULL;
