-- Add missing columns to media table for captions and original filenames
ALTER TABLE media ADD COLUMN original_name TEXT;
ALTER TABLE media ADD COLUMN caption TEXT DEFAULT '';
