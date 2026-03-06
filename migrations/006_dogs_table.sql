-- Migration 006: Multiple dogs per client
-- Create dogs table to support multiple dogs per client

CREATE TABLE IF NOT EXISTS dogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  dog_name TEXT NOT NULL,
  breed TEXT,
  age INTEGER,
  photo_url TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dogs_client_id ON dogs(client_id);

-- Migrate existing dog data from clients table into dogs table
INSERT INTO dogs (client_id, dog_name, breed, age, photo_url, is_primary)
SELECT id, COALESCE(dog_name, 'Unknown'), dog_breed, dog_age, dog_image, 1
FROM clients
WHERE dog_name IS NOT NULL AND dog_name != '';

-- Recreate notifications table without restrictive CHECK constraint on type
-- so we can add 'new_dog' and future types
CREATE TABLE IF NOT EXISTS notifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  client_id INTEGER,
  reference_id INTEGER,
  reference_type TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

INSERT INTO notifications_new SELECT * FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications(client_id);
