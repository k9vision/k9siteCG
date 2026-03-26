-- Migration 027: Link invoices to contacts table for non-client invoice tracking
ALTER TABLE invoices ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
