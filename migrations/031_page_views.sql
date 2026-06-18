-- Migration 031: First-party visitor geo tracking from Cloudflare request.cf
-- Captures coarse geography (city / state / ZIP / country) per page view.
-- No raw IP address or PII is stored.
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_url TEXT,
  referrer TEXT,
  city TEXT,
  region TEXT,        -- state / province (e.g. "Texas")
  region_code TEXT,   -- state abbreviation (e.g. "TX")
  postal_code TEXT,   -- ZIP / postal code (approximate)
  country TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_views_region ON page_views(region);
CREATE INDEX IF NOT EXISTS idx_page_views_city ON page_views(city);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
