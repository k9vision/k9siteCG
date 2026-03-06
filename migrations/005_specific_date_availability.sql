-- Add specific_date support for one-time availability slots
ALTER TABLE availability_slots ADD COLUMN specific_date TEXT DEFAULT NULL;

-- original_name and caption columns on media were added in a prior migration
