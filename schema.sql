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
  client_name TEXT,
  email TEXT,
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
INSERT OR IGNORE INTO clients (id, user_id, client_name, email, dog_name, breed, age)
VALUES (1, 2, 'Test Client', 'test@example.com', 'Buddy', 'Golden Retriever', 2);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id INTEGER NOT NULL,
  trainer_name TEXT NOT NULL,
  date DATE NOT NULL,
  due_date DATE,
  subtotal REAL NOT NULL,
  tax_rate REAL NOT NULL,
  tax_amount REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Invoice Items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  service_id INTEGER,
  service_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  total REAL NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Insert default services
INSERT OR IGNORE INTO services (name, description, price, active) VALUES
('Puppy Foundation', 'Basic puppy training and socialization', 150.00, 1),
('Obedience Training', 'Basic to advanced obedience commands', 200.00, 1),
('Behavioral Consultation', 'One-on-one consultation for behavior issues', 175.00, 1),
('Board and Train (30 days)', 'Intensive 30-day board and train program', 2500.00, 1),
('Private Lesson', 'One-hour private training session', 100.00, 1),
('Group Class', 'Group training class session', 75.00, 1);
