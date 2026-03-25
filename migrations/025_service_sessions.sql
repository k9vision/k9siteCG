-- Add sessions/weeks field to services for multi-week auto-split
ALTER TABLE services ADD COLUMN sessions INTEGER DEFAULT 1;
