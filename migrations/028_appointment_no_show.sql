-- Migration 028: Add 'no_show' status to appointments for analytics tracking
-- SQLite cannot ALTER CHECK constraints, so we recreate the table

CREATE TABLE IF NOT EXISTS appointments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  service_id INTEGER,
  service_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed','no_show')),
  notes TEXT,
  reminder_sent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

INSERT INTO appointments_new (id, client_id, appointment_date, start_time, end_time, service_id, service_name, status, notes, reminder_sent, created_at, updated_at)
  SELECT id, client_id, appointment_date, start_time, end_time, service_id, service_name, status, notes, reminder_sent, created_at, updated_at
  FROM appointments;

DROP TABLE appointments;
ALTER TABLE appointments_new RENAME TO appointments;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_double_book
  ON appointments(appointment_date, start_time)
  WHERE status IN ('pending','confirmed');
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
