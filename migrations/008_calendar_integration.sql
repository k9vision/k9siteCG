-- Google OAuth tokens per user
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at DATETIME NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Maps local entities to Google Calendar event IDs
CREATE TABLE IF NOT EXISTS calendar_event_sync (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('appointment','availability','blocked_date')),
  entity_id INTEGER NOT NULL,
  google_event_id TEXT NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- iCal feed tokens
CREATE TABLE IF NOT EXISTS ical_feed_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  feed_token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
