-- Add reminder_sent flag to appointments for tracking sent reminders
ALTER TABLE appointments ADD COLUMN reminder_sent INTEGER DEFAULT 0;
