-- Migration 032: Classify page views so the Visitor Geography report reflects real prospects.
-- Adds the signals needed to tell a real visitor from our own testing, a crawler, or a
-- visitor arriving through a proxy network (e.g. Facebook's in-app browser, whose traffic
-- egresses via Meta data centers and geolocates to Oregon / North Carolina instead of the
-- visitor's real location). Still no raw IP address and no PII.
ALTER TABLE page_views ADD COLUMN user_agent TEXT;
ALTER TABLE page_views ADD COLUMN asn INTEGER;
ALTER TABLE page_views ADD COLUMN as_org TEXT;
-- visitor | internal (our own sessions) | bot (crawler) | proxied (real person, unusable geo)
ALTER TABLE page_views ADD COLUMN traffic_type TEXT DEFAULT 'visitor';

CREATE INDEX IF NOT EXISTS idx_page_views_traffic_type ON page_views(traffic_type);

-- One-time backfill of rows written before classification existed.
-- (a) Our own sessions, identified by hits on private, robots-disallowed paths.
UPDATE page_views SET traffic_type = 'internal'
WHERE page_url LIKE '/portal%'
   OR page_url LIKE '/admin-dashboard%'
   OR page_url LIKE '/client-dashboard%'
   OR page_url LIKE '/setup-account%'
   OR page_url LIKE '/reset-password%'
   OR page_url LIKE '/forgot-password%'
   OR page_url LIKE '/verify-email%'
   OR page_url LIKE '/register%';

-- (b) Facebook in-app browser traffic. These rows carry a real browser referrer of
-- facebook.com (a crawler cannot produce one — Meta's crawler does not execute JS, and this
-- beacon is JS-only and consent-gated) but geolocate to Meta data centers in Prineville, OR
-- and Forest City, NC. They are real people whose LOCATION is wrong, so the visit is kept
-- and only the geography is suppressed. Manually verified; without a stored user_agent or
-- ASN these predate any automatic classification.
UPDATE page_views SET traffic_type = 'proxied'
WHERE traffic_type = 'visitor'
  AND referrer LIKE '%facebook.com%'
  AND region_code IN ('OR', 'NC');
