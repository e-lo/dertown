-- Migration: Add comments fields and cleanup unused fields

-- Add comments field to events_staged table
ALTER TABLE events_staged 
ADD COLUMN comments TEXT;

-- Add comments field to announcements_staged table
ALTER TABLE announcements_staged 
ADD COLUMN comments TEXT;

-- Add comments field to main events table (for admin use only)
ALTER TABLE events 
ADD COLUMN comments TEXT;

-- Add comments field to main announcements table (for admin use only)
ALTER TABLE announcements 
ADD COLUMN comments TEXT;

-- Remove unused google_calendar_event_id field from events_staged
ALTER TABLE events_staged 
DROP COLUMN IF EXISTS google_calendar_event_id;

-- Add comments to the main events table as well (for admin use)
-- This allows admins to add internal notes that won't be public

-- Add comments to the main announcements table as well (for admin use)
-- This allows admins to add internal notes that won't be public

-- Add comments to validation constraints
ALTER TABLE events_staged
ADD CONSTRAINT events_staged_comments_length CHECK (length(comments) <= 2000);

ALTER TABLE announcements_staged
ADD CONSTRAINT announcements_staged_comments_length CHECK (length(comments) <= 2000);

-- Add comments to main tables as well
ALTER TABLE events
ADD CONSTRAINT events_comments_length CHECK (length(comments) <= 2000);

ALTER TABLE announcements
ADD CONSTRAINT announcements_comments_length CHECK (length(comments) <= 2000);

-- Add comments to the database types
COMMENT ON COLUMN events_staged.comments IS 'Internal comments for admin review - not published';
COMMENT ON COLUMN announcements_staged.comments IS 'Internal comments for admin review - not published';
COMMENT ON COLUMN events.comments IS 'Internal admin comments - not published';
COMMENT ON COLUMN announcements.comments IS 'Internal admin comments - not published'; 