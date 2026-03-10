-- Add optional media_id FK to notes table for media-linked notes
ALTER TABLE notes ADD COLUMN media_id INTEGER REFERENCES media(id) ON DELETE SET NULL;
