-- Recreate invoices table with nullable client_id for non-client invoices
CREATE TABLE invoices_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id INTEGER,
  trainer_name TEXT NOT NULL,
  date DATE NOT NULL,
  due_date DATE,
  subtotal REAL NOT NULL,
  tax_rate REAL NOT NULL,
  tax_amount REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

INSERT INTO invoices_new (id, invoice_number, client_id, trainer_name, date, due_date, subtotal, tax_rate, tax_amount, total, status, notes, recipient_email, recipient_name, created_at)
SELECT id, invoice_number, client_id, trainer_name, date, due_date, subtotal, tax_rate, tax_amount, total, status, notes, recipient_email, recipient_name, created_at FROM invoices;

DROP TABLE invoices;

ALTER TABLE invoices_new RENAME TO invoices;

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
