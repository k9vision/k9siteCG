-- Migration 029: Add sort_order and album columns to media for gallery enhancements
ALTER TABLE media ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE media ADD COLUMN album TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_media_sort ON media(client_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_album ON media(client_id, album);
