-- Allow multiple media attachments per note (JSON array of media IDs)
ALTER TABLE notes ADD COLUMN media_ids TEXT DEFAULT NULL;
