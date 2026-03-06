-- Add author_role column to notes table for two-way conversation
ALTER TABLE notes ADD COLUMN author_role TEXT DEFAULT 'admin';
