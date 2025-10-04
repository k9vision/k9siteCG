-- K9 Vision Database Schema for Cloudflare D1

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'client')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  dog_name TEXT,
  breed TEXT,
  age INTEGER,
  photo_url TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Media table
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('photo', 'video')),
  url TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_media_client_id ON media(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_client_id ON notes(client_id);

-- Insert admin user (password: admin36cg)
INSERT OR IGNORE INTO users (id, username, password, role)
VALUES (1, 'admin36cg', '$2a$10$P89RPGt12NsaYLksacpQquDu2fCscwpiHaSuwAdoYVCQCfS4tQg.K', 'admin');

-- Insert test client user (password: test123)
INSERT OR IGNORE INTO users (id, username, password, role)
VALUES (2, 'testclient', '$2a$10$FJDvXkuObmUBvbU6j8LJ9.3iTg3oHBep6PVtIaUvCG.5Q8Sw99XkW', 'client');

-- Insert test client data
INSERT OR IGNORE INTO clients (id, user_id, dog_name, breed, age)
VALUES (1, 2, 'Buddy', 'Golden Retriever', 2);
