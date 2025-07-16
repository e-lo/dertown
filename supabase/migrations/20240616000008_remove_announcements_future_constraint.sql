-- Remove overly restrictive constraint on announcements.show_at
-- This constraint prevented creating announcements with past show_at times,
-- which is too restrictive for practical use

ALTER TABLE announcements 
DROP CONSTRAINT IF EXISTS announcements_show_at_future; 