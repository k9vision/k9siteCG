-- Migration 006: Add start/end date range for recurring availability slots
ALTER TABLE availability_slots ADD COLUMN recurring_start_date TEXT DEFAULT NULL;
ALTER TABLE availability_slots ADD COLUMN recurring_end_date TEXT DEFAULT NULL;
