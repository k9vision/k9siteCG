-- Migration 003: Auth tokens for invite, verification, and password reset flows

-- Add status column to users (existing users default to 'active')
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Add email column to users (for password reset lookups)
ALTER TABLE users ADD COLUMN email TEXT;

-- Backfill email from clients table
UPDATE users SET email = (
  SELECT c.email FROM clients c WHERE c.user_id = users.id
) WHERE EXISTS (
  SELECT 1 FROM clients c WHERE c.user_id = users.id AND c.email IS NOT NULL
);

-- Token table for invite, verification, and reset flows
CREATE TABLE IF NOT EXISTS account_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  user_id INTEGER,
  client_id INTEGER,
  email TEXT,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_tokens_token ON account_tokens(token);
CREATE INDEX IF NOT EXISTS idx_account_tokens_user_id ON account_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
